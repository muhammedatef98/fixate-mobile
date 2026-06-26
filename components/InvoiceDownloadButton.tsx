import React, { useState } from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import InvoiceViewerModal from './InvoiceViewerModal';

interface Props {
  orderId: string;
  isRTL: boolean;
  COLORS: any;
  /** 'card' = full-width prominent action; 'inline' = compact pill (lists). */
  variant?: 'card' | 'inline';
}

/**
 * Customer-facing invoice entry point. Tapping it opens an inline viewer
 * (InvoiceViewerModal) that previews the invoice and offers View +
 * Download/Share — instead of forcing an immediate save/share sheet with no
 * preview. Safe to drop into any completed-order surface.
 */
export default function InvoiceDownloadButton({ orderId, isRTL, COLORS, variant = 'card' }: Props) {
  const [busy] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);

  const onPress = () => setViewerOpen(true);

  const viewer = (
    <InvoiceViewerModal
      orderId={orderId}
      isRTL={isRTL}
      COLORS={COLORS}
      visible={viewerOpen}
      onClose={() => setViewerOpen(false)}
    />
  );

  if (variant === 'inline') {
    return (
      <>
        <TouchableOpacity
          style={[styles.inline, { borderColor: COLORS.primary }]}
          onPress={onPress}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={isRTL ? 'عرض الفاتورة' : 'View invoice'}
        >
          {busy ? (
            <ActivityIndicator size="small" color={COLORS.primary} />
          ) : (
            <>
              <MaterialCommunityIcons name="receipt-text-outline" size={15} color={COLORS.primary} />
              <Text style={[styles.inlineText, { color: COLORS.primary }]}>{isRTL ? 'الفاتورة' : 'Invoice'}</Text>
            </>
          )}
        </TouchableOpacity>
        {viewer}
      </>
    );
  }

  return (
    <>
      <TouchableOpacity
        style={[styles.card, { backgroundColor: COLORS.primary + '12', borderColor: COLORS.primary + '40', flexDirection: isRTL ? 'row-reverse' : 'row' }]}
        onPress={onPress}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel={isRTL ? 'عرض الفاتورة' : 'View invoice'}
      >
        <View style={[styles.iconWrap, { backgroundColor: COLORS.primary }]}>
          {busy ? <ActivityIndicator size="small" color="#fff" /> : <MaterialCommunityIcons name="receipt" size={20} color="#fff" />}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: COLORS.text, textAlign: isRTL ? 'right' : 'left' }]}>
            {isRTL ? 'الفاتورة الضريبية' : 'Tax invoice'}
          </Text>
          <Text style={[styles.sub, { color: COLORS.textSecondary, textAlign: isRTL ? 'right' : 'left' }]}>
            {isRTL ? 'عرض الفاتورة أو تنزيلها كملف PDF' : 'View the invoice or download it as a PDF'}
          </Text>
        </View>
        <MaterialCommunityIcons name="chevron-left" size={22} color={COLORS.primary} style={{ transform: [{ scaleX: isRTL ? 1 : -1 }] }} />
      </TouchableOpacity>
      {viewer}
    </>
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
