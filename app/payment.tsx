import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useApp } from '../contexts/AppContext';
import { getColors, getShadows, SPACING, BORDER_RADIUS } from '../constants/theme';
import { RTLIonicon } from '../components/RTLIcon';
import { safeBack } from '../utils/navigation';
import { supabase } from '../services/supabaseClient';
import { getFriendlyError } from '../utils/errorMessages';
import {
  getPaymentPageMethods,
  type PaymentMethod,
} from '../services/paymentMethodsService';

/**
 * The real payment page — reached after the customer accepts a repair quote.
 * Methods are admin-managed (payment_methods table). Cash on Delivery is the
 * only one that "really" settles here; card/Apple Pay record the choice and
 * mark the order paid (a real gateway can be wired in later); Tabby/Tamara
 * are shown as coming-soon.
 */
export default function PaymentScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ orderId?: string; amount?: string }>();
  const { language, isDark } = useApp();
  const COLORS = getColors(isDark);
  const SHADOWS = getShadows(isDark);
  const isRTL = language === 'ar';

  const orderId = params.orderId ?? '';
  const amount = params.amount ? Number(params.amount) : null;

  const [methods, setMethods] = useState<PaymentMethod[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getPaymentPageMethods()
      .then((list) => {
        setMethods(list);
        const firstUsable = list.find((m) => !m.is_coming_soon);
        if (firstUsable) setSelected(firstUsable.code);
      })
      .catch(() => setMethods([]));
  }, []);

  const handleConfirm = async () => {
    if (!orderId || !selected) {
      Alert.alert(isRTL ? 'تنبيه' : 'Notice', isRTL ? 'اختر طريقة دفع' : 'Select a payment method');
      return;
    }
    const method = methods?.find((m) => m.code === selected);
    if (!method || method.is_coming_soon) return;

    setSubmitting(true);
    try {
      // COD settles on completion → payment_status stays 'unpaid'. Card /
      // Apple Pay are recorded as 'paid' (no live gateway). Either way the
      // order leaves the payment-ready state and continues as 'accepted'.
      const isCod = method.code === 'cod';
      const { error } = await supabase
        .from('orders')
        .update({
          payment_method: method.code,
          payment_status: isCod ? 'unpaid' : 'paid',
          status: 'accepted',
          updated_at: new Date().toISOString(),
        })
        .eq('id', orderId);
      if (error) throw error;

      Alert.alert(
        isRTL ? 'تم بنجاح ✓' : 'Done ✓',
        isCod
          ? isRTL
            ? 'تم تأكيد طلبك. سيتم تحصيل المبلغ نقداً عند إتمام الإصلاح.'
            : 'Your order is confirmed. The amount will be collected in cash on completion.'
          : isRTL
            ? 'تم تأكيد الدفع. سيتابع الفني الإصلاح الآن.'
            : 'Payment confirmed. The technician will now proceed with the repair.',
        [{ text: 'OK', onPress: () => safeBack(`/order-details?id=${orderId}` as any) }]
      );
    } catch (e: any) {
      Alert.alert(isRTL ? 'خطأ' : 'Error', getFriendlyError(e, language));
    } finally {
      setSubmitting(false);
    }
  };

  const styles = makeStyles(COLORS, isRTL, SHADOWS);
  const selectedMethod = methods?.find((m) => m.code === selected);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => safeBack()} style={styles.backBtn}>
          <RTLIonicon name="chevron-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: COLORS.text }]}>
          {isRTL ? 'الدفع' : 'Payment'}
        </Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: SPACING.m, paddingBottom: 40 }}>
        {amount != null && amount > 0 && (
          <View style={[styles.amountCard, { backgroundColor: COLORS.primary + '12', borderColor: COLORS.primary + '30' }]}>
            <Text style={[styles.amountLabel, { color: COLORS.textSecondary }]}>
              {isRTL ? 'المبلغ المطلوب' : 'Amount due'}
            </Text>
            <Text style={[styles.amountValue, { color: COLORS.primary }]}>
              {amount.toLocaleString(isRTL ? 'ar-SA' : 'en-US')} {isRTL ? 'ر.س' : 'SAR'}
            </Text>
          </View>
        )}

        <Text style={[styles.sectionLabel, { color: COLORS.text }]}>
          {isRTL ? 'اختر طريقة الدفع' : 'Choose how to pay'}
        </Text>

        {!methods ? (
          <ActivityIndicator color={COLORS.primary} style={{ marginTop: 24 }} />
        ) : methods.length === 0 ? (
          <Text style={{ color: COLORS.textSecondary, textAlign: 'center', marginTop: 24 }}>
            {isRTL ? 'لا توجد طرق دفع متاحة' : 'No payment methods available'}
          </Text>
        ) : (
          methods.map((m) => {
            const isSelected = selected === m.code;
            const disabled = m.is_coming_soon;
            return (
              <TouchableOpacity
                key={m.id}
                disabled={disabled}
                onPress={() => setSelected(m.code)}
                activeOpacity={0.85}
                style={[
                  styles.methodRow,
                  {
                    backgroundColor: COLORS.card,
                    borderColor: isSelected ? COLORS.primary : 'transparent',
                    borderWidth: isSelected ? 2 : 0,
                    opacity: disabled ? 0.55 : 1,
                  },
                  SHADOWS.small,
                ]}
              >
                <View style={[styles.methodIcon, { backgroundColor: COLORS.primary + '15' }]}>
                  <MaterialCommunityIcons
                    name={(m.icon as any) || 'credit-card-outline'}
                    size={22}
                    color={COLORS.primary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={{ color: COLORS.text, fontSize: 14, fontWeight: '700' }}>
                      {isRTL ? m.name_ar : m.name_en}
                    </Text>
                    {disabled && (
                      <View style={{ backgroundColor: COLORS.textSecondary + '20', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 }}>
                        <Text style={{ color: COLORS.textSecondary, fontSize: 10, fontWeight: '800' }}>
                          {isRTL ? 'قريباً' : 'Soon'}
                        </Text>
                      </View>
                    )}
                    {m.code === 'cod' && !disabled && (
                      <View style={{ backgroundColor: '#10b98115', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 }}>
                        <Text style={{ color: '#10b981', fontSize: 10, fontWeight: '800' }}>
                          {isRTL ? 'موصى به' : 'Recommended'}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
                <View
                  style={{
                    width: 22, height: 22, borderRadius: 11, borderWidth: 2,
                    borderColor: isSelected ? COLORS.primary : COLORS.border,
                    alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  {isSelected && (
                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.primary }} />
                  )}
                </View>
              </TouchableOpacity>
            );
          })
        )}

        <View style={[styles.trustNote, { backgroundColor: COLORS.primary + '10' }]}>
          <Ionicons name="shield-checkmark" size={18} color={COLORS.primary} />
          <Text style={[styles.trustText, { color: COLORS.text }]}>
            {isRTL
              ? 'جميع العمليات مؤمّنة، والإصلاح يشمل ضمان 6 أشهر.'
              : 'All transactions are secured and the repair includes a 6-month warranty.'}
          </Text>
        </View>

        <TouchableOpacity
          onPress={handleConfirm}
          disabled={submitting || !selectedMethod || selectedMethod.is_coming_soon}
          style={[
            styles.confirmBtn,
            { backgroundColor: COLORS.primary },
            (submitting || !selectedMethod || selectedMethod.is_coming_soon) && { opacity: 0.5 },
          ]}
          accessibilityRole="button"
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.confirmText}>
              {selectedMethod?.code === 'cod'
                ? (isRTL ? 'تأكيد الطلب' : 'Confirm order')
                : (isRTL ? 'تأكيد الدفع' : 'Confirm payment')}
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (C: any, isRTL: boolean, SHADOWS: any) =>
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
    backBtn: {
      width: 36, height: 36, borderRadius: 18,
      alignItems: 'center', justifyContent: 'center',
    },
    title: { fontSize: 22, fontWeight: '800' },
    amountCard: {
      borderRadius: BORDER_RADIUS.md,
      borderWidth: 1,
      padding: 20,
      alignItems: 'center',
      marginBottom: 20,
    },
    amountLabel: { fontSize: 12, fontWeight: '500' },
    amountValue: { fontSize: 30, fontWeight: '800', marginTop: 4 },
    sectionLabel: {
      fontSize: 18,
      fontWeight: '800',
      marginBottom: 12,
      textAlign: isRTL ? 'right' : 'left',
    },
    methodRow: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      borderRadius: BORDER_RADIUS.md,
      padding: 16,
      marginBottom: 12,
      gap: 12,
    },
    methodIcon: {
      width: 44, height: 44, borderRadius: 12,
      alignItems: 'center', justifyContent: 'center',
    },
    trustNote: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 8,
      padding: 12,
      borderRadius: BORDER_RADIUS.md,
      marginTop: 6,
      marginBottom: 18,
    },
    trustText: { flex: 1, fontSize: 12, lineHeight: 17, textAlign: isRTL ? 'right' : 'left' },
    confirmBtn: {
      minHeight: 52,
      paddingVertical: 15,
      borderRadius: BORDER_RADIUS.sm,
      alignItems: 'center',
      justifyContent: 'center',
      ...SHADOWS.small,
    },
    confirmText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  });
