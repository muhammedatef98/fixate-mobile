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
  TextInput,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useApp } from '../contexts/AppContext';
import { getColors, SPACING, BORDER_RADIUS } from '../constants/theme';
import { RTLIonicon } from '../components/RTLIcon';
import { safeBack } from '../utils/navigation';
import { supabase } from '../services/supabaseClient';
import { getFriendlyError } from '../utils/errorMessages';

// Zero-setup payment methods that ship today. No merchant account, no API
// keys. Cash collected on completion, bank transfer to a fixed Fixate IBAN
// with a customer-supplied reference. The card method is here behind a
// "soon" pill — it activates the moment a STRIPE_SECRET_KEY is set on the
// create-payment Edge Function.
const FIXATE_IBAN = 'SA0380000000608010167519';
const FIXATE_BANK = 'مصرف الراجحي';

type Method = 'cash' | 'transfer' | 'card';

export default function PaymentScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ orderId?: string; amount?: string }>();
  const { language, isDark } = useApp();
  const COLORS = getColors(isDark);
  const isRTL = language === 'ar';

  const orderId = params.orderId ?? '';
  const amount = params.amount ? Number(params.amount) : null;

  const [selected, setSelected] = useState<Method>('cash');
  const [reference, setReference] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const copyIBAN = async () => {
    await Clipboard.setStringAsync(FIXATE_IBAN);
    Alert.alert(
      isRTL ? 'تم النسخ ✓' : 'Copied ✓',
      isRTL ? 'تم نسخ رقم الـ IBAN' : 'IBAN copied to clipboard'
    );
  };

  const handleConfirm = async () => {
    if (!orderId) {
      Alert.alert(isRTL ? 'خطأ' : 'Error', isRTL ? 'لا يوجد طلب' : 'No order id');
      return;
    }
    if (selected === 'transfer' && !reference.trim()) {
      Alert.alert(
        isRTL ? 'تنبيه' : 'Notice',
        isRTL
          ? 'الرجاء إدخال رقم العملية أو ملاحظة قصيرة عن التحويل'
          : 'Please add the transfer reference or a short note'
      );
      return;
    }
    setSubmitting(true);
    try {
      // payment_status: 'unpaid' until the technician confirms cash on completion,
      // 'pending' once the customer claims they transferred so the admin can verify.
      const newStatus = selected === 'cash' ? 'unpaid' : selected === 'transfer' ? 'pending' : 'pending';
      const { error } = await supabase
        .from('orders')
        .update({
          payment_method: selected,
          payment_status: newStatus,
          payment_reference: selected === 'transfer' ? reference.trim() : null,
        })
        .eq('id', orderId);
      if (error) throw error;

      const messages: Record<Method, [string, string]> = {
        cash: [
          isRTL ? 'تم تأكيد الدفع نقدًا' : 'Cash on delivery confirmed',
          isRTL
            ? 'سيتم استلام المبلغ مباشرة من الفني عند إتمام الإصلاح'
            : "You'll pay the technician directly on completion",
        ],
        transfer: [
          isRTL ? 'تم استلام طلب التحويل' : 'Transfer recorded',
          isRTL
            ? 'سنتحقق من التحويل خلال دقائق ونرسل إشعارًا بالتأكيد'
            : "We'll verify the transfer within minutes and notify you",
        ],
        card: [
          isRTL ? 'قريبًا' : 'Coming soon',
          isRTL ? 'الدفع بالبطاقة قيد التفعيل' : 'Card payment is being activated',
        ],
      };
      const [title, body] = messages[selected];
      Alert.alert(title, body, [
        { text: 'OK', onPress: () => safeBack(`/order-details?id=${orderId}` as any) },
      ]);
    } catch (e: any) {
      Alert.alert(isRTL ? 'خطأ' : 'Error', getFriendlyError(e, language));
    } finally {
      setSubmitting(false);
    }
  };

  const styles = makeStyles(COLORS, isRTL);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => safeBack()} style={styles.backBtn}>
          <RTLIonicon name="chevron-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: COLORS.text }]}>
          {isRTL ? 'طريقة الدفع' : 'Payment method'}
        </Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 40 }}>
        {/* Amount card */}
        {amount ? (
          <View style={[styles.amountCard, { backgroundColor: COLORS.primary + '12', borderColor: COLORS.primary + '30' }]}>
            <Text style={[styles.amountLabel, { color: COLORS.textSecondary }]}>
              {isRTL ? 'المبلغ المطلوب' : 'Amount due'}
            </Text>
            <Text style={[styles.amountValue, { color: COLORS.primary }]}>
              {isRTL ? `${amount} ر.س` : `${amount} SAR`}
            </Text>
          </View>
        ) : null}

        <Text style={[styles.sectionLabel, { color: COLORS.text }]}>
          {isRTL ? 'اختر طريقة الدفع' : 'Choose how to pay'}
        </Text>

        {/* Cash on delivery */}
        <PaymentRow
          selected={selected === 'cash'}
          onPress={() => setSelected('cash')}
          icon="cash-multiple"
          color="#10b981"
          title={isRTL ? 'الدفع نقدًا عند الإستلام' : 'Cash on delivery'}
          subtitle={
            isRTL ? 'ادفع للفني مباشرةً عند إتمام الإصلاح' : 'Pay the technician on completion'
          }
          recommended
          COLORS={COLORS}
          isRTL={isRTL}
        />

        {/* Bank transfer */}
        <PaymentRow
          selected={selected === 'transfer'}
          onPress={() => setSelected('transfer')}
          icon="bank-outline"
          color="#3b82f6"
          title={isRTL ? 'تحويل بنكي' : 'Bank transfer'}
          subtitle={
            isRTL ? 'حوّل للحساب البنكي وأرفق رقم العملية' : 'Transfer + paste reference number'
          }
          COLORS={COLORS}
          isRTL={isRTL}
        />

        {/* Bank-transfer details, only when selected */}
        {selected === 'transfer' && (
          <View style={[styles.transferBox, { backgroundColor: COLORS.card, borderColor: COLORS.border }]}>
            <View style={styles.transferRow}>
              <Text style={[styles.transferLabel, { color: COLORS.textSecondary }]}>
                {isRTL ? 'البنك' : 'Bank'}
              </Text>
              <Text style={[styles.transferValue, { color: COLORS.text }]}>
                {isRTL ? FIXATE_BANK : 'Al-Rajhi Bank'}
              </Text>
            </View>
            <View style={styles.transferRow}>
              <Text style={[styles.transferLabel, { color: COLORS.textSecondary }]}>IBAN</Text>
              <TouchableOpacity onPress={copyIBAN} style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 6, flex: 1, justifyContent: 'flex-end' }}>
                <Text style={[styles.transferValue, { color: COLORS.primary }]} numberOfLines={1}>
                  {FIXATE_IBAN}
                </Text>
                <Ionicons name="copy-outline" size={16} color={COLORS.primary} />
              </TouchableOpacity>
            </View>
            <View style={styles.transferRow}>
              <Text style={[styles.transferLabel, { color: COLORS.textSecondary }]}>
                {isRTL ? 'المستفيد' : 'Beneficiary'}
              </Text>
              <Text style={[styles.transferValue, { color: COLORS.text }]}>Fixate</Text>
            </View>

            <Text style={[styles.transferHint, { color: COLORS.textSecondary }]}>
              {isRTL
                ? 'بعد إتمام التحويل، الصق رقم العملية بالأسفل وسنتحقق منه خلال دقائق'
                : "After transferring, paste the reference below — we'll verify it within minutes"}
            </Text>

            <TextInput
              value={reference}
              onChangeText={setReference}
              placeholder={isRTL ? 'مثال: REF-983241 أو رقم العملية' : 'e.g. REF-983241 or transaction id'}
              placeholderTextColor={COLORS.textSecondary}
              style={[styles.refInput, { color: COLORS.text, borderColor: COLORS.border, backgroundColor: COLORS.background }]}
              textAlign={isRTL ? 'right' : 'left'}
              autoCapitalize="characters"
            />
          </View>
        )}

        {/* Card payment placeholder */}
        <PaymentRow
          selected={selected === 'card'}
          onPress={() => setSelected('card')}
          icon="credit-card-outline"
          color="#8b5cf6"
          title={isRTL ? 'بطاقة بنكية / Apple Pay' : 'Card / Apple Pay'}
          subtitle={isRTL ? 'مدى، فيزا، ماستركارد، Apple Pay' : 'Mada, Visa, Mastercard, Apple Pay'}
          comingSoon
          COLORS={COLORS}
          isRTL={isRTL}
        />

        {/* Trust note */}
        <View style={[styles.trustNote, { backgroundColor: COLORS.primary + '10' }]}>
          <Ionicons name="shield-checkmark" size={18} color={COLORS.primary} />
          <Text style={[styles.trustText, { color: COLORS.text }]}>
            {isRTL
              ? 'كل العمليات مؤمّنة وتشمل ضمان 6 أشهر على الإصلاح'
              : 'All transactions are secured and include a 6-month repair warranty'}
          </Text>
        </View>

        <TouchableOpacity
          onPress={handleConfirm}
          disabled={submitting || (selected === 'card')}
          style={[
            styles.confirmBtn,
            { backgroundColor: COLORS.primary },
            (submitting || selected === 'card') && { opacity: 0.5 },
          ]}
          accessibilityRole="button"
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.confirmText}>
              {selected === 'card'
                ? (isRTL ? 'قريبًا' : 'Coming soon')
                : (isRTL ? 'تأكيد الدفع' : 'Confirm payment')}
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function PaymentRow({
  selected,
  onPress,
  icon,
  color,
  title,
  subtitle,
  recommended,
  comingSoon,
  COLORS,
  isRTL,
}: any) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        backgroundColor: COLORS.card,
        borderColor: selected ? COLORS.primary : COLORS.border,
        borderWidth: selected ? 2 : 1,
        borderRadius: BORDER_RADIUS.lg,
        padding: 14,
        marginBottom: 10,
        gap: 12,
      }}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
    >
      <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: color + '15', alignItems: 'center', justifyContent: 'center' }}>
        <MaterialCommunityIcons name={icon} size={22} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ color: COLORS.text, fontSize: 14, fontWeight: '700' }}>{title}</Text>
          {recommended && (
            <View style={{ backgroundColor: '#10b98115', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 }}>
              <Text style={{ color: '#10b981', fontSize: 10, fontWeight: '800' }}>
                {isRTL ? 'موصى به' : 'Recommended'}
              </Text>
            </View>
          )}
          {comingSoon && (
            <View style={{ backgroundColor: COLORS.textSecondary + '20', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 }}>
              <Text style={{ color: COLORS.textSecondary, fontSize: 10, fontWeight: '800' }}>
                {isRTL ? 'قريبًا' : 'Soon'}
              </Text>
            </View>
          )}
        </View>
        <Text style={{ color: COLORS.textSecondary, fontSize: 12, marginTop: 2 }}>{subtitle}</Text>
      </View>
      <View
        style={{
          width: 22, height: 22, borderRadius: 11,
          borderWidth: 2,
          borderColor: selected ? COLORS.primary : COLORS.border,
          alignItems: 'center', justifyContent: 'center',
        }}
      >
        {selected && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.primary }} />}
      </View>
    </TouchableOpacity>
  );
}

const makeStyles = (C: any, isRTL: boolean) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    header: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 12,
      paddingVertical: 10,
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
    title: { fontSize: 17, fontWeight: '700' },

    amountCard: {
      borderRadius: BORDER_RADIUS.lg,
      borderWidth: 1,
      padding: 18,
      alignItems: 'center',
      marginBottom: 18,
    },
    amountLabel: { fontSize: 12, fontWeight: '500' },
    amountValue: { fontSize: 30, fontWeight: '800', marginTop: 4 },

    sectionLabel: {
      fontSize: 13,
      fontWeight: '700',
      marginBottom: 10,
      textAlign: isRTL ? 'right' : 'left',
    },

    transferBox: {
      borderRadius: BORDER_RADIUS.lg,
      borderWidth: 1,
      padding: 14,
      marginBottom: 10,
      gap: 10,
    },
    transferRow: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 12,
    },
    transferLabel: { fontSize: 12 },
    transferValue: { fontSize: 13, fontWeight: '700' },
    transferHint: { fontSize: 11, lineHeight: 16, marginTop: 4, textAlign: isRTL ? 'right' : 'left' },
    refInput: {
      borderWidth: 1,
      borderRadius: BORDER_RADIUS.md,
      padding: 12,
      fontSize: 14,
      marginTop: 4,
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
      paddingVertical: 16,
      borderRadius: BORDER_RADIUS.md,
      alignItems: 'center',
    },
    confirmText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  });
