import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { getColors, SPACING } from '../../constants/theme';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import { RTLIonicon } from '../../components/RTLIcon';
import { safeBack } from '../../utils/navigation';
import { getInputDirection } from '../../utils/rtl';
import { formatAppTimeOnly } from '../../lib/formatDate';
import { logger } from '../../utils/logger';
import {
  getDeliveryTaskById,
  deliveryLegLabel,
  type DeliveryTask,
} from '../../services/courierService';
import {
  getCourierChatMessages,
  sendCourierChatMessage,
  markCourierChatRead,
  subscribeToCourierChat,
  isCourierChatOpen,
  type CourierChatMessage,
  type CourierChatThread,
} from '../../services/courierChatService';
import {
  isCourierChatThread,
  partyPhone,
  partyName,
  threadCounterpartLabel,
} from '../../utils/courierChatThreads';
import { supabase } from '../../services/supabaseClient';
import GearLoader from '../../components/GearLoader';
import {
  CHAT_BUBBLE,
  CHAT_BUBBLE_MAX_WIDTH,
  CHAT_INPUT,
  CHAT_MSG_FONT_SIZE,
  CHAT_SEND_BTN,
  CHAT_TIME_FONT_SIZE,
} from '../../components/chat/chatGeometry';

/**
 * Courier chat, scoped to one delivery task. Two isolated threads live on a
 * task (?thread= param, RLS-partitioned):
 *   technician — courier ↔ the order's technician (default)
 *   customer   — courier ↔ the order's customer
 * Sending is blocked (banner) once the task completes or cancels — enforced
 * server-side by RLS; the UI just mirrors it.
 */
export default function CourierChatScreen() {
  const { taskId, thread: threadParam } = useLocalSearchParams<{ taskId: string; thread?: string }>();
  const thread: CourierChatThread = isCourierChatThread(threadParam) ? threadParam : 'technician';
  const router = useRouter();
  const { language, isDark } = useApp();
  const { user } = useAuth();
  const COLORS = getColors(isDark);
  const isRTL = language === 'ar';
  const insets = useSafeAreaInsets();

  const [task, setTask] = useState<DeliveryTask | null>(null);
  const [orderInfo, setOrderInfo] = useState<{
    device_brand: string | null;
    device_model: string | null;
    order_number: string | null;
  } | null>(null);
  const [messages, setMessages] = useState<CourierChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const flatListRef = useRef<FlatList>(null);
  const styles = useMemo(() => makeStyles(COLORS, isRTL), [isDark, isRTL]);

  const isCourier = !!user && task?.courier_id === user.id;

  useEffect(() => {
    if (!taskId) return;
    (async () => {
      try {
        const [t, msgs] = await Promise.all([
          getDeliveryTaskById(String(taskId)),
          getCourierChatMessages(String(taskId), thread),
        ]);
        setTask(t);
        setMessages(msgs);
        // Device + order-number context for the chat header. RLS lets the
        // customer/technician read their order; if the courier can't, this
        // simply stays null and the header falls back to the leg label.
        if (t?.order_id) {
          supabase
            .from('orders')
            .select('device_brand, device_model, order_number')
            .eq('id', t.order_id)
            .maybeSingle()
            .then(({ data }) => setOrderInfo(data ?? null));
        }
        if (user?.id) void markCourierChatRead(String(taskId), user.id, thread);
      } catch (e) {
        logger.warn('courier chat load failed', e);
      } finally {
        setLoading(false);
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 80);
      }
    })();

    const cleanup = subscribeToCourierChat(String(taskId), (msg) => {
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
      // The reader is looking at the thread right now — mark incoming
      // messages read immediately so the chats list never shows a phantom
      // unread badge for a conversation that was open. Best-effort.
      if (user?.id && msg.sender_id !== user.id) {
        void markCourierChatRead(String(taskId), user.id, thread);
      }
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 80);
    }, thread);
    return cleanup;
  }, [taskId, user?.id, thread]);

  const chatOpen = !!task && isCourierChatOpen(task.status);

  const handleSend = async () => {
    const content = draft.trim();
    if (!content || !user?.id || !chatOpen) return;
    setDraft('');
    setSending(true);
    try {
      await sendCourierChatMessage(String(taskId), user.id, content, thread);
    } catch (e) {
      logger.warn('courier chat send failed', e);
      setDraft(content);
      Alert.alert(
        isRTL ? 'خطأ' : 'Error',
        isRTL ? 'تعذّر إرسال الرسالة' : 'Could not send the message'
      );
    } finally {
      setSending(false);
    }
  };

  // Dial the counterpart. A lightweight confirm keeps an accidental header tap
  // from silently launching the dialer, and names who's about to be called so
  // the courier always knows whether they're reaching the technician or the
  // customer — the two threads never blur.
  const handleCall = (phone: string) => {
    Alert.alert(
      isRTL ? `الاتصال بـ ${counterpartName}` : `Call ${counterpartName}`,
      phone,
      [
        { text: isRTL ? 'إلغاء' : 'Cancel', style: 'cancel' },
        {
          text: isRTL ? 'اتصال' : 'Call',
          onPress: () => {
            Linking.openURL(`tel:${phone}`).catch((e) =>
              logger.warn('courier call failed', e)
            );
          },
        },
      ]
    );
  };

  // The other party from each side's perspective + their phone for the call
  // shortcut (contact fields were stamped onto the task at creation time).
  // The courier calls the thread's party (customer/technician); the
  // technician/customer call the courier, whose phone is stamped on the task
  // at accept time (courier_contact_phone).
  // The courier sees the actual party name (customer/technician) stamped on
  // the task; the customer/technician always see "Courier".
  const rawPartyName = (isCourier && task ? partyName(task, thread) : null)?.trim() || null;
  const counterpartName = rawPartyName || threadCounterpartLabel(thread, isCourier, isRTL);
  const deviceLabel = orderInfo
    ? [orderInfo.device_brand, orderInfo.device_model].filter(Boolean).join(' ')
    : '';
  const orderRef = orderInfo?.order_number ? `#${orderInfo.order_number}` : '';
  const contextLine = [deviceLabel, orderRef].filter(Boolean).join(' · ');
  const counterpartPhone = task
    ? isCourier
      ? partyPhone(task, thread)
      : task.courier_contact_phone
    : null;

  const renderMessage = ({ item }: { item: CourierChatMessage }) => {
    const isMe = item.sender_id === user?.id;
    return (
      <View
        style={[
          styles.messageRow,
          { justifyContent: isMe ? (isRTL ? 'flex-start' : 'flex-end') : (isRTL ? 'flex-end' : 'flex-start') },
        ]}
      >
        <View
          style={[
            styles.bubble,
            isMe
              ? { backgroundColor: COLORS.primary }
              : { backgroundColor: COLORS.card, borderColor: COLORS.border, borderWidth: 1 },
          ]}
        >
          <Text
            style={{
              color: isMe ? '#fff' : COLORS.text,
              fontSize: CHAT_MSG_FONT_SIZE,
              lineHeight: 21,
              textAlign: isRTL ? 'right' : 'left',
              writingDirection: isRTL ? 'rtl' : 'ltr',
            }}
          >
            {item.content}
          </Text>
          <Text style={{ color: isMe ? '#ffffffaa' : COLORS.textSecondary, fontSize: CHAT_TIME_FONT_SIZE, alignSelf: 'flex-end', marginTop: 4 }}>
            {formatAppTimeOnly(item.created_at, isRTL)}
          </Text>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <GearLoader size={48} />
      </SafeAreaView>
    );
  }

  if (!task) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          <MaterialCommunityIcons name="alert-circle-outline" size={56} color={COLORS.textSecondary} />
          <Text style={{ color: COLORS.textSecondary }}>
            {isRTL ? 'لم يتم العثور على المهمة' : 'Task not found'}
          </Text>
          <TouchableOpacity onPress={() => safeBack()} accessibilityRole="button">
            <Text style={{ color: COLORS.primary, fontWeight: '700' }}>{isRTL ? 'رجوع' : 'Back'}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => safeBack()} style={styles.backBtn} accessibilityRole="button">
          <RTLIonicon name="chevron-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <View style={[styles.headerAvatar, { backgroundColor: COLORS.primary }]}>
            <MaterialCommunityIcons
              name={!isCourier ? 'moped' : thread === 'technician' ? 'account-wrench' : 'account-outline'}
              size={18}
              color="#fff"
            />
          </View>
          <View style={{ flex: 1 }}>
            {/* Courier side: "party name — #order" (order number alone when
                the name is missing); other sides keep the counterpart label. */}
            <Text style={[styles.headerTitle, { color: COLORS.text }]} numberOfLines={1}>
              {isCourier && orderRef
                ? rawPartyName
                  ? `${rawPartyName} — ${orderRef}`
                  : orderRef
                : counterpartName}
            </Text>
            <Text style={[styles.headerSubtitle, { color: COLORS.textSecondary }]} numberOfLines={1}>
              {(isCourier ? deviceLabel : contextLine)
                ? (isCourier ? deviceLabel : contextLine)
                : task.task_type === 'pickup'
                  ? isRTL ? 'مهمة استلام' : 'Pickup task'
                  : isRTL ? 'مهمة إعادة' : 'Return task'}
              {' · '}
              {deliveryLegLabel(task.task_type, task.status)[isRTL ? 'ar' : 'en']}
            </Text>
          </View>
        </View>
        {counterpartPhone && chatOpen ? (
          <TouchableOpacity
            onPress={() => handleCall(counterpartPhone)}
            style={[styles.callBtn, { backgroundColor: COLORS.primary }]}
            accessibilityRole="button"
            accessibilityLabel={
              isRTL ? `اتصال بـ ${counterpartName}` : `Call ${counterpartName}`
            }
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="call" size={17} color="#fff" />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: SPACING.md, paddingBottom: 12 }}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', marginTop: 60, paddingHorizontal: 32 }}>
              <View style={{ width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primary + '15' }}>
                <MaterialCommunityIcons name="truck-check-outline" size={40} color={COLORS.primary} />
              </View>
              <Text style={{ color: COLORS.text, fontWeight: '700', marginTop: 12, fontSize: 16 }}>
                {isRTL ? 'نسّقا التسليم هنا 🤝' : 'Coordinate the hand-over here 🤝'}
              </Text>
              <Text style={{ color: COLORS.textSecondary, marginTop: 6, textAlign: 'center', fontSize: 13 }}>
                {thread === 'technician'
                  ? isRTL
                    ? 'هذه المحادثة بين المندوب والفني فقط، وتُغلق تلقائياً عند اكتمال المهمة.'
                    : 'This chat is between the courier and the technician only, and closes automatically when the task completes.'
                  : isRTL
                    ? 'هذه المحادثة بين المندوب والعميل فقط، وتُغلق تلقائياً عند اكتمال المهمة.'
                    : 'This chat is between the courier and the customer only, and closes automatically when the task completes.'}
              </Text>
            </View>
          }
        />

        {chatOpen ? (
          <View style={[styles.inputBar, { backgroundColor: COLORS.card, borderTopColor: COLORS.border, paddingBottom: 8 + insets.bottom }]}>
            <TextInput
              style={[
                styles.input,
                { color: COLORS.text, backgroundColor: COLORS.background, borderColor: COLORS.border },
                getInputDirection(isRTL),
              ]}
              placeholder={isRTL ? 'اكتب رسالتك...' : 'Type a message...'}
              placeholderTextColor={COLORS.textSecondary}
              value={draft}
              onChangeText={setDraft}
              multiline
              maxLength={2000}
            />
            <TouchableOpacity
              style={[styles.sendBtn, { backgroundColor: COLORS.primary, opacity: !draft.trim() || sending ? 0.5 : 1 }]}
              onPress={handleSend}
              disabled={!draft.trim() || sending}
              accessibilityRole="button"
              accessibilityLabel={isRTL ? 'إرسال' : 'Send'}
            >
              {sending ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="send" size={18} color="#fff" />}
            </TouchableOpacity>
          </View>
        ) : (
          <View style={[styles.lockedBanner, { backgroundColor: COLORS.card, borderTopColor: COLORS.border, paddingBottom: 16 + insets.bottom }]}>
            <Ionicons name="lock-closed" size={16} color={COLORS.textSecondary} />
            <Text style={{ color: COLORS.textSecondary, fontSize: 13.5, fontWeight: '700' }}>
              {task.status === 'cancelled'
                ? isRTL ? 'أُغلقت المحادثة — المهمة ملغاة' : 'Chat closed — task cancelled'
                : task.status === 'available'
                  ? isRTL ? 'تُفتح المحادثة بعد قبول المهمة' : 'Chat opens once the task is accepted'
                  : isRTL ? 'أُغلقت المحادثة — اكتملت المهمة' : 'Chat closed — task completed'}
            </Text>
          </View>
        )}
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
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: C.card,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: C.border,
    },
    backBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: C.background,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerCenter: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      flex: 1,
      gap: 10,
      marginHorizontal: 10,
    },
    headerAvatar: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: { fontSize: 16, fontWeight: '800' },
    headerSubtitle: { fontSize: 12, marginTop: 2 },
    callBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: C.primary,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.28,
      shadowRadius: 5,
      elevation: 3,
    },
    messageRow: { flexDirection: 'row', marginTop: 6 },
    bubble: {
      maxWidth: CHAT_BUBBLE_MAX_WIDTH,
      ...CHAT_BUBBLE,
    },
    inputBar: {
      // Send button always on the RIGHT (user preference), in both languages.
      flexDirection: 'row',
      alignItems: 'flex-end',
      padding: 8,
      gap: 8,
      borderTopWidth: 1,
    },
    lockedBanner: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 16,
      paddingHorizontal: 16,
      borderTopWidth: 1,
    },
    input: {
      ...CHAT_INPUT,
    },
    sendBtn: {
      ...CHAT_SEND_BTN,
    },
  });
