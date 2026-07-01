import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { getColors, SPACING, BORDER_RADIUS } from '../constants/theme';
import { RTLIonicon } from '../components/RTLIcon';
import { safeBack } from '../utils/navigation';
import * as support from '../services/supportService';
import { supabase } from '../services/supabaseClient';
import { useScrollToEndOnKeyboard } from '../hooks/useScrollToEndOnKeyboard';
import { formatAppTimeOnly } from '../lib/formatDate';
import { getInputDirection } from '../utils/rtl';

export default function SupportChatScreen() {
  const router = useRouter();
  const { language, isDark } = useApp();
  const { user } = useAuth();
  const COLORS = getColors(isDark);
  const isRTL = language === 'ar';

  const [thread, setThread] = useState<support.SupportThread | null>(null);
  const [messages, setMessages] = useState<support.SupportMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList>(null);
  const insets = useSafeAreaInsets();
  useScrollToEndOnKeyboard(listRef);

  useEffect(() => {
    if (!user?.id) {
      router.replace('/login-otp');
      return;
    }
    let channel: any;
    (async () => {
      try {
        const t = await support.getOrCreateMyThread(user.id);
        setThread(t);
        const msgs = await support.getMessages(t.id);
        setMessages(msgs);
        await support.markRead(t.id, false);
        channel = support.subscribeMessages(t.id, (m) => {
          setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
          if (m.is_admin) support.markRead(t.id, false).catch(() => undefined);
        });
      } catch (e: any) {
        Alert.alert(
          isRTL ? 'خطأ' : 'Error',
          isRTL ? 'تعذّر فتح المحادثة' : 'Could not open the chat'
        );
      } finally {
        setLoading(false);
      }
    })();
    return () => {
      // `channel` is now the cleanup function returned by
      // subscribeMessages — call it directly.
      if (typeof channel === 'function') channel();
    };
  }, [user?.id]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
    }
  }, [messages.length]);

  const send = async () => {
    if (!user?.id || !thread || !input.trim()) return;
    const text = input.trim();
    setInput('');
    setSending(true);
    try {
      const m = await support.sendMessage(thread.id, user.id, false, text);
      setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
    } catch (e: any) {
      setInput(text); // restore on failure
      Alert.alert(isRTL ? 'خطأ' : 'Error', isRTL ? 'تعذّر إرسال الرسالة' : 'Could not send message');
    } finally {
      setSending(false);
    }
  };

  // Memoize so we don't rebuild the StyleSheet on every keystroke re-render.
  const styles = useMemo(() => makeStyles(COLORS, isRTL), [isDark, isRTL]);

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => safeBack('/(customer)')} style={{ padding: 6 }}>
          <RTLIonicon name="chevron-back" size={26} color={COLORS.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={[styles.title, { color: COLORS.text }]}>
            {isRTL ? 'الدعم الفني' : 'Customer Support'}
          </Text>
          <Text style={{ color: COLORS.textSecondary, fontSize: 11, marginTop: 2 }}>
            {isRTL ? 'سيرد عليك فريقنا في أقرب وقت' : "We'll reply as soon as we can"}
          </Text>
        </View>
        <View style={{ width: 32 }} />
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={COLORS.primary} />
        </View>
      ) : (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          // iOS: pad above the keyboard. Android: rely on the window's
          // adjustResize (app.json softwareKeyboardLayoutMode: "resize") so the
          // composer is lifted by the OS. 'height' here fought adjustResize and
          // left the input covered.
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
        >
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.id}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: SPACING.md, paddingBottom: 12 }}
            ListEmptyComponent={
              <View style={{ alignItems: 'center', marginTop: 60 }}>
                <View style={{ width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primary + '15' }}>
                  <MaterialCommunityIcons name="chat-question" size={40} color={COLORS.primary} />
                </View>
                <Text style={{ color: COLORS.text, fontWeight: '700', marginTop: 12, fontSize: 16 }}>
                  {isRTL ? 'مرحباً بك 👋' : 'Welcome 👋'}
                </Text>
                <Text style={{ color: COLORS.textSecondary, marginTop: 6, textAlign: 'center', paddingHorizontal: 32 }}>
                  {isRTL
                    ? 'كيف نقدر نساعدك؟ اكتب رسالتك وسيرد عليك فريق الدعم خلال دقائق.'
                    : 'How can we help? Write a message and our support team will reply within minutes.'}
                </Text>
              </View>
            }
            renderItem={({ item }) => {
              const mine = !item.is_admin;
              return (
                <View style={[styles.msgRow, { justifyContent: mine ? 'flex-end' : 'flex-start' }]}>
                  <View style={[
                    styles.bubble,
                    mine
                      ? { backgroundColor: COLORS.primary, borderBottomRightRadius: 4 }
                      : { backgroundColor: COLORS.card, borderColor: COLORS.border, borderWidth: 1, borderBottomLeftRadius: 4 },
                  ]}>
                    {!mine && (
                      <Text style={{ color: COLORS.primary, fontSize: 11, fontWeight: '700', marginBottom: 2 }}>
                        {isRTL ? 'الدعم' : 'Support'}
                      </Text>
                    )}
                    <Text style={{ color: mine ? '#fff' : COLORS.text, fontSize: 14, lineHeight: 20, textAlign: isRTL ? 'right' : 'left', writingDirection: isRTL ? 'rtl' : 'ltr' }}>
                      {item.content}
                    </Text>
                    <Text style={{ color: mine ? '#ffffffaa' : COLORS.textSecondary, fontSize: 10, marginTop: 4, textAlign: isRTL ? 'left' : 'right' }}>
                      {formatAppTimeOnly(item.created_at, isRTL)}
                    </Text>
                  </View>
                </View>
              );
            }}
          />

          <View style={[styles.inputBar, { backgroundColor: COLORS.card, borderTopColor: COLORS.border, paddingBottom: 8 + insets.bottom }]}>
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder={isRTL ? 'اكتب رسالتك...' : 'Type a message...'}
              placeholderTextColor={COLORS.textSecondary}
              style={[
                styles.input,
                { color: COLORS.text, backgroundColor: COLORS.background, borderColor: COLORS.border },
                getInputDirection(isRTL),
              ]}
              multiline
              maxLength={2000}
            />
            <TouchableOpacity
              onPress={send}
              disabled={!input.trim() || sending}
              style={[styles.sendBtn, { backgroundColor: COLORS.primary, opacity: !input.trim() || sending ? 0.5 : 1 }]}
              accessibilityRole="button"
              accessibilityLabel={isRTL ? 'إرسال' : 'Send'}
            >
              {sending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Ionicons name={isRTL ? 'send' : 'send'} size={18} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}
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
      paddingVertical: 10,
      backgroundColor: C.card,
      borderBottomWidth: 1,
      borderBottomColor: C.border,
    },
    title: { fontSize: 17, fontWeight: '700' },
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
      paddingHorizontal: 14,
      paddingTop: 10,
      paddingBottom: 10,
      maxHeight: 140,
      fontSize: 14,
    },
    sendBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
