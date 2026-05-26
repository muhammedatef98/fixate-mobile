import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { useIsAdmin } from '../hooks/useAdminGuard';
import { getColors, SPACING, BORDER_RADIUS } from '../constants/theme';
import { RTLIonicon } from '../components/RTLIcon';
import { safeBack } from '../utils/navigation';
import { supabase } from '../services/supabaseClient';
import {
  listBroadcasts,
  sendBroadcast,
  type Broadcast,
  type BroadcastAudience,
  type BroadcastCategory,
} from '../services/broadcastService';

export default function AdminBroadcastsScreen() {
  const router = useRouter();
  const { language, isDark } = useApp();
  const { user, userProfile } = useAuth();
  const COLORS = getColors(isDark);
  const isRTL = language === 'ar';

  const { isAdmin, checking: adminChecking } = useIsAdmin();
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sending, setSending] = useState(false);

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState<BroadcastCategory>('announcement');
  const [audience, setAudience] = useState<BroadcastAudience>('all');

  const load = useCallback(async () => {
    try {
      const items = await listBroadcasts();
      setBroadcasts(items);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    load();
  }, [isAdmin, load]);

  const handleSend = async () => {
    if (!user?.id) return;
    if (!title.trim() || !body.trim()) {
      Alert.alert(
        isRTL ? 'حقول ناقصة' : 'Missing fields',
        isRTL ? 'يجب إدخال العنوان والمحتوى.' : 'Title and body are required.'
      );
      return;
    }
    Alert.alert(
      isRTL ? 'تأكيد الإرسال' : 'Confirm broadcast',
      isRTL
        ? `سيتم إرسال الإشعار إلى: ${audienceLabel(audience, true)}`
        : `Notification will be sent to: ${audienceLabel(audience, false)}`,
      [
        { text: isRTL ? 'إلغاء' : 'Cancel', style: 'cancel' },
        {
          text: isRTL ? 'إرسال' : 'Send',
          onPress: async () => {
            setSending(true);
            try {
              const sent = await sendBroadcast(user.id, {
                title: title.trim(),
                body: body.trim(),
                category,
                audience,
              });
              setTitle('');
              setBody('');
              setBroadcasts((prev) => [sent, ...prev]);
              Alert.alert(
                isRTL ? 'تم الإرسال ✓' : 'Sent ✓',
                isRTL
                  ? `تم إرسال الإشعار إلى ${sent.sent_count} مستخدم${sent.failed_count ? ` (فشل ${sent.failed_count})` : ''}.`
                  : `Notification delivered to ${sent.sent_count} users${sent.failed_count ? ` (${sent.failed_count} failed)` : ''}.`
              );
            } catch (e: any) {
              Alert.alert(isRTL ? 'فشل الإرسال' : 'Send failed', e?.message ?? String(e));
            } finally {
              setSending(false);
            }
          },
        },
      ]
    );
  };

  const styles = useMemo(() => makeStyles(COLORS, isRTL), [COLORS, isRTL]);

  if (adminChecking) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        <ActivityIndicator color={COLORS.primary} size="large" />
      </SafeAreaView>
    );
  }
  if (!isAdmin) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        <MaterialCommunityIcons name="shield-lock-outline" size={56} color={COLORS.textSecondary} />
        <Text style={{ color: COLORS.text, fontWeight: '800', marginTop: 12 }}>
          {isRTL ? 'غير مصرّح' : 'Unauthorized'}
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => safeBack('/admin')} style={{ padding: 4 }}>
          <RTLIonicon name="chevron-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{isRTL ? 'الإشعارات والإعلانات' : 'Broadcasts'}</Text>
        <View style={{ width: 32 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={{ padding: SPACING.lg, gap: 16 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={COLORS.primary} />}
        >
          {/* Compose */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>
              {isRTL ? 'إنشاء إشعار جديد' : 'New broadcast'}
            </Text>

            <Text style={styles.label}>{isRTL ? 'العنوان' : 'Title'}</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              maxLength={80}
              placeholder={isRTL ? 'مثال: تحديث جديد متاح الآن' : 'e.g. New update available'}
              placeholderTextColor={COLORS.textSecondary}
              style={[styles.input, { color: COLORS.text, textAlign: isRTL ? 'right' : 'left' }]}
            />

            <Text style={[styles.label, { marginTop: 12 }]}>{isRTL ? 'المحتوى' : 'Body'}</Text>
            <TextInput
              value={body}
              onChangeText={setBody}
              multiline
              numberOfLines={4}
              maxLength={500}
              placeholder={isRTL ? 'اكتب الرسالة بشكل واضح ومختصر' : 'Write a clear, concise message'}
              placeholderTextColor={COLORS.textSecondary}
              style={[styles.input, { color: COLORS.text, minHeight: 100, textAlignVertical: 'top', textAlign: isRTL ? 'right' : 'left' }]}
            />

            <Text style={[styles.label, { marginTop: 12 }]}>{isRTL ? 'الجمهور' : 'Audience'}</Text>
            <View style={styles.chipsRow}>
              {(['all', 'customers', 'technicians'] as BroadcastAudience[]).map((a) => (
                <Chip
                  key={a}
                  active={audience === a}
                  label={audienceLabel(a, isRTL)}
                  onPress={() => setAudience(a)}
                  COLORS={COLORS}
                />
              ))}
            </View>

            <Text style={[styles.label, { marginTop: 12 }]}>{isRTL ? 'النوع' : 'Category'}</Text>
            <View style={styles.chipsRow}>
              {(['announcement', 'promo', 'update', 'maintenance'] as BroadcastCategory[]).map((c) => (
                <Chip
                  key={c}
                  active={category === c}
                  label={categoryLabel(c, isRTL)}
                  onPress={() => setCategory(c)}
                  COLORS={COLORS}
                />
              ))}
            </View>

            <TouchableOpacity
              onPress={handleSend}
              disabled={sending}
              style={[styles.sendBtn, sending && { opacity: 0.6 }]}
            >
              {sending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="send" size={18} color="#fff" />
                  <Text style={styles.sendBtnText}>
                    {isRTL ? 'إرسال للجميع' : 'Send broadcast'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* History */}
          <Text style={styles.sectionTitleOutside}>
            {isRTL ? 'الإشعارات السابقة' : 'Recent broadcasts'}
          </Text>
          {loading ? (
            <ActivityIndicator color={COLORS.primary} />
          ) : broadcasts.length === 0 ? (
            <View style={[styles.card, { alignItems: 'center', gap: 6 }]}>
              <MaterialCommunityIcons name="bullhorn-outline" size={40} color={COLORS.textSecondary} />
              <Text style={{ color: COLORS.text, fontWeight: '700' }}>
                {isRTL ? 'لم يتم إرسال أي إشعارات بعد' : 'No broadcasts sent yet'}
              </Text>
            </View>
          ) : (
            broadcasts.map((b) => (
              <View key={b.id} style={styles.card}>
                <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', justifyContent: 'space-between' }}>
                  <Text style={styles.itemTitle} numberOfLines={1}>{b.title}</Text>
                  <Text style={styles.itemDate}>
                    {new Date(b.created_at).toLocaleDateString(isRTL ? 'ar-SA' : 'en-GB')}
                  </Text>
                </View>
                <Text style={styles.itemBody} numberOfLines={3}>{b.body}</Text>
                <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                  <Pill text={audienceLabel(b.audience, isRTL)} COLORS={COLORS} />
                  <Pill text={categoryLabel(b.category, isRTL)} COLORS={COLORS} />
                  <Pill
                    text={isRTL ? `أُرسل: ${b.sent_count}` : `Sent: ${b.sent_count}`}
                    COLORS={COLORS}
                  />
                  {b.failed_count > 0 && (
                    <Pill
                      text={isRTL ? `فشل: ${b.failed_count}` : `Failed: ${b.failed_count}`}
                      COLORS={COLORS}
                      tone="error"
                    />
                  )}
                </View>
              </View>
            ))
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Chip({ active, label, onPress, COLORS }: any) {
  return (
    <TouchableOpacity
      onPress={onPress}
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
}

function Pill({ text, COLORS, tone }: { text: string; COLORS: any; tone?: 'error' }) {
  const c = tone === 'error' ? '#ef4444' : COLORS.primary;
  return (
    <View style={{
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
      backgroundColor: c + '15',
    }}>
      <Text style={{ color: c, fontSize: 11, fontWeight: '700' }}>{text}</Text>
    </View>
  );
}

const audienceLabel = (a: BroadcastAudience, isRTL: boolean) => {
  if (a === 'all') return isRTL ? 'الجميع' : 'All users';
  if (a === 'customers') return isRTL ? 'العملاء' : 'Customers';
  return isRTL ? 'الفنيون' : 'Technicians';
};

const categoryLabel = (c: BroadcastCategory, isRTL: boolean) => {
  if (c === 'announcement') return isRTL ? 'إعلان' : 'Announcement';
  if (c === 'promo') return isRTL ? 'عرض' : 'Promo';
  if (c === 'update') return isRTL ? 'تحديث' : 'Update';
  return isRTL ? 'صيانة' : 'Maintenance';
};

const makeStyles = (C: any, isRTL: boolean) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    center: { alignItems: 'center', justifyContent: 'center' },
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
    title: { fontSize: 17, fontWeight: '800', color: C.text },
    card: {
      backgroundColor: C.card,
      borderRadius: BORDER_RADIUS.lg ?? 14,
      borderWidth: 1,
      borderColor: C.border,
      padding: SPACING.lg,
    },
    sectionTitle: { color: C.text, fontWeight: '800', fontSize: 15, marginBottom: 10, textAlign: isRTL ? 'right' : 'left' },
    sectionTitleOutside: { color: C.text, fontWeight: '800', fontSize: 15, textAlign: isRTL ? 'right' : 'left' },
    label: { color: C.textSecondary, fontWeight: '700', fontSize: 12, marginBottom: 6, textAlign: isRTL ? 'right' : 'left' },
    input: {
      borderWidth: 1,
      borderColor: C.border,
      borderRadius: BORDER_RADIUS.md,
      backgroundColor: C.background,
      padding: 12,
      fontSize: 14,
    },
    chipsRow: { flexDirection: isRTL ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: 8 },
    sendBtn: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: C.primary,
      paddingVertical: 14,
      borderRadius: BORDER_RADIUS.md,
      marginTop: 16,
    },
    sendBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
    itemTitle: { color: C.text, fontWeight: '800', fontSize: 14, flex: 1 },
    itemDate: { color: C.textSecondary, fontSize: 11, marginLeft: 8 },
    itemBody: { color: C.text, fontSize: 13, marginTop: 6, textAlign: isRTL ? 'right' : 'left' },
  });
