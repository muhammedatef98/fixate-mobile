import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SPACING, BORDER_RADIUS } from '../constants/theme';
import type { PricingBreakdown, InvoiceLine } from '../services/pricingService';
import { useLoyalty } from '../contexts/LoyaltyContext';

interface Props {
  breakdown: PricingBreakdown;
  isRTL: boolean;
  COLORS: any;
  /** Hide the commitment row (e.g. when admin disabled the feature). */
  hideCommitment?: boolean;
  /** Optional title override. */
  title?: string;
}

const fmt = (n: number, isRTL: boolean) =>
  `${n.toLocaleString(isRTL ? 'ar-SA' : 'en-US')} ${isRTL ? 'ر.س' : 'SAR'}`;

export default function InvoiceBreakdown({
  breakdown,
  isRTL,
  COLORS,
  hideCommitment,
  title,
}: Props) {
  const styles = createStyles(COLORS, isRTL);
  // Feature-flag gate — when loyalty is off in platform settings the row
  // is hidden entirely even if the pricing service still calculates
  // points for backwards compatibility with historical orders.
  const { enabled: loyaltyEnabled } = useLoyalty();

  const lines = hideCommitment
    ? breakdown.lines.filter((l) => l.kind !== 'commitment')
    : breakdown.lines;

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <MaterialCommunityIcons name="receipt" size={20} color={COLORS.primary} />
        <Text style={styles.title}>
          {title ?? (isRTL ? 'تفاصيل الفاتورة' : 'Invoice breakdown')}
        </Text>
      </View>

      {lines.map((l) => (
        <Row key={l.id} line={l} isRTL={isRTL} COLORS={COLORS} />
      ))}

      <View style={styles.divider} />

      <View style={styles.totalRow}>
        <Text style={styles.subtotalLabel}>
          {isRTL ? 'المجموع الفرعي' : 'Subtotal'}
        </Text>
        <Text style={styles.subtotalValue}>{fmt(breakdown.subtotal, isRTL)}</Text>
      </View>
      {breakdown.discountTotal > 0 && (
        <View style={styles.totalRow}>
          <Text style={[styles.subtotalLabel, { color: COLORS.primary }]}>
            {isRTL ? 'إجمالي الخصم' : 'Discount total'}
          </Text>
          <Text style={[styles.subtotalValue, { color: COLORS.primary }]}>
            -{fmt(breakdown.discountTotal, isRTL)}
          </Text>
        </View>
      )}

      <View style={[styles.totalRow, { marginTop: 6 }]}>
        <Text style={styles.totalLabel}>
          {isRTL ? 'الإجمالي النهائي' : 'Final total'}
        </Text>
        <Text style={styles.totalValue}>{fmt(breakdown.total, isRTL)}</Text>
      </View>

      {!hideCommitment && breakdown.commitmentDue > 0 && (
        <View style={styles.dueNow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.dueNowLabel}>
              {isRTL ? 'المستحق الآن' : 'Due now'}
            </Text>
            <Text style={styles.dueNowHint}>
              {isRTL
                ? 'مبلغ التأكيد يُدفع قبل بدء الفحص ويُخصم من الفاتورة النهائية.'
                : 'Commitment paid before inspection. Deducted from the final bill.'}
            </Text>
          </View>
          <Text style={styles.dueNowValue}>{fmt(breakdown.commitmentDue, isRTL)}</Text>
        </View>
      )}

      {loyaltyEnabled && breakdown.pointsEarned > 0 && (
        <View style={styles.loyaltyRow}>
          <MaterialCommunityIcons name="star-four-points" size={14} color={COLORS.primary} />
          <Text style={styles.loyaltyText}>
            {isRTL
              ? `ستحصل على +${breakdown.pointsEarned} نقطة ولاء عند إكمال الإصلاح`
              : `You will earn +${breakdown.pointsEarned} loyalty points on completion`}
          </Text>
        </View>
      )}
    </View>
  );
}

function Row({
  line,
  isRTL,
  COLORS,
}: {
  line: InvoiceLine;
  isRTL: boolean;
  COLORS: any;
}) {
  const styles = createStyles(COLORS, isRTL);
  const isDiscount = line.amount < 0;
  return (
    <View style={styles.line}>
      <View style={{ flex: 1 }}>
        <Text style={styles.lineLabel}>
          {isRTL ? line.labelAr : line.labelEn}
        </Text>
        {(line.noteAr || line.noteEn) ? (
          <Text style={styles.lineNote}>
            {isRTL ? line.noteAr : line.noteEn}
          </Text>
        ) : null}
      </View>
      <Text
        style={[
          styles.lineAmount,
          isDiscount && { color: COLORS.primary, fontWeight: '700' },
        ]}
      >
        {isDiscount ? '-' : ''}
        {fmt(Math.abs(line.amount), isRTL)}
      </Text>
    </View>
  );
}

const createStyles = (C: any, isRTL: boolean) =>
  StyleSheet.create({
    card: {
      backgroundColor: C.card,
      borderRadius: BORDER_RADIUS.lg ?? 14,
      padding: SPACING.lg ?? 16,
      borderWidth: 1,
      borderColor: C.border,
    },
    headerRow: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 12,
    },
    title: {
      fontSize: 16,
      fontWeight: '800',
      color: C.text,
      textAlign: isRTL ? 'right' : 'left',
    },
    line: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      paddingVertical: 8,
      gap: 12,
    },
    lineLabel: {
      color: C.text,
      fontSize: 14,
      fontWeight: '600',
      textAlign: isRTL ? 'right' : 'left',
    },
    lineNote: {
      color: C.textSecondary ?? C.gray,
      fontSize: 11,
      marginTop: 2,
      textAlign: isRTL ? 'right' : 'left',
    },
    lineAmount: {
      color: C.text,
      fontSize: 14,
      fontWeight: '700',
    },
    divider: {
      height: 1,
      backgroundColor: C.border,
      marginVertical: 10,
    },
    totalRow: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 4,
    },
    subtotalLabel: { color: C.textSecondary ?? C.gray, fontSize: 13, fontWeight: '600' },
    subtotalValue: { color: C.text, fontSize: 13, fontWeight: '700' },
    totalLabel: {
      color: C.text,
      fontSize: 16,
      fontWeight: '800',
    },
    totalValue: {
      color: C.primary,
      fontSize: 18,
      fontWeight: '800',
    },
    dueNow: {
      marginTop: 12,
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: (C.primarySoft ?? C.lightGreen) ?? C.primary + '15',
      borderRadius: BORDER_RADIUS.md ?? 10,
      padding: 12,
    },
    dueNowLabel: {
      color: C.primary,
      fontWeight: '800',
      fontSize: 14,
      textAlign: isRTL ? 'right' : 'left',
    },
    dueNowHint: {
      color: C.textSecondary ?? C.gray,
      fontSize: 11,
      marginTop: 2,
      textAlign: isRTL ? 'right' : 'left',
    },
    dueNowValue: {
      color: C.primary,
      fontWeight: '800',
      fontSize: 18,
    },
    loyaltyRow: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 10,
    },
    loyaltyText: {
      color: C.textSecondary ?? C.gray,
      fontSize: 12,
      textAlign: isRTL ? 'right' : 'left',
      flex: 1,
    },
  });
