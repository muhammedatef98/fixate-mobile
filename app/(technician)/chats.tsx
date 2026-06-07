import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, SafeAreaView,
  RefreshControl, ActivityIndicator, StatusBar,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import { getColors, getShadows, BORDER_RADIUS, SPACING } from '../../constants/theme';
import { supabase } from '../../services/supabaseClient';
import Avatar from '../../components/Avatar';
import { TECH_NAV_HEIGHT } from '../../components/BottomNavTech';
import { logger } from '../../utils/logger';
import { selection } from '../../utils/haptics';
import { listMyMarketThreads } from '../../services/marketService';

/**
 * Technician "Chats" tab — merges two inboxes the technician participates in:
 *   1. Order chats   — messages table keyed by order_id, opened at /chat/[id]
 *   2. Market chats  — DM threads about marketplace listings, opened at
 *                      /market-chat?threadId=...
 *
 * Sorted by most recent activity. Read-only listing; no chat creation here.
 */
type ChatRow = {
  /** Stable list key, prefixed to avoid id collisions across the two sources. */
  key: string;
  kind: 'order' | 'market';
  /** Target route + params used when the row is tapped. */
  route: string;
  routeParams?: Record<string, string>;
  peerName: string;
  peerAvatar: string | null;
  subtitle: string;
  lastMessage: string | null;
  lastAt: string | null;
  unread: number;
};

export default function TechnicianChats() {
  const router = useRouter();
  const { language, isDark } = useApp();
  const isRTL = language === 'ar';
  const C = getColors(isDark);
  const SHADOWS = getShadows(isDark);
  const styles = createStyles(C, isRTL, SHADOWS);

  const { user } = useAuth();

  const [rows, setRows] = useState<ChatRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id) { setLoading(false); return; }
    try {
      // ── Market threads (DMs about a marketplace listing) ───────────────
      // Fetched in parallel; failure here must not block the order chats
      // from rendering.
      const marketPromise = listMyMarketThreads({ limit: 50 }).catch((e) => {
        logger.warn('chats: market threads fetch failed', e);
        return [];
      });

      // Pull two sources in parallel so a chat shows up even when the order
      // isn't (yet) formally assigned to this technician:
      //   1. Orders explicitly owned by the technician (technician_id = me)
      //   2. Any order I've sent a message in (sender_id = me)
      // The second source ensures messages the tech just sent always appear
      // here, even if technician_id propagation lags or the order is still
      // in an "available" / pending state.
      const [
        { data: ownedOrders, error: ownedErr },
        { data: myMessages, error: msgsErr },
      ] = await Promise.all([
        supabase
          .from('orders')
          .select('id, customer_id, service_type, status, created_at')
          .eq('technician_id', user.id)
          .order('created_at', { ascending: false })
          .limit(60),
        supabase
          .from('messages')
          .select('order_id')
          .eq('sender_id', user.id)
          .order('created_at', { ascending: false })
          .limit(200),
      ]);

      if (ownedErr) throw ownedErr;
      if (msgsErr) logger.warn('chats: messages-by-sender query failed', msgsErr);

      const ownedList = ownedOrders ?? [];
      const ownedIds = new Set(ownedList.map((o: any) => o.id));
      const extraIds = Array.from(
        new Set(
          (myMessages ?? [])
            .map((m: any) => m.order_id)
            .filter((id: string) => id && !ownedIds.has(id))
        )
      );

      let extraOrders: any[] = [];
      if (extraIds.length > 0) {
        const { data: more, error: moreErr } = await supabase
          .from('orders')
          .select('id, customer_id, service_type, status, created_at')
          .in('id', extraIds);
        if (moreErr) logger.warn('chats: extra orders query failed', moreErr);
        extraOrders = more ?? [];
      }

      const list = [...ownedList, ...extraOrders];

      const orderIds = list.map((o: any) => o.id);
      const customerIds = Array.from(
        new Set(list.map((o: any) => o.customer_id).filter(Boolean))
      );

      const [{ data: messages }, { data: customers }, marketThreads] = await Promise.all([
        orderIds.length > 0
          ? supabase
              .from('messages')
              .select('order_id, content, created_at, sender_id, is_read')
              .in('order_id', orderIds)
              .order('created_at', { ascending: false })
          : Promise.resolve({ data: [] as any[] }),
        customerIds.length > 0
          ? supabase
              .from('users')
              .select('id, name, avatar_url')
              .in('id', customerIds)
          : Promise.resolve({ data: [] as any[] }),
        marketPromise,
      ]);

      const customersById = new Map<string, any>(
        (customers ?? []).map((c: any) => [c.id, c])
      );

      const latestByOrder = new Map<string, any>();
      const unreadByOrder = new Map<string, number>();
      for (const m of messages ?? []) {
        if (!latestByOrder.has(m.order_id)) latestByOrder.set(m.order_id, m);
        if (m.sender_id !== user.id && m.is_read === false) {
          unreadByOrder.set(m.order_id, (unreadByOrder.get(m.order_id) ?? 0) + 1);
        }
      }

      const orderRows: ChatRow[] = list.map((o: any) => {
        const last = latestByOrder.get(o.id);
        const cust = o.customer_id ? customersById.get(o.customer_id) : null;
        return {
          key: `order:${o.id}`,
          kind: 'order',
          route: `/chat/${o.id}`,
          peerName: cust?.name || (isRTL ? 'عميل' : 'Customer'),
          peerAvatar: cust?.avatar_url ?? null,
          subtitle: o.service_type || (isRTL ? 'طلب صيانة' : 'Repair order'),
          lastMessage: last?.content ?? null,
          lastAt: last?.created_at ?? o.created_at ?? null,
          unread: unreadByOrder.get(o.id) ?? 0,
        };
      });

      const marketRows: ChatRow[] = (marketThreads ?? []).map((t: any) => ({
        key: `market:${t.thread_id}`,
        kind: 'market',
        route: '/market-chat',
        routeParams: { threadId: t.thread_id },
        peerName: t.counterparty_name || (isRTL ? 'مستخدم' : 'User'),
        peerAvatar: t.counterparty_avatar ?? null,
        subtitle:
          (t.listing_title
            ? (isRTL ? `سوق · ${t.listing_title}` : `Market · ${t.listing_title}`)
            : (isRTL ? 'سوق' : 'Market')),
        lastMessage: t.last_message_preview ?? null,
        lastAt: t.last_message_at ?? null,
        unread: t.unread ? 1 : 0,
      }));

      const built = [...orderRows, ...marketRows];

      built.sort((a, b) => {
        const ta = a.lastAt ? new Date(a.lastAt).getTime() : 0;
        const tb = b.lastAt ? new Date(b.lastAt).getTime() : 0;
        return tb - ta;
      });

      setRows(built);
    } catch (e) {
      logger.warn('chats load failed', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id, isRTL]);

  useEffect(() => { load(); }, [load]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const openChat = (row: ChatRow) => {
    selection();
    if (row.routeParams && Object.keys(row.routeParams).length > 0) {
      router.push({ pathname: row.route as any, params: row.routeParams });
    } else {
      router.push(row.route as any);
    }
  };

  const formatWhen = (iso: string | null) => {
    if (!iso) return '';
    const d = new Date(iso);
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    if (sameDay) {
      return d.toLocaleTimeString(isRTL ? 'ar-SA' : 'en-GB', {
        hour: '2-digit', minute: '2-digit',
      });
    }
    return d.toLocaleDateString(isRTL ? 'ar-SA' : 'en-GB', {
      month: 'short', day: '2-digit',
    });
  };

  const renderItem = ({ item }: { item: ChatRow }) => (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => openChat(item)}
      style={styles.row}
      accessibilityRole="button"
      accessibilityLabel={`${item.peerName}, ${item.subtitle}`}
    >
      <Avatar name={item.peerName} uri={item.peerAvatar ?? undefined} size={50} />
      <View style={styles.rowBody}>
        <View style={styles.rowTop}>
          <Text style={styles.name} numberOfLines={1}>{item.peerName}</Text>
          <Text style={styles.when}>{formatWhen(item.lastAt)}</Text>
        </View>
        <Text style={styles.preview} numberOfLines={1}>
          {item.lastMessage
            ? item.lastMessage
            : (isRTL ? 'لا توجد رسائل بعد — ابدأ المحادثة' : 'No messages yet — start the chat')}
        </Text>
        <View style={styles.metaRow}>
          <View style={styles.statusChip}>
            <Text style={styles.statusChipText} numberOfLines={1}>
              {item.subtitle}
            </Text>
          </View>
          {item.unread > 0 ? (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>{item.unread}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={C.background} />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>{isRTL ? 'المحادثات' : 'Chats'}</Text>
        <View style={styles.headerCountChip}>
          <Ionicons name="chatbubbles" size={12} color={C.primary} />
          <Text style={styles.headerCountText}>{rows.length}</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.centerFill}>
          <ActivityIndicator color={C.primary} />
        </View>
      ) : rows.length === 0 ? (
        <View style={styles.emptyWrap}>
          <MaterialCommunityIcons name="chat-outline" size={64} color={C.textLight} />
          <Text style={styles.emptyTitle}>
            {isRTL ? 'لا توجد محادثات بعد' : 'No conversations yet'}
          </Text>
          <Text style={styles.emptyBody}>
            {isRTL
              ? 'ستظهر هنا محادثاتك مع العملاء بعد قبول أول طلب صيانة.'
              : 'Your chats with customers will appear here once you accept your first repair job.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(it) => it.key}
          renderItem={renderItem}
          contentContainerStyle={{
            padding: 16,
            paddingBottom: TECH_NAV_HEIGHT + 24,
            gap: 10,
          }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(); }}
              tintColor={C.primary}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

const createStyles = (C: any, isRTL: boolean, SHADOWS: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    header: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 16, paddingVertical: 14,
    },
    headerTitle: { fontSize: 22, fontWeight: '800', color: C.text, letterSpacing: -0.3 },
    headerCountChip: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center', gap: 6,
      paddingHorizontal: 10, paddingVertical: 5,
      borderRadius: 999,
      backgroundColor: C.primarySoft,
    },
    headerCountText: { color: C.primary, fontWeight: '800', fontSize: 12 },

    centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center' },

    row: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center', gap: 12,
      backgroundColor: C.card,
      borderRadius: BORDER_RADIUS.lg,
      borderWidth: 1, borderColor: C.border,
      padding: 12,
      ...SHADOWS.small,
    },
    rowBody: { flex: 1, gap: 4 },
    rowTop: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center', justifyContent: 'space-between', gap: 8,
    },
    name: { flex: 1, color: C.text, fontWeight: '800', fontSize: 15,
      textAlign: isRTL ? 'right' : 'left' },
    when: { color: C.textSecondary, fontSize: 11, fontWeight: '700' },
    preview: { color: C.textSecondary, fontSize: 13,
      textAlign: isRTL ? 'right' : 'left' },
    metaRow: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center', justifyContent: 'space-between',
      marginTop: 4,
    },
    statusChip: {
      paddingHorizontal: 8, paddingVertical: 3,
      borderRadius: 999,
      backgroundColor: C.cardAlt,
      maxWidth: '75%',
    },
    statusChipText: { color: C.textSecondary, fontSize: 10.5, fontWeight: '700' },
    unreadBadge: {
      minWidth: 20, height: 20, borderRadius: 10,
      backgroundColor: C.primary,
      alignItems: 'center', justifyContent: 'center',
      paddingHorizontal: 6,
    },
    unreadText: { color: '#fff', fontSize: 11, fontWeight: '800' },

    emptyWrap: {
      flex: 1, alignItems: 'center', justifyContent: 'center',
      paddingHorizontal: SPACING.xl, gap: 10,
    },
    emptyTitle: { color: C.text, fontSize: 17, fontWeight: '800', marginTop: 6 },
    emptyBody: { color: C.textSecondary, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  });
