import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Switch,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { useIsAdmin } from '../hooks/useAdminGuard';
import { getColors, SPACING, BORDER_RADIUS } from '../constants/theme';
import { RTLIonicon } from '../components/RTLIcon';
import { safeBack } from '../utils/navigation';
import { AnimatedBackButton } from '../components/AnimatedBackButton';
import { supabase } from '../services/supabaseClient';

interface OtpProvider {
  id: string;
  provider: string;
  display_name: string;
  is_enabled: boolean;
  api_key: string;
  sender_id: string;
  base_url: string;
  has_secret: boolean;
  new_secret: string;
  saving?: boolean;
}

export default function AdminOtpProviderScreen() {
  const { language, isDark } = useApp();
  const { user, userProfile } = useAuth();
  const COLORS = getColors(isDark);
  const isRTL = language === 'ar';
  const styles = createStyles(COLORS, isRTL);

  const [providers, setProviders] = useState<OtpProvider[]>([]);
  const [loading, setLoading] = useState(true);

  const profileLoaded = userProfile !== null;
  const { isAdmin } = useIsAdmin();

  const load = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('otp_providers')
        .select('id, provider, display_name, is_enabled, api_key, sender_id, base_url')
        .order('display_name');
      setProviders(
        ((data ?? []) as any[]).map((p) => ({
          id: p.id,
          provider: p.provider,
          display_name: p.display_name,
          is_enabled: !!p.is_enabled,
          api_key: p.api_key ?? '',
          sender_id: p.sender_id ?? '',
          base_url: p.base_url ?? '',
          has_secret: false,
          new_secret: '',
        }))
      );
    } catch {
      // non-fatal
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (profileLoaded && isAdmin) load();
  }, [profileLoaded, isAdmin, load]);

  const patch = (id: string, fields: Partial<OtpProvider>) =>
    setProviders((prev) => prev.map((p) => (p.id === id ? { ...p, ...fields } : p)));

  const save = async (p: OtpProvider) => {
    if (p.is_enabled && !p.api_key.trim() && !p.has_secret && !p.new_secret.trim()) {
      Alert.alert(
        isRTL ? 'بيانات ناقصة' : 'Missing credentials',
        isRTL
          ? 'أضف مفاتيح المزود قبل تفعيله.'
          : 'Add the provider credentials before enabling it.'
      );
      return;
    }
    patch(p.id, { saving: true });
    try {
      const update: Record<string, any> = {
        is_enabled: p.is_enabled,
        api_key: p.api_key.trim() || null,
        sender_id: p.sender_id.trim() || null,
        base_url: p.base_url.trim() || null,
        updated_at: new Date().toISOString(),
        updated_by: user?.id ?? null,
      };
      if (p.new_secret.trim()) update.api_secret = p.new_secret.trim();
      const { error } = await supabase.from('otp_providers').update(update).eq('id', p.id);
      if (error) throw error;
      patch(p.id, {
        saving: false,
        new_secret: '',
        has_secret: p.has_secret || !!p.new_secret.trim(),
      });
      Alert.alert(
        isRTL ? 'تم الحفظ ✓' : 'Saved ✓',
        isRTL ? `تم تحديث إعدادات ${p.display_name}.` : `${p.display_name} settings updated.`
      );
    } catch (e: any) {
      patch(p.id, { saving: false });
      Alert.alert(isRTL ? 'خطأ' : 'Error', e?.message ?? String(e));
    }
  };

  if (!profileLoaded) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </SafeAreaView>
    );
  }

  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.container}>
        <Header isRTL={isRTL} COLORS={COLORS} title={isRTL ? 'مزود OTP' : 'OTP provider'} />
        <View style={styles.empty}>
          <MaterialCommunityIcons name="shield-alert-outline" size={56} color={COLORS.error} />
          <Text style={styles.emptyText}>{isRTL ? 'هذه الصفحة للأدمن فقط' : 'Admins only'}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <Header isRTL={isRTL} COLORS={COLORS} title={isRTL ? 'مزود رسائل OTP' : 'OTP / SMS provider'} />

      {loading ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 50 }} />
      ) : (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 48 }}>
            <View style={styles.infoCard}>
              <Ionicons name="shield-checkmark" size={18} color={COLORS.primary} />
              <Text style={styles.infoText}>
                {isRTL
                  ? 'عند الحصول على مزود رسائل، أضف مفاتيحه هنا وفعّله ليعمل التحقق عبر OTP فوراً. تُحفظ البيانات بأمان وتظهر للمسؤولين فقط، والمفتاح السري لا يُعرض بعد حفظه.'
                  : 'Once you have an SMS provider, add its keys here and enable it — OTP verification then works immediately. Credentials are stored securely, visible to admins only; the secret is never shown again after saving.'}
              </Text>
            </View>

            {providers.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyText}>
                  {isRTL ? 'لا توجد مزودات معرّفة' : 'No providers configured'}
                </Text>
              </View>
            ) : (
              providers.map((p) => (
                <View key={p.id} style={styles.card}>
                  <View style={styles.cardHead}>
                    <View style={styles.providerIcon}>
                      <MaterialCommunityIcons name="message-text-outline" size={20} color={COLORS.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.providerName}>{p.display_name}</Text>
                      <Text style={styles.providerCode}>{p.provider}</Text>
                    </View>
                    <View style={[styles.statePill, { backgroundColor: (p.is_enabled ? COLORS.success : COLORS.textSecondary) + '20' }]}>
                      <Text style={[styles.statePillText, { color: p.is_enabled ? COLORS.success : COLORS.textSecondary }]}>
                        {p.is_enabled ? (isRTL ? 'مفعّل' : 'Active') : (isRTL ? 'متوقف' : 'Off')}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.toggleRow}>
                    <Text style={styles.toggleLabel}>{isRTL ? 'تفعيل المزود' : 'Enable provider'}</Text>
                    <Switch
                      value={p.is_enabled}
                      onValueChange={(v) => patch(p.id, { is_enabled: v })}
                      trackColor={{ false: COLORS.border, true: COLORS.primary }}
                      thumbColor="#fff"
                    />
                  </View>

                  <Field label={isRTL ? 'مفتاح API' : 'API key'} COLORS={COLORS} isRTL={isRTL}>
                    <TextInput
                      value={p.api_key}
                      onChangeText={(t) => patch(p.id, { api_key: t })}
                      placeholder="api_key..."
                      placeholderTextColor={COLORS.textSecondary}
                      autoCapitalize="none"
                      autoCorrect={false}
                      style={styles.input}
                    />
                  </Field>
                  <Field label={isRTL ? 'المفتاح السري / كلمة المرور' : 'API secret / password'} COLORS={COLORS} isRTL={isRTL}>
                    <TextInput
                      value={p.new_secret}
                      onChangeText={(t) => patch(p.id, { new_secret: t })}
                      placeholder={
                        p.has_secret
                          ? (isRTL ? '•••••••• محفوظ — اتركه فارغاً للإبقاء' : '•••••••• saved — leave blank to keep')
                          : 'secret...'
                      }
                      placeholderTextColor={COLORS.textSecondary}
                      autoCapitalize="none"
                      autoCorrect={false}
                      secureTextEntry
                      style={styles.input}
                    />
                  </Field>
                  <Field label={isRTL ? 'اسم المرسل (Sender ID)' : 'Sender ID'} COLORS={COLORS} isRTL={isRTL}>
                    <TextInput
                      value={p.sender_id}
                      onChangeText={(t) => patch(p.id, { sender_id: t })}
                      placeholder={isRTL ? 'مثال: Fixate' : 'e.g. Fixate'}
                      placeholderTextColor={COLORS.textSecondary}
                      autoCapitalize="none"
                      autoCorrect={false}
                      style={styles.input}
                    />
                  </Field>
                  <Field label={isRTL ? 'رابط الـ API (اختياري)' : 'API base URL (optional)'} COLORS={COLORS} isRTL={isRTL}>
                    <TextInput
                      value={p.base_url}
                      onChangeText={(t) => patch(p.id, { base_url: t })}
                      placeholder="https://..."
                      placeholderTextColor={COLORS.textSecondary}
                      autoCapitalize="none"
                      autoCorrect={false}
                      style={styles.input}
                    />
                  </Field>

                  <TouchableOpacity
                    style={[styles.saveBtn, { opacity: p.saving ? 0.6 : 1 }]}
                    onPress={() => save(p)}
                    disabled={p.saving}
                  >
                    {p.saving ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Text style={styles.saveBtnText}>{isRTL ? 'حفظ الإعدادات' : 'Save settings'}</Text>
                    )}
                  </TouchableOpacity>
                </View>
              ))
            )}

            <Text style={styles.footerNote}>
              {isRTL
                ? 'ملاحظة: حتى يتم تفعيل مزود حقيقي، يعمل التطبيق في وضع الاختبار ويعرض كود التحقق مباشرةً.'
                : 'Note: until a real provider is enabled, the app stays in test mode and shows the verification code directly.'}
            </Text>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

function Header({ isRTL, COLORS, title }: any) {
  return (
    <View style={{
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: SPACING.m,
      paddingVertical: SPACING.m,
    }}>
      <AnimatedBackButton
        onPress={() => safeBack('/admin')}
        color={COLORS.text}
        backgroundColor={COLORS.surface ?? COLORS.background}
        size={42}
        iconSize={22}
        rtl
      />
      <Text style={{ fontSize: 20, fontWeight: '800', color: COLORS.text }}>{title}</Text>
      <View style={{ width: 26 }} />
    </View>
  );
}

function Field({ label, children, COLORS, isRTL }: any) {
  return (
    <View style={{ gap: 6, marginTop: 12 }}>
      <Text style={{
        color: COLORS.textSecondary,
        fontWeight: '600',
        fontSize: 12,
        textAlign: isRTL ? 'right' : 'left',
      }}>
        {label}
      </Text>
      {children}
    </View>
  );
}

const createStyles = (C: any, isRTL: boolean) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    empty: { alignItems: 'center', paddingVertical: 60, gap: 10 },
    emptyText: { color: C.text, fontWeight: '700' },
    infoCard: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      gap: 10,
      backgroundColor: C.primary + '12',
      borderRadius: BORDER_RADIUS.md,
      padding: 14,
      marginBottom: 16,
    },
    infoText: {
      flex: 1,
      color: C.text,
      fontSize: 12,
      lineHeight: 18,
      textAlign: isRTL ? 'right' : 'left',
    },
    card: {
      backgroundColor: C.card,
      borderRadius: BORDER_RADIUS.lg,
      borderWidth: 1,
      borderColor: C.border,
      padding: SPACING.md,
      marginBottom: 14,
    },
    cardHead: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 8,
    },
    providerIcon: {
      width: 40, height: 40, borderRadius: 12,
      backgroundColor: C.primary + '18',
      alignItems: 'center', justifyContent: 'center',
    },
    providerName: { color: C.text, fontSize: 16, fontWeight: '800', textAlign: isRTL ? 'right' : 'left' },
    providerCode: { color: C.textSecondary, fontSize: 11, textAlign: isRTL ? 'right' : 'left' },
    statePill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
    statePillText: { fontSize: 11, fontWeight: '800' },
    toggleRow: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      paddingVertical: 8,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: C.border,
    },
    toggleLabel: { color: C.text, fontSize: 14, fontWeight: '700', textAlign: isRTL ? 'right' : 'left' },
    input: {
      borderWidth: 1,
      borderColor: C.border,
      borderRadius: BORDER_RADIUS.md,
      paddingHorizontal: 12,
      paddingVertical: 11,
      fontSize: 14,
      color: C.text,
      backgroundColor: C.background,
      textAlign: isRTL ? 'right' : 'left',
    },
    saveBtn: {
      backgroundColor: C.primary,
      borderRadius: BORDER_RADIUS.md,
      paddingVertical: 13,
      alignItems: 'center',
      marginTop: 16,
    },
    saveBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
    footerNote: {
      color: C.textSecondary,
      fontSize: 11,
      lineHeight: 17,
      textAlign: 'center',
      marginTop: 8,
    },
  });
