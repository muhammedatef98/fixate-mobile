import React, { useState } from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, Alert, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ensureInvoiceForOrder } from '../services/invoiceService';
import { generateAndShareInvoicePdf } from '../services/invoicePdf';
import { getFriendlyError } from '../utils/errorMessages';

interface Props {
  orderId: string;
  isRTL: boolean;
  COLORS: any;
  /** 'card' = full-width prominent action; 'inline' = compact pill (lists). */
  variant?: 'card' | 'inline';
}

/**
 * Customer-facing invoice download. Ensures the invoice exists on the server
 * (idempotent RPC), then generates the PDF from the shared template and opens
 * the share/save sheet. Safe to drop into any completed-order surface.
 */
export default function InvoiceDownloadButton({ orderId, isRTL, COLORS, variant = 'card' }: Props) {
  const [busy, setBusy] = useState(false);

  const onPress = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const invoice = await ensureInvoiceForOrder(orderId);
      if (!invoice) {
        Alert.alert(
          isRTL ? 'الفاتورة غير متاحة' : 'Invoice unavailable',
          isRTL ? 'تتوفر الفاتورة بعد اكتمال الطلب.' : 'The invoice is available once the order is completed.'
        );
        return;
      }
      await generateAndShareInvoicePdf(invoice, isRTL);
    } catch (e) {
      Alert.alert(isRTL ? 'تعذّر إنشاء الفاتورة' : 'Could not generate invoice', getFriendlyError(e, isRTL ? 'ar' : 'en'));
    } finally {
      setBusy(false);
    }
  };

  if (variant === 'inline') {
    return (
      <TouchableOpacity
        style={[styles.inline, { borderColor: COLORS.primary }]}
        onPress={onPress}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel={isRTL ? 'تنزيل الفاتورة' : 'Download invoice'}
      >
        {busy ? (
          <ActivityIndicator size="small" color={COLORS.primary} />
        ) : (
          <>
            <MaterialCommunityIcons name="file-download-outline" size={15} color={COLORS.primary} />
            <Text style={[styles.inlineText, { color: COLORS.primary }]}>{isRTL ? 'الفاتورة' : 'Invoice'}</Text>
          </>
        )}
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: COLORS.primary + '12', borderColor: COLORS.primary + '40', flexDirection: isRTL ? 'row-reverse' : 'row' }]}
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel={isRTL ? 'تنزيل الفاتورة' : 'Download invoice'}
    >
      <View style={[styles.iconWrap, { backgroundColor: COLORS.primary }]}>
        {busy ? <ActivityIndicator size="small" color="#fff" /> : <MaterialCommunityIcons name="receipt" size={20} color="#fff" />}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.title, { color: COLORS.text, textAlign: isRTL ? 'right' : 'left' }]}>
          {isRTL ? 'الفاتورة الضريبية' : 'Tax invoice'}
        </Text>
        <Text style={[styles.sub, { color: COLORS.textSecondary, textAlign: isRTL ? 'right' : 'left' }]}>
          {isRTL ? 'تنزيل أو مشاركة فاتورة PDF بكامل التفاصيل' : 'Download or share the full PDF invoice'}
        </Text>
      </View>
      <MaterialCommunityIcons name="download" size={22} color={COLORS.primary} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, borderWidth: 1 },
  iconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 15, fontWeight: '800' },
  sub: { fontSize: 12, marginTop: 2 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1.5 },
  inlineText: { fontSize: 12, fontWeight: '800' },
});
