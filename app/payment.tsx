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
 * set payment_status = 'pending_payment' until a server-side gateway confirms
 * the charge. Tabby/Tamara are shown as coming-soon.
 */
// Brand accent colours for BNPL methods. The official Tabby/Tamara logo
// assets can be dropped into assets/ and wired via payment_methods.icon later.
const methodAccent = (code: string, COLORS: any): string => {
  if (code === 'tabby') return '#3EB6A0';
  if (code === 'tamara') return '#E0218A';
  return COLORS.primary;
};

export default function PaymentScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ orderId?: string; amount?: string; purpose?: string }>();
  const { language, isDark } = useApp();
  const COLORS = getColors(isDark);
  const SHADOWS = getShadows(isDark);
  const isRTL = language === 'ar';

  const orderId = params.orderId ?? '';
  const amountParam = params.amount ? Number(params.amount) : null;
  // 'delivery_fee' — the customer rejected the repair quote and only owes
  // the delivery/visit fee (inspection is free). Default 'repair'.
  const isDeliveryFee = params.purpose === 'delivery_fee';

  const [methods, setMethods] = useState<PaymentMethod[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Order pricing — loaded so accessories/add-ons can be shown and removed
  // before the customer pays. Delivery-fee payments skip this entirely.
  const [repairPrice, setRepairPrice] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [accessories, setAccessories] = useState<any[]>([]);
  const [protection, setProtection] = useState<any[]>([]);
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

  useEffect(() => {
    if (!orderId || isDeliveryFee) return;
    (async () => {
      const { data } = await supabase
        .from('orders')
        .select('final_price, estimated_price, discount_amount, delivery_fee, accessories, protection_addons')
        .eq('id', orderId)
        .maybeSingle();
      if (!data) return;
      setRepairPrice(Number((data as any).final_price ?? (data as any).estimated_price ?? 0));
      setDiscount(Number((data as any).discount_amount ?? 0));
      setDeliveryFee(Number((data as any).delivery_fee ?? 0));
      setAccessories(Array.isArray((data as any).accessories) ? (data as any).accessories : []);
      setProtection(Array.isArray((data as any).protection_addons) ? (data as any).protection_addons : []);
    })();
  }, [orderId, isDeliveryFee]);

  const addonRows = [
    ...accessories.map((a) => ({ ...a, kind: 'accessories' as const })),
    ...protection.map((p) => ({ ...p, kind: 'protection_addons' as const })),
  ];
  const addonsTotal = addonRows.reduce((s, a) => s + Number(a?.price ?? 0), 0);
  // The real amount the customer pays. For a delivery-fee payment we trust
  // the param; otherwise we compute it live so add-on removals are reflected.
  // Repair payment total now includes the delivery fee on the order — the
  // customer accepted the quote, so they owe repair + delivery (minus discount,
  // plus any add-ons). Delivery-fee-only payments still trust the param.
  const amount = isDeliveryFee
    ? amountParam
    : Math.max(0, repairPrice - discount + addonsTotal + deliveryFee);

  const removeAddon = async (row: { id: string; kind: 'accessories' | 'protection_addons' }) => {
    setRemovingId(row.id);
    try {
      const nextAcc = row.kind === 'accessories'
        ? accessories.filter((a) => a.id !== row.id)
        : accessories;
      const nextProt = row.kind === 'protection_addons'
        ? protection.filter((p) => p.id !== row.id)
        : protection;
      const { error } = await supabase
        .from('orders')
        .update({ accessories: nextAcc, protection_addons: nextProt })
        .eq('id', orderId);
      if (error) throw error;
      setAccessories(nextAcc);
      setProtection(nextProt);
    } catch (e: any) {
      Alert.alert(isRTL ? 'خطأ' : 'Error', getFriendlyError(e, language));
    } finally {
      setRemovingId(null);
    }
  };

  const handleConfirm = async () => {
    if (!orderId || !selected) {
      Alert.alert(isRTL ? 'تنبيه' : 'Notice', isRTL ? 'اختر طريقة دفع' : 'Select a payment method');
      return;
    }
    const method = methods?.find((m) => m.code === selected);
    if (!method || method.is_coming_soon) return;

    setSubmitting(true);
    try {
      // COD settles on completion → payment_status stays 'unpaid'.
      // Card / Apple Pay record the chosen method and set 'pending_payment'
      // — NOT 'paid' — because no server-side gateway has confirmed the
      // charge yet. A webhook / Edge Function must flip this to 'paid' once
      // the gateway responds.
      const isCod = method.code === 'cod';
      const { error } = await supabase
        .from('orders')
        .update({
          payment_method: method.code,
          payment_status: isCod ? 'unpaid' : 'pending_payment',
          status: isDeliveryFee ? 'cancelled' : 'accepted',
          updated_at: new Date().toISOString(),
        })
        .eq('id', orderId);
      if (error) throw error;

      Alert.alert(
        isRTL ? 'تم بنجاح ✓' : 'Done ✓',
        isDeliveryFee
          ? isCod
            ? isRTL
              ? 'تم تأكيد رسوم التوصيل وستُحصّل نقداً. تم إغلاق الطلب.'
              : 'Delivery fee confirmed — it will be collected in cash. The request is closed.'
            : isRTL
              ? 'تم حفظ طريقة الدفع. سيتم تحصيل رسوم التوصيل لاحقاً. تم إغلاق الطلب.'
              : 'Payment method saved. The delivery fee will be charged later. The request is now closed.'
          : isCod
            ? isRTL
              ? 'تم تأكيد طلبك. سيتم تحصيل المبلغ نقداً عند إتمام الإصلاح.'
              : 'Your order is confirmed. The amount will be collected in cash on completion.'
            : isRTL
              ? 'تم حفظ طريقة الدفع. سيتم تحصيل المبلغ عند إتمام الإصلاح.'
              : 'Payment method saved. You will be charged once the repair is complete.',
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
              {isDeliveryFee
                ? (isRTL ? 'رسوم التوصيل المستحقة' : 'Delivery fee due')
                : (isRTL ? 'المبلغ المطلوب' : 'Amount due')}
            </Text>
            <Text style={[styles.amountValue, { color: COLORS.primary }]}>
              {amount.toLocaleString(isRTL ? 'ar-SA' : 'en-US')} {isRTL ? 'ر.س' : 'SAR'}
            </Text>
          </View>
        )}

        {isDeliveryFee && (
          <View style={[styles.trustNote, { backgroundColor: COLORS.warning + '12', marginTop: 0, marginBottom: 18 }]}>
            <Ionicons name="information-circle" size={18} color={COLORS.warning} />
            <Text style={[styles.trustText, { color: COLORS.text }]}>
              {isRTL
                ? 'لقد رفضت عرض السعر. الفحص مجاني، وهذه رسوم التوصيل فقط.'
                : 'You rejected the repair quote. Inspection is free — this is the delivery fee only.'}
            </Text>
          </View>
        )}

        {/* Price breakdown — add-ons are removable before paying */}
        {!isDeliveryFee && (repairPrice > 0 || addonRows.length > 0 || deliveryFee > 0) && (
          <View style={[styles.breakdownCard, { backgroundColor: COLORS.card, borderColor: COLORS.border }]}>
            <Text style={[styles.breakdownTitle, { color: COLORS.text }]}>
              {isRTL ? 'تفاصيل المبلغ' : 'Price breakdown'}
            </Text>
            <View style={styles.bdRow}>
              <Text style={[styles.bdLabel, { color: COLORS.textSecondary }]}>
                {isRTL ? 'سعر الإصلاح' : 'Repair price'}
              </Text>
              <Text style={[styles.bdValue, { color: COLORS.text }]}>
                {repairPrice.toLocaleString(isRTL ? 'ar-SA' : 'en-US')} {isRTL ? 'ر.س' : 'SAR'}
              </Text>
            </View>
            {discount > 0 && (
              <View style={styles.bdRow}>
                <Text style={[styles.bdLabel, { color: COLORS.primary }]}>
                  {isRTL ? 'الخصم' : 'Discount'}
                </Text>
                <Text style={[styles.bdValue, { color: COLORS.primary }]}>
                  -{discount.toLocaleString(isRTL ? 'ar-SA' : 'en-US')} {isRTL ? 'ر.س' : 'SAR'}
                </Text>
              </View>
            )}
            {deliveryFee > 0 && (
              <View style={styles.bdRow}>
                <Text style={[styles.bdLabel, { color: COLORS.textSecondary }]}>
                  {isRTL ? 'رسوم التوصيل' : 'Delivery fee'}
                </Text>
                <Text style={[styles.bdValue, { color: COLORS.text }]}>
                  +{deliveryFee.toLocaleString(isRTL ? 'ar-SA' : 'en-US')} {isRTL ? 'ر.س' : 'SAR'}
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
                      +{Number(a.price ?? 0).toLocaleString(isRTL ? 'ar-SA' : 'en-US')} {isRTL ? 'ر.س' : 'SAR'}
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
            <View style={[styles.bdDivider, { backgroundColor: COLORS.border }]} />
            <View style={styles.bdRow}>
              <Text style={[styles.bdLabel, { color: COLORS.text, fontWeight: '800' }]}>
                {isRTL ? 'الإجمالي' : 'Total'}
              </Text>
              <Text style={[styles.bdValue, { color: COLORS.primary, fontSize: 16, fontWeight: '900' }]}>
                {(amount ?? 0).toLocaleString(isRTL ? 'ar-SA' : 'en-US')} {isRTL ? 'ر.س' : 'SAR'}
              </Text>
            </View>
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
