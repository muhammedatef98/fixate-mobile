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
import { getOrderTotals, fmtSAR, type OrderTotals } from '../utils/orderMoney';
import { PAYMENT_MODE_LABELS } from '../utils/paymentPlan';
import { notifyUsers } from '../services/notifyService';
import { logger } from '../utils/logger';
import {
  getPaymentPageMethods,
  type PaymentMethod,
} from '../services/paymentMethodsService';

/**
 * The payment page — reached immediately after the customer accepts a
 * technician's offer (payment architecture v2). The amount due NOW follows
 * the payment-mode snapshot taken at acceptance (full upfront / deposit /
 * partial); the rest, if any, is collected after the repair.
 *
 * Methods are admin-managed (payment_methods table). Cash on Delivery keeps
 * payment_status = 'unpaid' (the technician confirms collection later via
 * record_order_payment); card/Apple Pay record the choice as
 * 'pending_payment' until a server-side gateway confirms the charge.
 */
const methodAccent = (code: string, COLORS: any): string => {
  if (code === 'tabby') return '#3EB6A0';
  if (code === 'tamara') return '#E0218A';
  return COLORS.primary;
};

export default function PaymentScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ orderId?: string }>();
  const { language, isDark } = useApp();
  const COLORS = getColors(isDark);
  const SHADOWS = getShadows(isDark);
  const isRTL = language === 'ar';

  const orderId = params.orderId ?? '';

  const [methods, setMethods] = useState<PaymentMethod[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [order, setOrder] = useState<any>(null);
  const [totals, setTotals] = useState<OrderTotals | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  useEffect(() => {
    getPaymentPageMethods()
      .then((list) => {
        setMethods(list);
        const firstUsable = list.find((m) => !m.is_coming_soon);
        if (firstUsable) setSelected(firstUsable.code);
      })
      .catch(() => setMethods([]));
  }, []);

  const loadOrder = async () => {
    if (!orderId) return;
    const { data } = await supabase
      .from('orders')
      .select(
        'id, status, technician_id, accepted_offer_amount, final_price, estimated_price, payment_mode, upfront_amount_due, amount_paid, discount_amount, delivery_fee, accessories, protection_addons'
      )
      .eq('id', orderId)
      .maybeSingle();
    if (!data) return;
    setOrder(data);
    setTotals(getOrderTotals(data as any));
  };

  useEffect(() => {
    void loadOrder();
  }, [orderId]);

  const accessories: any[] = Array.isArray(order?.accessories) ? order.accessories : [];
  const protection: any[] = Array.isArray(order?.protection_addons) ? order.protection_addons : [];
  const addonRows = [
    ...accessories.map((a) => ({ ...a, kind: 'accessories' as const })),
    ...protection.map((p) => ({ ...p, kind: 'protection_addons' as const })),
  ];

  const removeAddon = async (row: { id: string; kind: 'accessories' | 'protection_addons' }) => {
    setRemovingId(row.id);
    try {
      const nextAcc = row.kind === 'accessories' ? accessories.filter((a) => a.id !== row.id) : accessories;
      const nextProt = row.kind === 'protection_addons' ? protection.filter((p) => p.id !== row.id) : protection;
      const { error } = await supabase
        .from('orders')
        .update({ accessories: nextAcc, protection_addons: nextProt })
        .eq('id', orderId);
      if (error) throw error;
      await loadOrder();
    } catch (e: any) {
      Alert.alert(isRTL ? 'خطأ' : 'Error', getFriendlyError(e, language));
    } finally {
      setRemovingId(null);
    }
  };

  const isSplitMode = totals != null && totals.paymentMode !== 'full_upfront';
  const remainderAfter = totals ? Math.max(0, totals.total - totals.dueNow) : 0;

  const handleConfirm = async () => {
    if (!orderId || !selected) {
      Alert.alert(isRTL ? 'تنبيه' : 'Notice', isRTL ? 'اختر طريقة دفع' : 'Select a payment method');
      return;
    }
    const method = methods?.find((m) => m.code === selected);
    if (!method || method.is_coming_soon || !totals) return;

    setSubmitting(true);
    try {
      // COD: nothing is actually collected here — the technician confirms the
      // cash collection later (record_order_payment), so payment_status stays
      // 'unpaid'. Card/Apple Pay record the chosen method as
      // 'pending_payment' until a gateway webhook flips it to 'paid'.
      const isCod = method.code === 'cod';
      const { error } = await supabase
        .from('orders')
        .update({
          payment_method: method.code,
          payment_status: isCod ? 'unpaid' : 'pending_payment',
          status: 'accepted',
          updated_at: new Date().toISOString(),
        })
        .eq('id', orderId)
        .eq('status', 'awaiting_payment');
      if (error) throw error;

      // Tell the technician the customer confirmed — work can start.
      if (order?.technician_id) {
        try {
          void notifyUsers(order.technician_id, {
            title: 'تم تأكيد الطلب ✅',
            body: 'أكد العميل الدفع — يمكنك بدء العمل على الطلب.',
            data: { screen: 'order-details', orderId },
          });
        } catch (e) {
          logger.warn('payment-confirmed push failed', e);
        }
      }

      const dueNowTxt = fmtSAR(totals.dueNow, isRTL);
      const restTxt = fmtSAR(remainderAfter, isRTL);
      Alert.alert(
        isRTL ? 'تم تأكيد الطلب ✓' : 'Order confirmed ✓',
        isCod
          ? isSplitMode
            ? isRTL
              ? `سيُحصَّل ${dueNowTxt} نقداً عند بدء الخدمة، والمتبقي (${restTxt}) بعد إتمام الإصلاح.`
              : `${dueNowTxt} will be collected in cash when the service starts, and the remaining ${restTxt} after the repair is done.`
            : isRTL
              ? 'تم تأكيد طلبك. سيتم تحصيل المبلغ نقداً عند إتمام الإصلاح.'
              : 'Your order is confirmed. The amount will be collected in cash on completion.'
          : isSplitMode
            ? isRTL
              ? `تم حفظ طريقة الدفع. سيتم تحصيل ${dueNowTxt} الآن والمتبقي (${restTxt}) بعد الإصلاح.`
              : `Payment method saved. ${dueNowTxt} is charged now and the remaining ${restTxt} after the repair.`
            : isRTL
              ? 'تم حفظ طريقة الدفع. سيتم تحصيل المبلغ كاملاً.'
              : 'Payment method saved. The full amount will be charged.',
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
  const modeLabel = totals ? PAYMENT_MODE_LABELS[totals.paymentMode][isRTL ? 'ar' : 'en'] : '';

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
        {totals && (
          <View style={[styles.amountCard, { backgroundColor: COLORS.primary + '12', borderColor: COLORS.primary + '30' }]}>
            <Text style={[styles.amountLabel, { color: COLORS.textSecondary }]}>
              {isRTL ? 'المطلوب الآن' : 'Due now'}
            </Text>
            <Text style={[styles.amountValue, { color: COLORS.primary }]}>
              {fmtSAR(totals.dueNow, isRTL)}
            </Text>
            {isSplitMode && (
              <Text style={{ color: COLORS.textSecondary, fontSize: 12, marginTop: 6, textAlign: 'center' }}>
                {isRTL
                  ? `${modeLabel} — المتبقي ${fmtSAR(remainderAfter, isRTL)} بعد الإصلاح`
                  : `${modeLabel} — remaining ${fmtSAR(remainderAfter, isRTL)} after the repair`}
              </Text>
            )}
          </View>
        )}

        {/* Price breakdown — the agreed offer is the price basis; add-ons are
            removable before confirming. */}
        {totals && (
          <View style={[styles.breakdownCard, { backgroundColor: COLORS.card, borderColor: COLORS.border }]}>
            <Text style={[styles.breakdownTitle, { color: COLORS.text }]}>
              {isRTL ? 'تفاصيل المبلغ' : 'Price breakdown'}
            </Text>
            <View style={styles.bdRow}>
              <Text style={[styles.bdLabel, { color: COLORS.textSecondary }]}>
                {isRTL ? 'السعر المتفق عليه (العرض المقبول)' : 'Agreed price (accepted offer)'}
              </Text>
              <Text style={[styles.bdValue, { color: COLORS.text }]}>
                {fmtSAR(totals.agreedAmount, isRTL)}
              </Text>
            </View>
            {totals.deliveryFee > 0 && (
              <View style={styles.bdRow}>
                <Text style={[styles.bdLabel, { color: COLORS.textSecondary }]}>
                  {isRTL ? 'رسوم التوصيل' : 'Delivery fee'}
                </Text>
                <Text style={[styles.bdValue, { color: COLORS.text }]}>
                  +{fmtSAR(totals.deliveryFee, isRTL)}
                </Text>
              </View>
            )}
            {addonRows.length > 0 && (
              <>
                <View style={[styles.bdDivider, { backgroundColor: COLORS.border }]} />
                <Text style={[styles.bdSubhead, { color: COLORS.textSecondary }]}>
                  {isRTL ? 'إكسسوارات وإضافات (يمكن إزالتها)' : 'Accessories & add-ons (removable)'}
                </Text>
                {addonRows.map((a) => (
                  <View key={`${a.kind}-${a.id}`} style={styles.bdAddonRow}>
                    <Text style={[styles.bdLabel, { color: COLORS.text, flex: 1 }]} numberOfLines={1}>
                      {isRTL ? a.name_ar : a.name_en}
                    </Text>
                    <Text style={[styles.bdValue, { color: COLORS.text, marginHorizontal: 8 }]}>
                      +{fmtSAR(Number(a.price ?? 0), isRTL)}
                    </Text>
                    <TouchableOpacity
                      onPress={() => removeAddon(a)}
                      disabled={removingId === a.id}
                      style={styles.bdRemoveBtn}
                      accessibilityLabel={isRTL ? 'إزالة' : 'Remove'}
                    >
                      {removingId === a.id ? (
                        <ActivityIndicator size="small" color={COLORS.error} />
                      ) : (
                        <Ionicons name="close-circle" size={20} color={COLORS.error} />
                      )}
                    </TouchableOpacity>
                  </View>
                ))}
              </>
            )}
            {totals.discount > 0 && (
              <View style={styles.bdRow}>
                <Text style={[styles.bdLabel, { color: COLORS.primary }]}>
                  {isRTL ? 'الخصم' : 'Discount'}
                </Text>
                <Text style={[styles.bdValue, { color: COLORS.primary }]}>
                  -{fmtSAR(totals.discount, isRTL)}
                </Text>
              </View>
            )}
            <View style={[styles.bdDivider, { backgroundColor: COLORS.border }]} />
            <View style={styles.bdRow}>
              <Text style={[styles.bdLabel, { color: COLORS.text, fontWeight: '900', fontSize: 15 }]}>
                {isRTL ? 'الإجمالي' : 'Total'}
              </Text>
              <Text style={[styles.bdValue, { color: COLORS.text, fontSize: 16, fontWeight: '900' }]}>
                {fmtSAR(totals.total, isRTL)}
              </Text>
            </View>
            <View style={styles.bdRow}>
              <Text style={[styles.bdLabel, { color: COLORS.text, fontWeight: '900', fontSize: 15 }]}>
                {isRTL ? 'المطلوب الآن' : 'Due now'}
              </Text>
              <Text style={[styles.bdValue, { color: COLORS.primary, fontSize: 18, fontWeight: '900' }]}>
                {fmtSAR(totals.dueNow, isRTL)}
              </Text>
            </View>
            {isSplitMode && (
              <View style={styles.bdRow}>
                <Text style={[styles.bdLabel, { color: COLORS.textSecondary }]}>
                  {isRTL ? 'المتبقي بعد الإصلاح' : 'Remaining after repair'}
                </Text>
                <Text style={[styles.bdValue, { color: COLORS.textSecondary }]}>
                  {fmtSAR(remainderAfter, isRTL)}
                </Text>
              </View>
            )}
            <Text style={[styles.bdVatNote, { color: COLORS.textSecondary }]}>
              {isRTL ? 'الأسعار شاملة ضريبة القيمة المضافة' : 'Prices include VAT'}
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
                <View style={[styles.methodIcon, { backgroundColor: methodAccent(m.code, COLORS) + '1A' }]}>
                  <MaterialCommunityIcons
                    name={(m.icon as any) || 'credit-card-outline'}
                    size={22}
                    color={methodAccent(m.code, COLORS)}
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
              ? 'جميع العمليات مؤمّنة، والإصلاح يشمل ضمان سنة كاملة.'
              : 'All transactions are secured and the repair includes a 1-year warranty.'}
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
    breakdownCard: {
      borderRadius: BORDER_RADIUS.md,
      borderWidth: 1,
      padding: 16,
      marginBottom: 18,
    },
    breakdownTitle: {
      fontSize: 15,
      fontWeight: '800',
      marginBottom: 10,
      textAlign: isRTL ? 'right' : 'left',
    },
    bdRow: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 5,
    },
    bdLabel: { fontSize: 13, textAlign: isRTL ? 'right' : 'left' },
    bdValue: { fontSize: 13, fontWeight: '700' },
    bdDivider: { height: StyleSheet.hairlineWidth, marginVertical: 8 },
    bdVatNote: {
      fontSize: 11,
      marginTop: 6,
      textAlign: isRTL ? 'right' : 'left',
    },
    bdSubhead: {
      fontSize: 11,
      fontWeight: '700',
      marginBottom: 4,
      textAlign: isRTL ? 'right' : 'left',
    },
    bdAddonRow: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      paddingVertical: 5,
    },
    bdRemoveBtn: { padding: 2 },
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
