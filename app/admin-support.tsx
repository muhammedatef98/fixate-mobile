import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  FlatList,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { useIsAdmin } from '../hooks/useAdminGuard';
import { usePermissions } from '../hooks/usePermissions';
import { getColors, SPACING, BORDER_RADIUS } from '../constants/theme';
import { RTLIonicon } from '../components/RTLIcon';
import { safeBack } from '../utils/navigation';
import { AnimatedBackButton } from '../components/AnimatedBackButton';
import { adminTimeAgo } from '../components/admin/AdminUI';
import * as support from '../services/supportService';
import { supabase } from '../services/supabaseClient';
import { useScrollToEndOnKeyboard } from '../hooks/useScrollToEndOnKeyboard';

type ThreadView = support.AdminThread;

const STATUS_META = (s: support.SupportStatus | undefined, isRTL: boolean) => {
  switch (s) {
    case 'assigned':
      return { label: isRTL ? 'قيد المعالجة' : 'Assigned', color: '#3b82f6', icon: 'account-check' as const };
    case 'closed':
      return { label: isRTL ? 'مغلقة' : 'Closed', color: '#9CA3AF', icon: 'check-circle' as const };
    default:
      return { label: isRTL ? 'بانتظار الرد' : 'Waiting', color: '#F59E0B', icon: 'clock-outline' as const };
  }
};

export default function AdminSupportScreen() {
  const router = useRouter();
  const { language, isDark } = useApp();
  const { user, userProfile } = useAuth();
  const COLORS = getColors(isDark);
  const isRTL = language === 'ar';

  const { isAdmin, checking: adminChecking } = useIsAdmin();
  const { can, loading: permLoading } = usePermissions();
  const allowed = isAdmin || can('support_management');
  const [statusFilter, setStatusFilter] = useState<support.ThreadFilter>('waiting');
  const [threads, setThreads] = useState<ThreadView[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [active, setActive] = useState<ThreadView | null>(null);
  const [messages, setMessages] = useState<support.SupportMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList>(null);
  useScrollToEndOnKeyboard(listRef);
  const messagesChannelRef = useRef<any>(null);

  const loadThreads = async (status: support.ThreadFilter = statusFilter) => {
    try {
      const data = await support.listAllThreads({ status });
      setThreads(data as any);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!allowed) return;
    // Opportunistic auto-close of idle threads each time admin opens the
    // inbox. The DB-side cron job is authoritative; this just keeps the
    // list tidy in real time even without cron configured.
    support.closeIdleThreads(5).catch(() => {});
    loadThreads(statusFilter);
    // subscribeAllThreads now returns its own cleanup callable.
    return support.subscribeAllThreads(() => loadThreads(statusFilter));
  }, [allowed, statusFilter]);

  const assignToMe = async () => {
    if (!active) return;
    try {
      await support.assignThread(active.id);
      setActive((prev) => (prev ? { ...prev, status: 'assigned', assigned_admin_id: user?.id, assigned_admin_name: userProfile?.name } : prev));
      loadThreads(statusFilter);
    } catch {
      Alert.alert(isRTL ? 'خطأ' : 'Error', isRTL ? 'تعذّر الإسناد' : 'Could not assign');
    }
  };

  const openThread = async (t: ThreadView) => {
    setActive(t);
    setMessages([]);
    try {
      const msgs = await support.getMessages(t.id);
      setMessages(msgs);
      await support.markRead(t.id, true);
    } catch {}
    // `messagesChannelRef.current` is now the cleanup function from
    // subscribeMessages. Detach any previous listener by calling its
    // cleanup before attaching the next one.
    if (typeof messagesChannelRef.current === 'function') messagesChannelRef.current();
    messagesChannelRef.current = support.subscribeMessages(t.id, (m) => {
      setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
    });
  };

  const leaveThread = () => {
    if (typeof messagesChannelRef.current === 'function') messagesChannelRef.current();
    messagesChannelRef.current = null;
    setActive(null);
    setMessages([]);
  };

  const handleCloseThread = () => {
    if (!active) return;
    Alert.alert(
      isRTL ? 'إغلاق المحادثة' : 'Close chat',
      isRTL ? 'سيتم نقلها إلى قائمة المحادثات المغلقة. هل أنت متأكد؟' : 'It will move to the Closed list. Are you sure?',
      [
        { text: isRTL ? 'إلغاء' : 'Cancel', style: 'cancel' },
        {
          text: isRTL ? 'إغلاق' : 'Close',
          style: 'destructive',
          onPress: async () => {
            try {
              await support.closeThread(active.id, 'admin_manual');
              leaveThread();
              loadThreads(statusFilter);
            } catch {
              Alert.alert(isRTL ? 'خطأ' : 'Error', isRTL ? 'تعذّر الإغلاق' : 'Could not close');
            }
          },
        },
      ],
    );
  };

  const send = async () => {
    if (!user?.id || !active || !input.trim()) return;
    const text = input.trim();
    setInput('');
    setSending(true);
    try {
      const m = await support.sendMessage(active.id, user.id, true, text);
      setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
    } catch (e: any) {
      setInput(text);
      Alert.alert(isRTL ? 'خطأ' : 'Error', isRTL ? 'تعذّر الإرسال' : 'Could not send');
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
    }
  }, [messages.length]);

  const styles = makeStyles(COLORS, isRTL);

  if (adminChecking || permLoading) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={COLORS.primary} size="large" />
      </SafeAreaView>
    );
  }
  if (!allowed) {
    return (
      <SafeAreaView style={[styles.container, { padding: 32, alignItems: 'center', justifyContent: 'center' }]}>
        <MaterialCommunityIcons name="shield-alert-outline" size={64} color="#ef4444" />
        <Text style={{ color: COLORS.text, fontSize: 18, fontWeight: '700', marginTop: 12 }}>
          {isRTL ? 'غير مصرّح' : 'Unauthorized'}
        </Text>
      </SafeAreaView>
    );
  }

  // Thread list view
  if (!active) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <View style={styles.header}>
          <AnimatedBackButton
            onPress={() => safeBack('/admin')}
            color={COLORS.text}
            backgroundColor={COLORS.surface ?? COLORS.background}
            size={42}
            iconSize={22}
            rtl
          />
          <Text style={[styles.title, { color: COLORS.text }]}>
            {isRTL ? 'صندوق الدعم' : 'Support inbox'}
          </Text>
          <View style={{ width: 32 }} />
        </View>

        <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', paddingHorizontal: SPACING.md, paddingTop: 6, gap: 8 }}>
          {(['waiting', 'assigned', 'closed', 'all'] as const).map((s) => {
            const active = statusFilter === s;
            const label =
              s === 'waiting' ? (isRTL ? 'بانتظار الرد' : 'Waiting')
              : s === 'assigned' ? (isRTL ? 'قيد المعالجة' : 'Assigned')
              : s === 'closed' ? (isRTL ? 'مغلقة' : 'Closed')
              : (isRTL ? 'الكل' : 'All');
            return (
              <TouchableOpacity
                key={s}
                onPress={() => { setStatusFilter(s); setLoading(true); }}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderRadius: 999,
                  backgroundColor: active ? COLORS.primary : COLORS.card,
                  borderWidth: 1,
                  borderColor: active ? COLORS.primary : COLORS.border,
                }}
              >
                <Text style={{ color: active ? '#fff' : COLORS.text, fontWeight: '700', fontSize: 12 }}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {loading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : threads.length === 0 ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
            <View style={{ width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primary + '15' }}>
              <MaterialCommunityIcons name="forum-outline" size={40} color={COLORS.primary} />
            </View>
            <Text style={{ color: COLORS.text, fontWeight: '700', marginTop: 12, fontSize: 16 }}>
              {isRTL ? 'لا توجد محادثات بعد' : 'No conversations yet'}
            </Text>
            <Text style={{ color: COLORS.textSecondary, marginTop: 6, textAlign: 'center' }}>
              {isRTL ? 'ستظهر هنا عندما يبدأ العملاء بمراسلتك' : 'They appear here when customers reach out'}
            </Text>
          </View>
        ) : (
          <FlatList
            data={threads}
            keyExtractor={(t) => t.id}
            contentContainerStyle={{ padding: SPACING.md }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => { setRefreshing(true); loadThreads(); }}
                tintColor={COLORS.primary}
              />
            }
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => openThread(item)}
                style={[
                  styles.threadRow,
                  {
                    backgroundColor: COLORS.card,
                    borderColor: item.unread_for_admin ? COLORS.primary : COLORS.border,
                    borderWidth: item.unread_for_admin ? 2 : 1,
                  },
                ]}
              >
                <View style={[styles.avatar, { backgroundColor: COLORS.primary }]}>
                  <Text style={{ color: '#fff', fontWeight: '800' }}>
                    {(item.user_name?.[0] ?? item.user_email?.[0] ?? '?').toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1, marginHorizontal: 12 }}>
                  <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={{ color: COLORS.text, fontWeight: '700', fontSize: 14 }} numberOfLines={1}>
                      {item.user_name || item.user_email || 'User'}
                    </Text>
                    <Text style={{ color: COLORS.textSecondary, fontSize: 11 }}>
                      {adminTimeAgo(item.last_message_at, isRTL)}
                    </Text>
                  </View>
                  <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                    {(() => {
                      const m = STATUS_META(item.status, isRTL);
                      return (
                        <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 3, backgroundColor: m.color + '1A', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 }}>
                          <MaterialCommunityIcons name={m.icon} size={11} color={m.color} />
                          <Text style={{ color: m.color, fontSize: 10, fontWeight: '800' }}>{m.label}</Text>
                        </View>
                      );
                    })()}
                    {!!item.assigned_admin_name && (
                      <Text style={{ color: COLORS.textSecondary, fontSize: 11 }} numberOfLines={1}>
                        {isRTL ? `لدى ${item.assigned_admin_name}` : `by ${item.assigned_admin_name}`}
                      </Text>
                    )}
                  </View>
                </View>
                {item.unread_for_admin && (
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.primary }} />
                )}
              </TouchableOpacity>
            )}
          />
        )}
      </SafeAreaView>
    );
  }

  // Active thread chat view
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <View style={styles.header}>
        <AnimatedBackButton
          onPress={leaveThread}
          color={COLORS.text}
          backgroundColor={COLORS.surface ?? COLORS.background}
          size={42}
          iconSize={22}
          rtl
        />
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={[styles.title, { color: COLORS.text }]} numberOfLines={1}>
            {active.user_name || active.user_email || 'User'}
          </Text>
          <Text style={{ color: COLORS.textSecondary, fontSize: 11, marginTop: 2 }} numberOfLines={1}>
            {active.assigned_admin_name
              ? (isRTL ? `قيد المعالجة لدى ${active.assigned_admin_name}` : `Assigned to ${active.assigned_admin_name}`)
              : (isRTL ? 'بانتظار رد موظف' : 'Waiting for an agent')}
          </Text>
        </View>
        <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 4 }}>
          {active.status !== 'closed' && active.assigned_admin_id !== user?.id && (
            <TouchableOpacity
              onPress={assignToMe}
              accessibilityRole="button"
              accessibilityLabel={isRTL ? 'إسناد لي' : 'Assign to me'}
              style={{ padding: 6 }}
            >
              <MaterialCommunityIcons name="account-arrow-down-outline" size={22} color={COLORS.primary} />
            </TouchableOpacity>
          )}
          {active.status !== 'closed' && (
            <TouchableOpacity
              onPress={handleCloseThread}
              accessibilityRole="button"
              accessibilityLabel={isRTL ? 'إغلاق المحادثة' : 'Close chat'}
              style={{ padding: 6 }}
            >
              <MaterialCommunityIcons name="archive-arrow-down-outline" size={22} color={COLORS.text} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {active.status === 'closed' && (
        <View style={{ padding: 10, backgroundColor: COLORS.card, borderBottomWidth: 1, borderBottomColor: COLORS.border }}>
          <Text style={{ color: COLORS.textSecondary, textAlign: 'center', fontSize: 12 }}>
            {isRTL ? 'هذه المحادثة مغلقة. أي رسالة جديدة ستفتحها تلقائياً.' : 'This chat is closed. Any new message will re-open it.'}
          </Text>
        </View>
      )}

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: SPACING.md }}
          renderItem={({ item }) => {
            if (item.is_system) {
              return (
                <View style={{ alignItems: 'center', marginVertical: 8 }}>
                  <View style={{ maxWidth: '88%', backgroundColor: COLORS.primary + '12', borderRadius: 12, paddingVertical: 8, paddingHorizontal: 12, flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'flex-start', gap: 6 }}>
                    <MaterialCommunityIcons name="robot-happy-outline" size={14} color={COLORS.primary} style={{ marginTop: 2 }} />
                    <Text style={{ color: COLORS.textSecondary, fontSize: 12, lineHeight: 18, flexShrink: 1, textAlign: isRTL ? 'right' : 'left', writingDirection: isRTL ? 'rtl' : 'ltr' }}>
                      {item.content}
                    </Text>
                  </View>
                </View>
              );
            }
            const mine = item.is_admin;
            return (
              <View style={[styles.msgRow, { justifyContent: mine ? (isRTL ? 'flex-start' : 'flex-end') : (isRTL ? 'flex-end' : 'flex-start') }]}>
                <View style={[
                  styles.bubble,
                  mine
                    ? { backgroundColor: COLORS.primary, borderBottomRightRadius: 4 }
                    : { backgroundColor: COLORS.card, borderColor: COLORS.border, borderWidth: 1, borderBottomLeftRadius: 4 },
                ]}>
                  <Text style={{ color: mine ? '#fff' : COLORS.text, fontSize: 14, lineHeight: 20, textAlign: isRTL ? 'right' : 'left', writingDirection: isRTL ? 'rtl' : 'ltr' }}>
                    {item.content}
                  </Text>
                  <Text style={{ color: mine ? '#ffffffaa' : COLORS.textSecondary, fontSize: 10, marginTop: 4, textAlign: isRTL ? 'left' : 'right' }}>
                    {new Date(item.created_at).toLocaleTimeString(language === 'ar' ? 'ar' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
              </View>
            );
          }}
        />

        <View style={[styles.inputBar, { backgroundColor: COLORS.card, borderTopColor: COLORS.border }]}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder={isRTL ? 'اكتب ردّك...' : 'Type a reply...'}
            placeholderTextColor={COLORS.textSecondary}
            style={[styles.input, { color: COLORS.text, backgroundColor: COLORS.background, borderColor: COLORS.border }]}
            textAlign={isRTL ? 'right' : 'left'}
            multiline
            maxLength={2000}
          />
          <TouchableOpacity
            onPress={send}
            disabled={!input.trim() || sending}
            style={[styles.sendBtn, { backgroundColor: COLORS.primary, opacity: !input.trim() || sending ? 0.5 : 1 }]}
          >
            {sending ? <ActivityIndicator color="#fff" /> : <Ionicons name="send" size={18} color="#fff" />}
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
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: C.background,
    },
    title: { fontSize: 22, fontWeight: '800' },
    threadRow: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      backgroundColor: C.card,
      padding: 16,
      borderRadius: BORDER_RADIUS.md,
      marginBottom: 10,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 2,
    },
    avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
    msgRow: { flexDirection: 'row', marginVertical: 4 },
    bubble: { maxWidth: '78%', borderRadius: 16, paddingVertical: 8, paddingHorizontal: 12 },
    inputBar: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'flex-end',
      padding: 8,
      gap: 8,
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
