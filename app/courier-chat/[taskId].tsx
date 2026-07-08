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
import { getColors, BORDER_RADIUS, SPACING } from '../../constants/theme';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import { RTLIonicon } from '../../components/RTLIcon';
import { safeBack } from '../../utils/navigation';
import { getInputDirection } from '../../utils/rtl';
import { formatAppTimeOnly } from '../../lib/formatDate';
import { logger } from '../../utils/logger';
import {
  getDeliveryTaskById,
  DELIVERY_STATUS_LABELS,
  type DeliveryTask,
} from '../../services/courierService';
import {
  getCourierChatMessages,
  sendCourierChatMessage,
  markCourierChatRead,
  subscribeToCourierChat,
  isCourierChatOpen,
  type CourierChatMessage,
} from '../../services/courierChatService';

/**
 * Courier ↔ technician operational chat, scoped to one delivery task. The
 * customer is never part of this conversation. Sending is blocked (banner)
 * once the task completes or cancels — enforced server-side by RLS; the UI
 * just mirrors it.
 */
export default function CourierChatScreen() {
  const { taskId } = useLocalSearchParams();
  const router = useRouter();
  const { language, isDark } = useApp();
  const { user } = useAuth();
  const COLORS = getColors(isDark);
  const isRTL = language === 'ar';
  const insets = useSafeAreaInsets();

  const [task, setTask] = useState<DeliveryTask | null>(null);
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
          getCourierChatMessages(String(taskId)),
        ]);
        setTask(t);
        setMessages(msgs);
        if (user?.id) void markCourierChatRead(String(taskId), user.id);
      } catch (e) {
        logger.warn('courier chat load failed', e);
      } finally {
        setLoading(false);
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 80);
      }
    })();

    const cleanup = subscribeToCourierChat(String(taskId), (msg) => {
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 80);
    });
    return cleanup;
  }, [taskId, user?.id]);

  const chatOpen = !!task && isCourierChatOpen(task.status);

  const handleSend = async () => {
    const content = draft.trim();
    if (!content || !user?.id || !chatOpen) return;
    setDraft('');
    setSending(true);
    try {
      await sendCourierChatMessage(String(taskId), user.id, content);
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

  // The other party from each side's perspective + their phone for the call
  // shortcut (contact fields were stamped onto the task at creation time).
  const counterpartName = isCourier
    ? isRTL ? 'الفني' : 'Technician'
    : isRTL ? 'مندوب التوصيل' : 'Courier';
  const counterpartPhone = isCourier
    ? (task?.task_type === 'pickup' ? task?.dropoff_contact_phone : task?.pickup_contact_phone)
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
              fontSize: 14,
              lineHeight: 20,
              textAlign: isRTL ? 'right' : 'left',
              writingDirection: isRTL ? 'rtl' : 'ltr',
            }}
          >
            {item.content}
          </Text>
          <Text style={{ color: isMe ? '#ffffffaa' : COLORS.textSecondary, fontSize: 10, alignSelf: 'flex-end', marginTop: 4 }}>
            {formatAppTimeOnly(item.created_at, isRTL)}
          </Text>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
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
            <MaterialCommunityIcons name={isCourier ? 'account-wrench' : 'moped'} size={18} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerTitle, { color: COLORS.text }]} numberOfLines={1}>
              {counterpartName}
            </Text>
            <Text style={[styles.headerSubtitle, { color: COLORS.textSecondary }]} numberOfLines={1}>
              {task.task_type === 'pickup'
                ? isRTL ? 'مهمة استلام' : 'Pickup task'
                : isRTL ? 'مهمة إعادة' : 'Return task'}
              {' · '}
              {DELIVERY_STATUS_LABELS[task.status]?.[isRTL ? 'ar' : 'en'] ?? task.status}
            </Text>
          </View>
        </View>
        {counterpartPhone && chatOpen ? (
          <TouchableOpacity
            onPress={() => Linking.openURL(`tel:${counterpartPhone}`)}
            style={[styles.callBtn, { backgroundColor: COLORS.primary + '15' }]}
            accessibilityRole="button"
            accessibilityLabel={isRTL ? 'اتصال' : 'Call'}
          >
            <Ionicons name="call" size={18} color={COLORS.primary} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 36 }} />
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
                {isRTL
                  ? 'هذه المحادثة بين المندوب والفني فقط، وتُغلق تلقائياً عند اكتمال المهمة.'
                  : 'This chat is between the courier and the technician only, and closes automatically when the task completes.'}
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
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    messageRow: { flexDirection: 'row', marginTop: 6 },
    bubble: {
      maxWidth: '76%',
      borderRadius: 18,
      paddingVertical: 8,
      paddingHorizontal: 12,
    },
    inputBar: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
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
      flex: 1,
      borderWidth: 1,
      borderRadius: BORDER_RADIUS.lg,
      paddingHorizontal: 16,
      paddingVertical: 12,
      minHeight: 44,
      maxHeight: 140,
      fontSize: 15,
    },
    sendBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
