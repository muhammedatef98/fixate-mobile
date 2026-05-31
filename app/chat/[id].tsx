import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  Linking,
  Image,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { getColors, SPACING, BORDER_RADIUS } from '../../constants/theme';
import { useApp } from '../../contexts/AppContext';
import { chat, auth, requests } from '../../lib/supabase-api';
import { logger } from '../../utils/logger';
import { RTLIonicon } from '../../components/RTLIcon';
import { safeBack } from '../../utils/navigation';
import { useScrollToEndOnKeyboard } from '../../hooks/useScrollToEndOnKeyboard';
import { uploadOrderMedia, resolveOrderMediaUrls } from '../../services/storageService';
import { useAppForegroundRefresh } from '../../hooks/useAppForegroundRefresh';
import ImageViewer from '../../components/ImageViewer';

// Quick-reply suggestions that match each side of the conversation. The
// customer's prompts are questions / status checks; the technician's are
// status updates the customer wants to hear.
const QUICK_REPLIES_CUSTOMER_AR = [
  'كم المدة المتبقية؟',
  'تواصل معي قبل الوصول',
  'الموقع صحيح؟',
  'هل تحتاج تفاصيل أكثر؟',
];
const QUICK_REPLIES_CUSTOMER_EN = [
  'How long left?',
  'Call me before arriving',
  'Is the location correct?',
  'Need more details?',
];
const QUICK_REPLIES_TECHNICIAN_AR = [
  'في الطريق إليك',
  'وصلت لموقعك',
  'بدأت الفحص',
  'العطل تم تشخيصه',
  'الإصلاح بحاجة قطعة غيار',
];
const QUICK_REPLIES_TECHNICIAN_EN = [
  'On my way',
  "I've arrived",
  'Started diagnosis',
  'Issue identified',
  'Parts needed',
];

export default function ChatScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { language, isDark } = useApp();
  const COLORS = getColors(isDark);
  const isRTL = language === 'ar';

  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [order, setOrder] = useState<any>(null);
  const [otherPartyName, setOtherPartyName] = useState('');
  const [otherPartyPhone, setOtherPartyPhone] = useState<string | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerImages, setViewerImages] = useState<string[]>([]);
  const [viewerIndex, setViewerIndex] = useState(0);
  // B-5 Wave 3: signed-URL mirror for chat image attachments keyed by
  // message id. Temp/local file:// URIs are skipped and rendered as-is.
  const [displayAttachments, setDisplayAttachments] = useState<Record<string, string>>({});

  const flatListRef = useRef<FlatList>(null);
  useScrollToEndOnKeyboard(flatListRef);

  useEffect(() => {
    loadData();
    const subscription = chat.subscribeToMessages(id as string, (message) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === message.id)) return prev;
        return [...prev, message];
      });
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 80);
    });
    return () => {
      subscription.unsubscribe();
    };
  }, [id]);

  // Re-sign chat image attachments whenever the message list changes.
  // Only non-temp messages with a remote attachment_url participate; temp
  // messages still carry a local file:// URI and render straight from it.
  useEffect(() => {
    let cancelled = false;
    const entries = messages
      .filter((m) => !m?.is_temp && m?.attachment_type === 'image' && typeof m?.attachment_url === 'string' && m.attachment_url.startsWith('http'))
      .map((m) => [m.id, m.attachment_url] as const);
    if (entries.length === 0) {
      setDisplayAttachments({});
      return;
    }
    resolveOrderMediaUrls(entries.map(([, v]) => v))
      .then((resolved) => {
        if (cancelled) return;
        const next: Record<string, string> = {};
        entries.forEach(([k, original], i) => { next[k] = resolved[i] ?? original; });
        setDisplayAttachments(next);
      })
      .catch(() => { /* keep stored URLs */ });
    return () => { cancelled = true; };
  }, [messages]);

  // H-6: refetch when the app returns from background so messages missed
  // while the realtime socket was suspended catch up. Wrapped in arrow
  // so the closure reads the latest `loadData` even though the const is
  // declared just below.
  useAppForegroundRefresh(() => { void loadData(); });

  const loadData = async () => {
    try {
      const [user, orderData, msgs] = await Promise.all([
        auth.getCurrentUser(),
        requests.getById(id as string),
        chat.getMessages(id as string),
      ]);
      setCurrentUser(user);
      setOrder(orderData);
      setMessages(msgs);
      const meta = (user?.user_metadata || {}) as { user_type?: string; role?: string };
      const userRole = meta.user_type || meta.role;
      if (userRole === 'technician') {
        setOtherPartyName((orderData as any)?.customer_name || (isRTL ? 'العميل' : 'Customer'));
        setOtherPartyPhone((orderData as any)?.customer_phone ?? null);
      } else {
        setOtherPartyName((orderData as any)?.technician_name || (isRTL ? 'الفني' : 'Technician'));
        setOtherPartyPhone((orderData as any)?.technician_phone ?? null);
      }
      setLoading(false);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 80);
    } catch (error) {
      logger.warn('Chat load failed', error);
      setLoading(false);
    }
  };

  const handleSend = async (textOverride?: string) => {
    const messageContent = (textOverride ?? newMessage).trim();
    if (!messageContent) return;

    if (!textOverride) setNewMessage('');
    const tempId = `temp-${Date.now()}`;
    const tempMessage = {
      id: tempId,
      content: messageContent,
      sender_id: currentUser?.id,
      created_at: new Date().toISOString(),
      is_temp: true,
    };
    setMessages((prev) => [...prev, tempMessage]);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 80);

    try {
      setSending(true);
      await chat.sendMessage(id as string, messageContent);
    } catch (error) {
      logger.warn('chat sendMessage failed', error);
      Alert.alert(isRTL ? 'خطأ' : 'Error', isRTL ? 'فشل إرسال الرسالة' : 'Failed to send message');
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      if (!textOverride) setNewMessage(messageContent);
    } finally {
      setSending(false);
    }
  };

  const sendImage = async () => {
    if (!currentUser?.id) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(isRTL ? 'إذن مرفوض' : 'Permission denied', isRTL ? 'فعّل إذن المعرض من الإعدادات' : 'Enable gallery access in settings');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (res.canceled || !res.assets[0]?.uri) return;

    const tempId = `temp-${Date.now()}`;
    setMessages((prev) => [...prev, {
      id: tempId, content: '', sender_id: currentUser.id, created_at: new Date().toISOString(),
      attachment_type: 'image', attachment_url: res.assets[0].uri, is_temp: true,
    }]);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 80);

    try {
      setSending(true);
      const [url] = await uploadOrderMedia(currentUser.id, [res.assets[0].uri], `chat-${id}`);
      if (!url) throw new Error('upload failed');
      await chat.sendMessage(id as string, '', { type: 'image', url });
    } catch (e) {
      logger.warn('send image failed', e);
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      Alert.alert(isRTL ? 'خطأ' : 'Error', isRTL ? 'فشل إرسال الصورة' : 'Could not send image');
    } finally {
      setSending(false);
    }
  };

  const sendLocation = async () => {
    if (!currentUser?.id) return;
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== 'granted') {
      Alert.alert(isRTL ? 'إذن مرفوض' : 'Permission denied', isRTL ? 'فعّل إذن الموقع' : 'Enable location access');
      return;
    }
    try {
      setSending(true);
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      await chat.sendMessage(id as string, '', {
        type: 'location',
        lat: loc.coords.latitude,
        lng: loc.coords.longitude,
      });
    } catch (e) {
      logger.warn('send location failed', e);
      Alert.alert(isRTL ? 'خطأ' : 'Error', isRTL ? 'فشل إرسال الموقع' : 'Could not send location');
    } finally {
      setSending(false);
    }
  };

  const openImage = (url: string) => {
    setViewerImages([url]);
    setViewerIndex(0);
    setViewerOpen(true);
  };

  const openLocation = (lat: number, lng: number) => {
    const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    Linking.openURL(url);
  };

  const renderMessage = ({ item, index }: { item: any; index: number }) => {
    const isMe = item.sender_id === currentUser?.id;
    const prev = messages[index - 1];
    const next = messages[index + 1];
    const isFirstInGroup = !prev || prev.sender_id !== item.sender_id;
    const isLastInGroup = !next || next.sender_id !== item.sender_id;
    const time = new Date(item.created_at).toLocaleTimeString(language === 'ar' ? 'ar' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });

    return (
      <View
        style={[
          styles.messageRow,
          {
            justifyContent: isMe ? (isRTL ? 'flex-start' : 'flex-end') : (isRTL ? 'flex-end' : 'flex-start'),
            marginTop: isFirstInGroup ? 10 : 2,
          },
        ]}
      >
        <View
          style={[
            styles.bubble,
            isMe
              ? {
                  backgroundColor: COLORS.primary,
                  borderBottomRightRadius: isRTL || !isLastInGroup ? 18 : 6,
                  borderBottomLeftRadius: !isRTL || !isLastInGroup ? 18 : 6,
                }
              : {
                  backgroundColor: COLORS.card,
                  borderColor: COLORS.border,
                  borderWidth: 1,
                  borderBottomLeftRadius: isRTL || !isLastInGroup ? 18 : 6,
                  borderBottomRightRadius: !isRTL || !isLastInGroup ? 18 : 6,
                },
            item.is_temp && { opacity: 0.7 },
            item.attachment_type && { padding: 4 },
          ]}
        >
          {/* Image attachment — tap to open in-app viewer */}
          {item.attachment_type === 'image' && item.attachment_url && (
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => openImage(displayAttachments[item.id] ?? item.attachment_url)}
              style={{ marginBottom: 4 }}
              accessibilityRole="button"
            >
              <Image
                source={{ uri: displayAttachments[item.id] ?? item.attachment_url }}
                style={{ width: 220, height: 180, borderRadius: 14, backgroundColor: '#00000020' }}
              />
            </TouchableOpacity>
          )}

          {/* Location attachment — tap to open Google Maps */}
          {item.attachment_type === 'location' && item.attachment_lat != null && item.attachment_lng != null && (
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => openLocation(item.attachment_lat, item.attachment_lng)}
              style={{
                width: 220, padding: 12, borderRadius: 14,
                backgroundColor: isMe ? '#ffffff20' : COLORS.background,
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'center', gap: 10,
                marginBottom: item.content ? 8 : 4,
              }}
              accessibilityRole="button"
            >
              <View style={{
                width: 44, height: 44, borderRadius: 22,
                backgroundColor: isMe ? '#ffffff30' : COLORS.primary + '20',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Ionicons name="location" size={22} color={isMe ? '#fff' : COLORS.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: isMe ? '#fff' : COLORS.text, fontSize: 13, fontWeight: '700' }}>
                  {isRTL ? 'تم مشاركة الموقع' : 'Location shared'}
                </Text>
                <Text style={{ color: isMe ? '#ffffffcc' : COLORS.textSecondary, fontSize: 11, marginTop: 2 }}>
                  {isRTL ? 'اضغط للفتح في الخريطة' : 'Tap to open in Maps'}
                </Text>
              </View>
            </TouchableOpacity>
          )}

          {item.content ? (
            <Text style={{ color: isMe ? '#fff' : COLORS.text, fontSize: 14, lineHeight: 20, paddingHorizontal: item.attachment_type ? 6 : 0, textAlign: isRTL ? 'right' : 'left', writingDirection: isRTL ? 'rtl' : 'ltr' }}>
              {item.content}
            </Text>
          ) : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end', marginTop: 4, gap: 4, paddingHorizontal: item.attachment_type ? 6 : 0 }}>
            <Text style={{ color: isMe ? '#ffffffaa' : COLORS.textSecondary, fontSize: 10 }}>{time}</Text>
            {isMe && (
              <Ionicons
                name={item.is_temp ? 'time-outline' : 'checkmark-done'}
                size={12}
                color={item.is_temp ? '#ffffffaa' : '#bbf7d0'}
              />
            )}
          </View>
        </View>
      </View>
    );
  };

  const styles = makeStyles(COLORS, isRTL);

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </SafeAreaView>
    );
  }

  const initial = (otherPartyName?.[0] || '?').toUpperCase();
  const meta = (currentUser?.user_metadata || {}) as { user_type?: string; role?: string };
  const myRole = meta.user_type || meta.role;
  const isTechnician = myRole === 'technician';
  const quickReplies = isTechnician
    ? (isRTL ? QUICK_REPLIES_TECHNICIAN_AR : QUICK_REPLIES_TECHNICIAN_EN)
    : (isRTL ? QUICK_REPLIES_CUSTOMER_AR : QUICK_REPLIES_CUSTOMER_EN);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => safeBack('/(customer)/orders')} style={styles.backBtn}>
          <RTLIonicon name="chevron-back" size={22} color={COLORS.text} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <View style={[styles.headerAvatar, { backgroundColor: COLORS.primary }]}>
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 14 }}>{initial}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerTitle, { color: COLORS.text }]} numberOfLines={1}>
              {otherPartyName}
            </Text>
            <Text style={[styles.headerSubtitle, { color: COLORS.textSecondary }]} numberOfLines={1}>
              {order?.device_brand} {order?.device_model} · #{(order?.id ?? '').slice(0, 6)}
            </Text>
          </View>
        </View>

        {otherPartyPhone ? (
          <TouchableOpacity
            onPress={() => Linking.openURL(`tel:${otherPartyPhone}`)}
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

      {/* KeyboardAvoidingView wraps list + quick replies + input so the
          list resizes with the keyboard instead of letting messages slide
          behind it. */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
      >
      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: SPACING.md, paddingBottom: 12 }}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', marginTop: 60, paddingHorizontal: 32 }}>
            <View style={{ width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primary + '15' }}>
              <MaterialCommunityIcons name="message-text-outline" size={40} color={COLORS.primary} />
            </View>
            <Text style={{ color: COLORS.text, fontWeight: '700', marginTop: 12, fontSize: 16 }}>
              {isRTL ? 'ابدأ المحادثة 👋' : 'Start the conversation 👋'}
            </Text>
            <Text style={{ color: COLORS.textSecondary, marginTop: 6, textAlign: 'center', fontSize: 13 }}>
              {isRTL
                ? 'أرسل رسالة، أو استخدم الردود السريعة بالأسفل.'
                : 'Send a message, or use one of the quick replies below.'}
            </Text>
          </View>
        }
      />

      {/* Quick replies */}
      {messages.length === 0 && (
        <View style={styles.quickReplies}>
          {quickReplies.map((q) => (
            <TouchableOpacity
              key={q}
              onPress={() => handleSend(q)}
              style={[styles.quickPill, { borderColor: COLORS.border, backgroundColor: COLORS.card }]}
              accessibilityRole="button"
            >
              <Text style={{ color: COLORS.primary, fontSize: 12, fontWeight: '600' }}>{q}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Input */}
      <View style={[styles.inputBar, { backgroundColor: COLORS.card, borderTopColor: COLORS.border }]}>
          {/* Attachment menu — image + location */}
          <TouchableOpacity
            onPress={sendImage}
            disabled={sending}
            style={{ width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primary + '15' }}
            accessibilityRole="button"
            accessibilityLabel={isRTL ? 'إرسال صورة' : 'Send photo'}
          >
            <Ionicons name="image-outline" size={20} color={COLORS.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={sendLocation}
            disabled={sending}
            style={{ width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primary + '15' }}
            accessibilityRole="button"
            accessibilityLabel={isRTL ? 'إرسال الموقع' : 'Send location'}
          >
            <Ionicons name="location-outline" size={20} color={COLORS.primary} />
          </TouchableOpacity>
          <TextInput
            style={[styles.input, { color: COLORS.text, backgroundColor: COLORS.background, borderColor: COLORS.border }]}
            placeholder={isRTL ? 'اكتب رسالتك...' : 'Type a message...'}
            placeholderTextColor={COLORS.textSecondary}
            value={newMessage}
            onChangeText={setNewMessage}
            multiline
            maxLength={2000}
            textAlign={isRTL ? 'right' : 'left'}
          />
          <TouchableOpacity
            style={[styles.sendBtn, { backgroundColor: COLORS.primary, opacity: !newMessage.trim() || sending ? 0.5 : 1 }]}
            onPress={() => handleSend()}
            disabled={!newMessage.trim() || sending}
            accessibilityRole="button"
            accessibilityLabel={isRTL ? 'إرسال' : 'Send'}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="send" size={18} color="#fff" />
            )}
          </TouchableOpacity>
      </View>
      </KeyboardAvoidingView>

      <ImageViewer
        visible={viewerOpen}
        images={viewerImages}
        initialIndex={viewerIndex}
        onClose={() => setViewerOpen(false)}
      />
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
    headerTitle: { fontSize: 17, fontWeight: '800' },
    headerSubtitle: { fontSize: 12, marginTop: 2 },
    callBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    messageRow: { flexDirection: 'row' },
    bubble: {
      maxWidth: '76%',
      borderRadius: 18,
      paddingVertical: 8,
      paddingHorizontal: 12,
    },
    quickReplies: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      flexWrap: 'wrap',
      gap: 8,
      paddingHorizontal: 12,
      paddingBottom: 8,
    },
    quickPill: {
      borderWidth: 1,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
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
