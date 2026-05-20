import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  FlatList,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { getColors, SPACING, BORDER_RADIUS } from '../constants/theme';
import { RTLIonicon } from '../components/RTLIcon';
import {
  getOrCreateMarketThread,
  listMarketMessages,
  sendMarketMessage,
  subscribeMarketMessages,
  type MarketMessage,
  type MarketThread,
} from '../services/marketService';
import { supabase } from '../services/supabaseClient';

export default function MarketChatScreen() {
  const router = useRouter();
  const { listingId, sellerId } = useLocalSearchParams<{ listingId: string; sellerId: string }>();
  const { language, isDark } = useApp();
  const { user } = useAuth();
  const COLORS = getColors(isDark);
  const isRTL = language === 'ar';

  const [thread, setThread] = useState<MarketThread | null>(null);
  const [messages, setMessages] = useState<MarketMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList<MarketMessage>>(null);
  const channelRef = useRef<any>(null);

  const open = useCallback(async () => {
    if (!user?.id || !listingId || !sellerId) return;
    try {
      const t = await getOrCreateMarketThread(listingId, user.id, sellerId);
      setThread(t);
      const msgs = await listMarketMessages(t.id);
      setMessages(msgs);
      channelRef.current = subscribeMarketMessages(t.id, (m) => {
        setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
      });
    } catch (e: any) {
      Alert.alert(isRTL ? 'تعذّر فتح المحادثة' : 'Could not open chat', e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }, [user?.id, listingId, sellerId, isRTL]);

  useEffect(() => {
    open();
    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, [open]);

  useEffect(() => {
    if (messages.length === 0) return;
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
  }, [messages.length]);

  const handleSend = async () => {
    if (!user?.id || !thread || !input.trim()) return;
    const text = input.trim();
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

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
          <RTLIonicon name="chevron-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{isRTL ? 'مراسلة البائع' : 'Chat with seller'}</Text>
        <View style={{ width: 32 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={80}
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
            contentContainerStyle={{ padding: SPACING.md }}
            renderItem={({ item }) => {
              const mine = item.sender_id === user?.id;
              return (
                <View style={[styles.msgRow, { justifyContent: mine ? (isRTL ? 'flex-start' : 'flex-end') : (isRTL ? 'flex-end' : 'flex-start') }]}>
                  <View style={[
                    styles.bubble,
                    mine
                      ? { backgroundColor: COLORS.primary }
                      : { backgroundColor: COLORS.card, borderColor: COLORS.border, borderWidth: 1 },
                  ]}>
                    <Text style={{ color: mine ? '#fff' : COLORS.text, fontSize: 14, lineHeight: 20 }}>
                      {item.content}
                    </Text>
                    <Text style={{ color: mine ? '#ffffffaa' : COLORS.textSecondary, fontSize: 10, marginTop: 4, textAlign: isRTL ? 'left' : 'right' }}>
                      {new Date(item.created_at).toLocaleTimeString(isRTL ? 'ar-SA' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                </View>
              );
            }}
          />
        )}

        <View style={styles.inputBar}>
          <TextInput
            style={[styles.input, { color: COLORS.text, textAlign: isRTL ? 'right' : 'left' }]}
            value={input}
            onChangeText={setInput}
            placeholder={isRTL ? 'اكتب رسالتك...' : 'Type a message...'}
            placeholderTextColor={COLORS.textSecondary}
            multiline
          />
          <TouchableOpacity
            onPress={handleSend}
            disabled={sending || !input.trim()}
            style={[styles.sendBtn, (sending || !input.trim()) && { opacity: 0.5 }]}
          >
            <Ionicons name={isRTL ? 'arrow-back' : 'arrow-forward'} size={20} color="#fff" />
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
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.md,
      backgroundColor: C.card,
      borderBottomWidth: 1,
      borderBottomColor: C.border,
    },
    title: { color: C.text, fontWeight: '800', fontSize: 16 },
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
    },
    sendBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: C.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
