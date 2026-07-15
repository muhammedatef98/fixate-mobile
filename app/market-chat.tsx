import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  FlatList,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { getColors, SPACING, BORDER_RADIUS } from '../constants/theme';
import { RTLIonicon } from '../components/RTLIcon';
import VerifiedBadge from '../components/VerifiedBadge';
import {
  getOrCreateMarketThread,
  listMarketMessages,
  sendMarketMessage,
  subscribeMarketMessages,
  markMarketThreadRead,
  type MarketMessage,
  type MarketThread,
} from '../services/marketService';
import { supabase } from '../services/supabaseClient';
import { useScrollToEndOnKeyboard } from '../hooks/useScrollToEndOnKeyboard';
import { formatAppTimeOnly } from '../lib/formatDate';

/**
 * Marketplace DM thread.
 *
 * Two entry modes:
 *   1. From a listing detail page — caller passes (listingId, sellerId).
 *      We're the buyer; getOrCreateMarketThread opens or creates the
 *      thread keyed on (listingId, buyerId=me).
 *   2. From the inbox (market-messages) — caller may pass threadId
 *      directly and we resolve buyer/seller from the DB. This handles
 *      the "I'm the seller, opening an existing buyer thread" case.
 */
export default function MarketChatScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    listingId?: string;
    sellerId?: string;
    buyerId?: string;
    threadId?: string;
    counterpartyName?: string;
    listingTitle?: string;
    listingImage?: string;
  }>();
  const { language, isDark } = useApp();
  const { user } = useAuth();
  const COLORS = getColors(isDark);
  const isRTL = language === 'ar';

  const [thread, setThread] = useState<MarketThread | null>(null);
  const [messages, setMessages] = useState<MarketMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [counterpartyVerified, setCounterpartyVerified] = useState<boolean>(false);
  const [headerCounterparty, setHeaderCounterparty] = useState<string>(
    params.counterpartyName ?? ''
  );
  const listRef = useRef<FlatList<MarketMessage>>(null);
  const insets = useSafeAreaInsets();
  useScrollToEndOnKeyboard(listRef);
  const channelRef = useRef<any>(null);

  const open = useCallback(async () => {
    if (!user?.id) return;
    try {
      let t: MarketThread | null = null;

      // Mode 2: inbox opened us with a known threadId. Fetch the row
      // directly — RLS guarantees we can only read threads we participate
      // in.
      if (params.threadId) {
        const { data, error } = await supabase
          .from('market_threads')
          .select('*')
          .eq('id', params.threadId)
          .maybeSingle();
        if (error) throw error;
        t = data as MarketThread | null;
      }

      // Mode 1: listing-detail opened us. We are the buyer.
      if (!t && params.listingId && params.sellerId) {
        // If the param sellerId equals the current user, this is actually
        // a seller looking at their own listing — they would self-DM,
        // which is rejected at the DB. Surface a friendly error.
        if (params.sellerId === user.id) {
          Alert.alert(
            isRTL ? 'لا يمكن مراسلة نفسك' : "Can't chat with yourself",
            isRTL
              ? 'هذا الإعلان مملوك لك — افتح صندوق الرسائل لرؤية المحادثات الواردة من المشترين.'
              : 'You own this listing — open Messages to see incoming buyer threads.'
          );
          router.replace('/market-messages');
          return;
        }
        t = await getOrCreateMarketThread(params.listingId, user.id, params.sellerId);
      }

      if (!t) {
        throw new Error(isRTL ? 'بيانات المحادثة غير مكتملة' : 'Incomplete chat parameters');
      }

      setThread(t);

      // If the counterparty name wasn't passed in (mode 1 from listing
      // detail), resolve it from the public_user_cards view so the header
      // shows a real name instead of just "seller".
      // Always resolve the counterparty's verified status; the name only
      // when it wasn't passed in from the listing detail.
      const counterpartyId = t.buyer_id === user.id ? t.seller_id : t.buyer_id;
      const { data: card } = await supabase
        .from('public_user_cards')
        .select('name, is_verified')
        .eq('id', counterpartyId)
        .maybeSingle();
      if (card?.name && !headerCounterparty) setHeaderCounterparty(card.name);
      if (card?.is_verified) setCounterpartyVerified(true);

      const msgs = await listMarketMessages(t.id);
      setMessages(msgs);

      // Clear unread state for the current side.
      await markMarketThreadRead(t.id);

      channelRef.current = subscribeMarketMessages(t.id, (m) => {
        setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
        // Mark every inbound message read on arrival while we're on the
        // thread screen — keeps the inbox unread badge honest.
        if (m.sender_id !== user.id) {
          markMarketThreadRead(t!.id).catch(() => undefined);
        }
      });
    } catch (e: any) {
      Alert.alert(
        isRTL ? 'تعذّر فتح المحادثة' : 'Could not open chat',
        e?.message ?? String(e)
      );
    } finally {
      setLoading(false);
    }
  }, [
    user?.id,
    params.threadId,
    params.listingId,
    params.sellerId,
    isRTL,
    headerCounterparty,
    router,
  ]);

  useEffect(() => {
    open();
    return () => {
      if (typeof channelRef.current === 'function') {
        channelRef.current();
        channelRef.current = null;
      }
    };
  }, [open]);

  useEffect(() => {
    if (messages.length === 0) return;
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
  }, [messages.length]);

  const handleSend = async () => {
    if (!user?.id || !thread || !input.trim()) return;
    const text = input.trim();
    if (text.length > 4000) {
      Alert.alert(
        isRTL ? 'الرسالة طويلة' : 'Message too long',
        isRTL ? 'الحد الأقصى 4000 حرف.' : 'Maximum 4000 characters.'
      );
      return;
    }
    setInput('');
    setSending(true);
    try {
      const m = await sendMarketMessage(thread.id, user.id, text);
      setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
    } catch (e: any) {
      setInput(text);
      Alert.alert(isRTL ? 'فشل الإرسال' : 'Send failed', e?.message ?? String(e));
    } finally {
      setSending(false);
    }
  };

  const styles = useMemo(() => makeStyles(COLORS, isRTL), [COLORS, isRTL]);

  const counterpartyLabel =
    headerCounterparty?.trim() ||
    (isRTL ? 'محادثة السوق' : 'Marketplace chat');

  // Listing id we can route the header tap to. Prefer the param (sent by the
  // entry point) and fall back to the thread row once it's loaded — covers
  // the inbox-entry case where the caller only passes threadId.
  const effectiveListingId = params.listingId || thread?.listing_id || '';

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <RTLIonicon name="chevron-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.headerCenter}
          activeOpacity={0.7}
          disabled={!effectiveListingId}
          onPress={() => {
            if (effectiveListingId) {
              router.push({ pathname: '/market-detail', params: { id: effectiveListingId } });
            }
          }}
          accessibilityRole="button"
          accessibilityLabel={isRTL ? 'فتح صفحة الإعلان' : 'Open listing'}
        >
          <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 4 }}>
            <Text numberOfLines={1} style={styles.title}>
              {counterpartyLabel}
            </Text>
            {counterpartyVerified ? <VerifiedBadge size="md" /> : null}
          </View>
          {!!params.listingTitle && (
            <Text numberOfLines={1} style={styles.subtitle}>
              {params.listingTitle}
            </Text>
          )}
        </TouchableOpacity>
        {params.listingImage ? (
          <TouchableOpacity
            activeOpacity={0.85}
            disabled={!effectiveListingId}
            onPress={() => {
              if (effectiveListingId) {
                router.push({ pathname: '/market-detail', params: { id: effectiveListingId } });
              }
            }}
            accessibilityRole="button"
            accessibilityLabel={isRTL ? 'فتح صفحة الإعلان' : 'Open listing'}
          >
            <Image source={{ uri: params.listingImage }} style={styles.headerThumb} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 36 }} />
        )}
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        // iOS pads above the keyboard; Android relies on adjustResize
        // (app.json softwareKeyboardLayoutMode: "resize"). 'height' fought
        // adjustResize and could leave the composer covered.
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
      >
        {loading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color={COLORS.primary} />
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.id}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            contentContainerStyle={{ padding: SPACING.md, flexGrow: 1 }}
            ListHeaderComponent={
              <View style={styles.safetyNote}>
                <Ionicons name="shield-checkmark-outline" size={15} color={COLORS.primary} />
                <Text style={styles.safetyText}>
                  {isRTL
                    ? 'للأمان: عايِن الجهاز قبل الدفع وقابل البائع في مكان عام. المنصّة وسيط ربط فقط ولا تتدخّل في الدفع.'
                    : 'Stay safe: inspect before you pay and meet in a public place. The platform only connects you — it never handles payment.'}
                </Text>
              </View>
            }
            ListEmptyComponent={
              <View style={styles.emptyMessages}>
                <Text style={styles.emptyMessagesTitle}>
                  {isRTL ? 'ابدأ المحادثة' : 'Start the conversation'}
                </Text>
                <Text style={styles.emptyMessagesBody}>
                  {isRTL
                    ? 'اسأل عن حالة الجهاز، السعر القابل للتفاوض، أو موعد الاستلام.'
                    : 'Ask about condition, price, or pickup time.'}
                </Text>
              </View>
            }
            renderItem={({ item }) => {
              const mine = item.sender_id === user?.id;
              return (
                <View
                  style={[
                    styles.msgRow,
                    {
                      justifyContent: mine
                        ? isRTL
                          ? 'flex-start'
                          : 'flex-end'
                        : isRTL
                          ? 'flex-end'
                          : 'flex-start',
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.bubble,
                      mine
                        ? { backgroundColor: COLORS.primary }
                        : {
                            backgroundColor: COLORS.card,
                            borderColor: COLORS.border,
                            borderWidth: 1,
                          },
                    ]}
                  >
                    <Text
                      style={{
                        color: mine ? '#fff' : COLORS.text,
                        fontSize: 14,
                        lineHeight: 20,
                        textAlign: isRTL ? 'right' : 'left',
                        writingDirection: isRTL ? 'rtl' : 'ltr',
                      }}
                    >
                      {item.content}
                    </Text>
                    <Text
                      style={{
                        color: mine ? '#ffffffaa' : COLORS.textSecondary,
                        fontSize: 10,
                        marginTop: 4,
                        textAlign: isRTL ? 'left' : 'right',
                        writingDirection: 'ltr',
                      }}
                    >
                      {formatAppTimeOnly(item.created_at, isRTL)}
                    </Text>
                  </View>
                </View>
              );
            }}
          />
        )}

        <View style={[styles.inputBar, { paddingBottom: 10 + insets.bottom }]}>
          <TextInput
            style={[styles.input, { color: COLORS.text, textAlign: isRTL ? 'right' : 'left' }]}
            value={input}
            onChangeText={setInput}
            placeholder={isRTL ? 'اكتب رسالتك...' : 'Type a message...'}
            placeholderTextColor={COLORS.textSecondary}
            multiline
            maxLength={4000}
          />
          <TouchableOpacity
            onPress={handleSend}
            disabled={sending || !input.trim()}
            style={[styles.sendBtn, (sending || !input.trim()) && { opacity: 0.5 }]}
            accessibilityRole="button"
            accessibilityLabel={isRTL ? 'إرسال' : 'Send'}
          >
            {sending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Ionicons name="send" size={18} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (C: any, isRTL: boolean) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    header: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.md,
      backgroundColor: C.card,
      borderBottomWidth: 1,
      borderBottomColor: C.border,
    },
    headerBtn: {
      width: 32,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerCenter: { flex: 1 },
    headerThumb: {
      width: 36,
      height: 36,
      borderRadius: BORDER_RADIUS.sm,
      backgroundColor: C.background,
    },
    title: {
      color: C.text,
      fontWeight: '800',
      fontSize: 16,
      textAlign: isRTL ? 'right' : 'left',
      writingDirection: isRTL ? 'rtl' : 'ltr',
    },
    subtitle: {
      color: C.textSecondary,
      fontSize: 12,
      marginTop: 2,
      textAlign: isRTL ? 'right' : 'left',
      writingDirection: isRTL ? 'rtl' : 'ltr',
    },
    msgRow: { flexDirection: 'row', marginVertical: 4 },
    bubble: {
      maxWidth: '78%',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: BORDER_RADIUS.md,
    },
    inputBar: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'flex-end',
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderTopWidth: 1,
      borderTopColor: C.border,
      backgroundColor: C.card,
    },
    input: {
      flex: 1,
      maxHeight: 100,
      minHeight: 40,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: BORDER_RADIUS.md,
      backgroundColor: C.background,
      borderWidth: 1,
      borderColor: C.border,
      fontSize: 14,
      writingDirection: isRTL ? 'rtl' : 'ltr',
    },
    sendBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: C.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyMessages: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: SPACING.xl,
      gap: 6,
    },
    emptyMessagesTitle: {
      color: C.text,
      fontWeight: '800',
      fontSize: 15,
      textAlign: 'center',
    },
    emptyMessagesBody: {
      color: C.textSecondary,
      fontSize: 13,
      textAlign: 'center',
      lineHeight: 19,
    },
    safetyNote: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: C.primary + '10',
      borderWidth: 1,
      borderColor: C.primary + '22',
      borderRadius: BORDER_RADIUS.md,
      paddingHorizontal: 12,
      paddingVertical: 10,
      marginBottom: SPACING.md,
    },
    safetyText: {
      flex: 1,
      color: C.textSecondary,
      fontSize: 11.5,
      lineHeight: 17,
      fontWeight: '600',
      textAlign: isRTL ? 'right' : 'left',
    },
  });
