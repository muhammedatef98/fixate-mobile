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

/**
 * Technician "Chats" tab — one row per order the technician is involved in,
 * sorted by latest message activity. Tapping a row opens the existing per-order
 * chat at /chat/[id]. Read-only listing; no chat creation happens here.
 */
type ChatRow = {
  orderId: string;
  customerId: string | null;
  customerName: string;
  customerAvatar: string | null;
  /** Row identity: "[Device] — #[Order Number]" (Fix 6b). */
  title: string;
  orderStatus: string;
  lastMessage: string | null;
  lastAt: string | null;
  unread: number;
};

/** Color-coded status chip mapping (Fix 6d): pending = orange, active = blue,
 *  completed = green, rejected/cancelled = red. */
const statusMeta = (status: string, isRTL: boolean): { label: string; color: string } => {
  switch (status) {
    case 'completed':
      return { label: isRTL ? 'مكتمل' : 'Completed', color: '#10B981' };
    case 'rejected':
      return { label: isRTL ? 'مرفوض' : 'Rejected', color: '#EF4444' };
    case 'cancelled':
      return { label: isRTL ? 'ملغى' : 'Cancelled', color: '#EF4444' };
    case 'pending':
    case 'quoted':
    case 'awaiting_payment':
      return { label: isRTL ? 'قيد الانتظار' : 'Pending', color: '#F59E0B' };
    default:
      // accepted / in_progress / repairing / delivering … — work in motion.
      return { label: isRTL ? 'نشط' : 'Active', color: '#3B82F6' };
  }
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
          .select('id, user_id, service_type, status, created_at, device_brand, device_model, order_number')
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
          .select('id, user_id, service_type, status, created_at, device_brand, device_model, order_number')
          .in('id', extraIds);
        if (moreErr) logger.warn('chats: extra orders query failed', moreErr);
        extraOrders = more ?? [];
      }

      const list = [...ownedList, ...extraOrders];

      if (list.length === 0) {
        setRows([]);
        return;
      }

      const orderIds = list.map((o: any) => o.id);
      const customerIds = Array.from(
        new Set(list.map((o: any) => o.user_id).filter(Boolean))
      );

      const [{ data: messages }, { data: customers }] = await Promise.all([
        supabase
          .from('messages')
          .select('order_id, content, created_at, sender_id, is_read')
          .in('order_id', orderIds)
          .order('created_at', { ascending: false }),
        customerIds.length > 0
          ? supabase
              .from('users')
              .select('id, name, avatar_url')
              .in('id', customerIds)
          : Promise.resolve({ data: [] as any[] }),
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

      const built: ChatRow[] = list.map((o: any) => {
        const last = latestByOrder.get(o.id);
        const cust = o.user_id ? customersById.get(o.user_id) : null;
        // Fix 6b — identify each conversation by the device + order number,
        // e.g. "Apple iPhone 13 — #1042", instead of a generic customer
        // name/placeholder. order_number is shown bare-prefixed with '#';
        // we fall back to a short id slice when it's missing.
        const orderNo = o.order_number
          ? `#${o.order_number}`
          : o.id
          ? `#${String(o.id).slice(0, 8)}`
          : '';
        const deviceLabel =
          [o.device_brand, o.device_model].filter(Boolean).join(' ').trim() ||
          (isRTL ? 'جهاز' : 'Device');
        return {
          orderId: o.id,
          customerId: o.user_id ?? null,
          // Kept for the avatar only — no longer shown as the row title.
          customerName: cust?.name || (isRTL ? 'عميل' : 'Customer'),
          customerAvatar: cust?.avatar_url ?? null,
          title: `${deviceLabel} — ${orderNo}`,
          orderStatus: o.status || 'pending',
          lastMessage: last?.content ?? null,
          lastAt: last?.created_at ?? o.created_at ?? null,
          unread: unreadByOrder.get(o.id) ?? 0,
        };
      });

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
    router.push(`/chat/${row.orderId}` as any);
  };

  const formatWhen = (iso: string | null) => {
    if (!iso) return '';
    const d = new Date(iso);
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    if (sameDay) {
      return d.toLocaleTimeString(isRTL ? 'ar-SA-u-ca-gregory' : 'en-GB', {
        hour: '2-digit', minute: '2-digit',
      });
    }
    return d.toLocaleDateString(isRTL ? 'ar-SA-u-ca-gregory' : 'en-GB', {
      month: 'short', day: '2-digit',
    });
  };

  const renderItem = ({ item }: { item: ChatRow }) => {
    const sMeta = statusMeta(item.orderStatus, isRTL);
    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => openChat(item)}
        style={styles.row}
        accessibilityRole="button"
        accessibilityLabel={`${item.title}, ${sMeta.label}`}
      >
        <Avatar name={item.customerName} uri={item.customerAvatar ?? undefined} size={50} />
        <View style={styles.rowBody}>
          <View style={styles.rowTop}>
            <Text style={styles.name} numberOfLines={1}>{item.title}</Text>
            <Text style={styles.when}>{formatWhen(item.lastAt)}</Text>
          </View>
          <Text style={styles.preview} numberOfLines={1}>
            {item.lastMessage
              ? item.lastMessage
              : (isRTL ? 'لا توجد رسائل بعد — ابدأ المحادثة' : 'No messages yet — start the chat')}
          </Text>
          <View style={styles.metaRow}>
            <View style={[styles.statusChip, { backgroundColor: sMeta.color + '18' }]}>
              <View style={[styles.statusDot, { backgroundColor: sMeta.color }]} />
              <Text style={[styles.statusChipText, { color: sMeta.color }]} numberOfLines={1}>
                {sMeta.label}
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
  };

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
          keyExtractor={(it) => it.orderId}
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
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 9, paddingVertical: 4,
      borderRadius: 999,
      maxWidth: '75%',
    },
    statusDot: { width: 6, height: 6, borderRadius: 3 },
    statusChipText: { fontSize: 10.5, fontWeight: '800' },
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
