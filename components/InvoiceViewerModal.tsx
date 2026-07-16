import React, { useEffect, useState, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
// react-native-webview ships a native module (RNCWebViewModule). On a dev
// client or a binary built before this dependency was added, importing it
// throws at module-eval ("RNCWebViewModule could not be found"), which would
// crash EVERY screen that renders an invoice button (orders, my-orders,
// order-details). Require it lazily + defensively — exactly like OsmMap — so
// the viewer degrades to summary + Download/Share instead of taking the screen
// down. A native rebuild restores the inline preview.
let WebView: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  WebView = require('react-native-webview').WebView;
} catch {
  WebView = null;
}
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SPACING, BORDER_RADIUS } from '../constants/theme';
import {
  ensureInvoiceForOrder,
  getInvoiceSettings,
  type Invoice,
  type InvoiceSettings,
} from '../services/invoiceService';
import {
  buildInvoiceHtml,
  generateAndShareInvoicePdf,
  formatInvoiceDate,
} from '../services/invoicePdf';
import { getFriendlyError } from '../utils/errorMessages';
import { Riyal, SAR_TEXT } from './Riyal';
import GearLoader from './GearLoader';

interface Props {
  orderId: string;
  isRTL: boolean;
  COLORS: any;
  visible: boolean;
  onClose: () => void;
}

const money = (n: number, _isRTL: boolean, _currency = SAR_TEXT): React.ReactNode => {
  const v = (Number(n) || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return (
    <>
      {'\u2066'}<Riyal /> {v}{'\u2069'}
    </>
  );
};

/**
 * Inline invoice viewer. Opening it loads the invoice (idempotent RPC) and
 * shows a quick summary. "View" lazily renders the full styled invoice inline
 * in a WebView (fast open, heavy render only on demand); "Download / Share"
 * reuses the existing PDF share flow. Solves the iOS issue where tapping an
 * invoice forced a save/share with no inline preview.
 */
export default function InvoiceViewerModal({ orderId, isRTL, COLORS, visible, onClose }: Props) {
  const [loading, setLoading] = useState(true);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [settings, setSettings] = useState<InvoiceSettings | null>(null);
  const [html, setHtml] = useState<string | null>(null);
  const [building, setBuilding] = useState(false);
  const [showFull, setShowFull] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const styles = makeStyles(COLORS, isRTL);
  // Inline preview needs the native webview module; when it's absent we hide
  // the "View" button and only offer Download/Share (which uses Print/Sharing).
  const webViewAvailable = !!WebView;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [inv, s] = await Promise.all([ensureInvoiceForOrder(orderId), getInvoiceSettings()]);
      if (!inv) {
        setError(
          isRTL
            ? 'تتوفر الفاتورة بعد اكتمال الطلب.'
            : 'The invoice is available once the order is completed.'
        );
        return;
      }
      setInvoice(inv);
      setSettings(s);
    } catch (e) {
      setError(getFriendlyError(e, isRTL ? 'ar' : 'en'));
    } finally {
      setLoading(false);
    }
  }, [orderId, isRTL]);

  useEffect(() => {
    if (!visible) return;
    // Reset per-open state so reopening a different order is clean.
    setShowFull(false);
    setHtml(null);
    load();
  }, [visible, load]);

  const onView = async () => {
    if (!invoice || !settings) return;
    if (html) {
      setShowFull(true);
      return;
    }
    setBuilding(true);
    try {
      const built = await buildInvoiceHtml(invoice, settings, isRTL);
      setHtml(built);
      setShowFull(true);
    } catch (e) {
      setError(getFriendlyError(e, isRTL ? 'ar' : 'en'));
    } finally {
      setBuilding(false);
    }
  };

  const onShare = async () => {
    if (!invoice || sharing) return;
    setSharing(true);
    try {
      await generateAndShareInvoicePdf(invoice, isRTL, settings ?? undefined);
    } catch {
      // Sharing being cancelled or unavailable must not crash the viewer.
    } finally {
      setSharing(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}
    >
      <View style={[styles.container, { backgroundColor: COLORS.background }]}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {isRTL ? 'الفاتورة الضريبية' : 'Tax invoice'}
          </Text>
          <TouchableOpacity
            onPress={onClose}
            style={styles.closeBtn}
            accessibilityRole="button"
            accessibilityLabel={isRTL ? 'إغلاق' : 'Close'}
          >
            <MaterialCommunityIcons name="close" size={22} color={COLORS.text} />
          </TouchableOpacity>
        </View>

        {/* Body */}
        {loading ? (
          <View style={styles.center}>
            <GearLoader size={48} />
          </View>
        ) : error ? (
          <View style={styles.center}>
            <MaterialCommunityIcons name="receipt-text-outline" size={48} color={COLORS.textSecondary} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : showFull && html && webViewAvailable ? (
          <WebView
            originWhitelist={['*']}
            source={{ html }}
            style={{ flex: 1, backgroundColor: '#fff' }}
            showsVerticalScrollIndicator
          />
        ) : (
          invoice && (
            <View style={styles.summaryWrap}>
              <View style={styles.summaryCard}>
                <SummaryRow label={isRTL ? 'رقم الفاتورة' : 'Invoice #'} value={invoice.invoice_number} styles={styles} ltr />
                <SummaryRow label={isRTL ? 'التاريخ' : 'Date'} value={formatInvoiceDate(invoice.issued_at)} styles={styles} ltr />
                {!!invoice.customer_name && (
                  <SummaryRow label={isRTL ? 'العميل' : 'Customer'} value={invoice.customer_name} styles={styles} />
                )}
                <View style={styles.divider} />
                <SummaryRow
                  label={isRTL ? 'الإجمالي' : 'Total'}
                  value={money(invoice.total, isRTL, invoice.currency)}
                  styles={styles}
                  emphasize
                />
              </View>
              <Text style={styles.hint}>
                {webViewAvailable
                  ? (isRTL
                      ? 'اضغط «عرض» لمعاينة الفاتورة كاملة، أو «تنزيل / مشاركة» لحفظها كملف PDF.'
                      : 'Tap "View" to preview the full invoice, or "Download / Share" to save it as a PDF.')
                  : (isRTL
                      ? 'اضغط «تنزيل / مشاركة» لفتح الفاتورة كاملة كملف PDF.'
                      : 'Tap "Download / Share" to open the full invoice as a PDF.')}
              </Text>
            </View>
          )
        )}

        {/* Footer actions */}
        {!loading && !error && invoice && (
          <View style={styles.footer}>
            {showFull ? (
              <TouchableOpacity
                style={[styles.btn, styles.btnSecondary]}
                onPress={() => setShowFull(false)}
                accessibilityRole="button"
              >
                <MaterialCommunityIcons name="arrow-left" size={18} color={COLORS.primary} />
                <Text style={[styles.btnText, { color: COLORS.primary }]}>
                  {isRTL ? 'رجوع' : 'Back'}
                </Text>
              </TouchableOpacity>
            ) : webViewAvailable ? (
              <TouchableOpacity
                style={[styles.btn, styles.btnSecondary]}
                onPress={onView}
                disabled={building}
                accessibilityRole="button"
                accessibilityLabel={isRTL ? 'عرض الفاتورة' : 'View invoice'}
              >
                {building ? (
                  <ActivityIndicator size="small" color={COLORS.primary} />
                ) : (
                  <>
                    <MaterialCommunityIcons name="eye-outline" size={18} color={COLORS.primary} />
                    <Text style={[styles.btnText, { color: COLORS.primary }]}>
                      {isRTL ? 'عرض' : 'View'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity
              style={[styles.btn, styles.btnPrimary, { backgroundColor: COLORS.primary }]}
              onPress={onShare}
              disabled={sharing}
              accessibilityRole="button"
              accessibilityLabel={isRTL ? 'تنزيل أو مشاركة' : 'Download or share'}
            >
              {sharing ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <MaterialCommunityIcons name="download" size={18} color="#fff" />
                  <Text style={[styles.btnText, { color: '#fff' }]}>
                    {isRTL ? 'تنزيل / مشاركة' : 'Download / Share'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Modal>
  );
}

function SummaryRow({
  label,
  value,
  styles,
  emphasize,
  ltr,
}: {
  label: string;
  value: React.ReactNode;
  styles: any;
  emphasize?: boolean;
  ltr?: boolean;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text
        style={[styles.rowValue, emphasize && styles.rowValueEmphasis, ltr && { writingDirection: 'ltr' as const }]}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

const makeStyles = (COLORS: any, isRTL: boolean) =>
  StyleSheet.create({
    container: { flex: 1 },
    header: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: COLORS.border,
    },
    headerTitle: { fontSize: 17, fontWeight: '800', color: COLORS.text, flex: 1, textAlign: isRTL ? 'right' : 'left' },
    closeBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.xl, gap: 12 },
    errorText: { color: COLORS.textSecondary, fontSize: 14, textAlign: 'center', lineHeight: 22 },
    summaryWrap: { padding: SPACING.lg, gap: 14 },
    summaryCard: {
      backgroundColor: COLORS.card,
      borderRadius: BORDER_RADIUS.lg,
      borderWidth: 1,
      borderColor: COLORS.border,
      padding: SPACING.lg,
      gap: 10,
    },
    row: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    rowLabel: { fontSize: 13, color: COLORS.textSecondary },
    rowValue: { fontSize: 14, fontWeight: '700', color: COLORS.text, flexShrink: 1, textAlign: isRTL ? 'left' : 'right' },
    rowValueEmphasis: { fontSize: 18, fontWeight: '900', color: COLORS.primary },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: COLORS.border, marginVertical: 2 },
    hint: { fontSize: 12.5, color: COLORS.textSecondary, lineHeight: 20, textAlign: isRTL ? 'right' : 'left' },
    footer: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      gap: 12,
      padding: SPACING.lg,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: COLORS.border,
    },
    btn: {
      flex: 1,
      height: 50,
      borderRadius: BORDER_RADIUS.lg,
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    btnSecondary: { borderWidth: 1.5, borderColor: COLORS.primary, backgroundColor: 'transparent' },
    btnPrimary: {},
    btnText: { fontSize: 15, fontWeight: '800' },
  });
