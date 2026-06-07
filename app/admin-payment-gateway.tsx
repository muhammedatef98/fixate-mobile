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

interface Gateway {
  id: string;
  provider: string;
  display_name: string;
  is_enabled: boolean;
  test_mode: boolean;
  publishable_key: string;
  merchant_id: string;
  has_secret: boolean;
  new_secret: string;
  saving?: boolean;
}

export default function AdminPaymentGatewayScreen() {
  const { language, isDark } = useApp();
  const { user, userProfile } = useAuth();
  const COLORS = getColors(isDark);
  const isRTL = language === 'ar';
  const styles = createStyles(COLORS, isRTL);

  const [gateways, setGateways] = useState<Gateway[]>([]);
  const [loading, setLoading] = useState(true);

  const profileLoaded = userProfile !== null;
  const { isAdmin } = useIsAdmin();

  const load = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('payment_gateways')
        .select('id, provider, display_name, is_enabled, test_mode, publishable_key, merchant_id')
        .order('display_name');
      setGateways(
        ((data ?? []) as any[]).map((g) => ({
          id: g.id,
          provider: g.provider,
          display_name: g.display_name,
          is_enabled: !!g.is_enabled,
          test_mode: !!g.test_mode,
          publishable_key: g.publishable_key ?? '',
          merchant_id: g.merchant_id ?? '',
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

  const patch = (id: string, fields: Partial<Gateway>) =>
    setGateways((prev) => prev.map((g) => (g.id === id ? { ...g, ...fields } : g)));

  const save = async (g: Gateway) => {
    if (g.is_enabled && !g.publishable_key.trim() && !g.new_secret.trim() && !g.has_secret) {
      Alert.alert(
        isRTL ? 'بيانات ناقصة' : 'Missing credentials',
        isRTL
          ? 'أضف مفاتيح المزود قبل تفعيل البوابة.'
          : 'Add the provider keys before enabling the gateway.'
      );
      return;
    }
    patch(g.id, { saving: true });
    try {
      const update: Record<string, any> = {
        is_enabled: g.is_enabled,
        test_mode: g.test_mode,
        publishable_key: g.publishable_key.trim() || null,
        merchant_id: g.merchant_id.trim() || null,
        updated_at: new Date().toISOString(),
        updated_by: user?.id ?? null,
      };
      // Only overwrite the secret when the admin actually typed a new one.
      if (g.new_secret.trim()) update.secret_key = g.new_secret.trim();
      const { error } = await supabase
        .from('payment_gateways')
        .update(update)
        .eq('id', g.id);
      if (error) throw error;
      patch(g.id, {
        saving: false,
        new_secret: '',
        has_secret: g.has_secret || !!g.new_secret.trim(),
      });
      Alert.alert(
        isRTL ? 'تم الحفظ ✓' : 'Saved ✓',
        isRTL ? `تم تحديث إعدادات ${g.display_name}.` : `${g.display_name} settings updated.`
      );
    } catch (e: any) {
      patch(g.id, { saving: false });
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
        <Header isRTL={isRTL} COLORS={COLORS} title={isRTL ? 'بوابة الدفع' : 'Payment gateway'} />
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
      <Header isRTL={isRTL} COLORS={COLORS} title={isRTL ? 'بوابة الدفع' : 'Payment gateway'} />

      {loading ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 50 }} />
      ) : (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 48 }}>
            <View style={styles.infoCard}>
              <Ionicons name="shield-checkmark" size={18} color={COLORS.primary} />
              <Text style={styles.infoText}>
                {isRTL
                  ? 'أضف مفاتيح المزود لتفعيل بوابة دفع حقيقية. تُحفظ البيانات بأمان وتظهر للمسؤولين فقط. المفتاح السري لا يُعرض بعد حفظه.'
                  : 'Add provider keys to activate a real payment gateway. Credentials are stored securely and visible to admins only. The secret key is never shown again once saved.'}
              </Text>
            </View>

            {gateways.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyText}>
                  {isRTL ? 'لا توجد بوابات معرّفة' : 'No gateways configured'}
                </Text>
              </View>
            ) : (
              gateways.map((g) => (
                <View key={g.id} style={styles.card}>
                  {/* Header row */}
                  <View style={styles.cardHead}>
                    <View style={styles.providerIcon}>
                      <MaterialCommunityIcons name="credit-card-outline" size={20} color={COLORS.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.providerName}>{g.display_name}</Text>
                      <Text style={styles.providerCode}>{g.provider}</Text>
                    </View>
                    <View style={[styles.statePill, { backgroundColor: (g.is_enabled ? COLORS.success : COLORS.textSecondary) + '20' }]}>
                      <Text style={[styles.statePillText, { color: g.is_enabled ? COLORS.success : COLORS.textSecondary }]}>
                        {g.is_enabled ? (isRTL ? 'مفعّلة' : 'Active') : (isRTL ? 'متوقفة' : 'Off')}
                      </Text>
                    </View>
                  </View>

                  {/* Toggles */}
                  <View style={styles.toggleRow}>
                    <Text style={styles.toggleLabel}>{isRTL ? 'تفعيل البوابة' : 'Enable gateway'}</Text>
                    <Switch
                      value={g.is_enabled}
                      onValueChange={(v) => patch(g.id, { is_enabled: v })}
                      trackColor={{ false: COLORS.border, true: COLORS.primary }}
                      thumbColor="#fff"
                    />
                  </View>
                  <View style={styles.toggleRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.toggleLabel}>{isRTL ? 'وضع الاختبار' : 'Test mode'}</Text>
                      <Text style={styles.toggleHint}>
                        {isRTL ? 'استخدم مفاتيح الاختبار قبل الإطلاق' : 'Use sandbox keys before going live'}
                      </Text>
                    </View>
                    <Switch
                      value={g.test_mode}
                      onValueChange={(v) => patch(g.id, { test_mode: v })}
                      trackColor={{ false: COLORS.border, true: COLORS.warning }}
                      thumbColor="#fff"
                    />
                  </View>

                  {/* Keys */}
                  <Field label={isRTL ? 'المفتاح المنشور (Publishable key)' : 'Publishable key'} COLORS={COLORS} isRTL={isRTL}>
                    <TextInput
                      value={g.publishable_key}
                      onChangeText={(t) => patch(g.id, { publishable_key: t })}
                      placeholder="pk_..."
                      placeholderTextColor={COLORS.textSecondary}
                      autoCapitalize="none"
                      autoCorrect={false}
                      style={styles.input}
                    />
                  </Field>
                  <Field label={isRTL ? 'المفتاح السري (Secret key)' : 'Secret key'} COLORS={COLORS} isRTL={isRTL}>
                    <TextInput
                      value={g.new_secret}
                      onChangeText={(t) => patch(g.id, { new_secret: t })}
                      placeholder={
                        g.has_secret
                          ? (isRTL ? '•••••••• محفوظ — اتركه فارغاً للإبقاء' : '•••••••• saved — leave blank to keep')
                          : 'sk_...'
                      }
                      placeholderTextColor={COLORS.textSecondary}
                      autoCapitalize="none"
                      autoCorrect={false}
                      secureTextEntry
                      style={styles.input}
                    />
                  </Field>
                  <Field label={isRTL ? 'معرّف التاجر (Merchant ID)' : 'Merchant ID'} COLORS={COLORS} isRTL={isRTL}>
                    <TextInput
                      value={g.merchant_id}
                      onChangeText={(t) => patch(g.id, { merchant_id: t })}
                      placeholder={isRTL ? 'اختياري' : 'Optional'}
                      placeholderTextColor={COLORS.textSecondary}
                      autoCapitalize="none"
                      autoCorrect={false}
                      style={styles.input}
                    />
                  </Field>

                  <TouchableOpacity
                    style={[styles.saveBtn, { opacity: g.saving ? 0.6 : 1 }]}
                    onPress={() => save(g)}
                    disabled={g.saving}
                  >
                    {g.saving ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Text style={styles.saveBtnText}>
                        {isRTL ? 'حفظ الإعدادات' : 'Save settings'}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              ))
            )}

            <Text style={styles.footerNote}>
              {isRTL
                ? 'ملاحظة: تنفيذ عملية الدفع الفعلية يتم عبر خادم آمن باستخدام هذه المفاتيح. بعد إضافة مفاتيح مزود حقيقي وتفعيله، تصبح البوابة جاهزة للربط المباشر.'
                : 'Note: the actual charge runs server-side using these keys. Once a real provider is keyed in and enabled, the gateway is ready to be wired to the live charge flow.'}
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
    toggleHint: { color: C.textSecondary, fontSize: 11, marginTop: 1, textAlign: isRTL ? 'right' : 'left' },
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
