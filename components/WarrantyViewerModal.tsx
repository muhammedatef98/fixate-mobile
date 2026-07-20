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
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SPACING, BORDER_RADIUS } from '../constants/theme';
import { getInvoiceSettings, type InvoiceSettings } from '../services/invoiceService';
import { formatInvoiceDate } from '../services/invoicePdf';
import {
  buildWarrantyHtml,
  generateAndShareWarrantyPdf,
  certificateNumber,
  type WarrantyCertificateOrder,
} from '../services/warrantyPdf';
import { deriveWarranty, deviceLabel } from '../utils/warranty';
import { getFriendlyError } from '../utils/errorMessages';
import GearLoader from './GearLoader';
// react-native-webview ships a native module. On a dev client or a binary built
// before the dependency existed, importing it throws at module-eval, which would
// crash every screen that mounts this viewer. Require it lazily + defensively —
// same guard as InvoiceViewerModal — so the viewer degrades to summary +
// Download/Share instead of taking the screen down.
let WebView: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  WebView = require('react-native-webview').WebView;
} catch {
  WebView = null;
}

interface Props {
  order: WarrantyCertificateOrder;
  holderName: string;
  isRTL: boolean;
  COLORS: any;
  visible: boolean;
  onClose: () => void;
}

/**
 * Inline warranty-certificate viewer — the warranty counterpart to
 * InvoiceViewerModal. Opening it shows a quick summary; "View" renders the full
 * styled certificate inline in a WebView; "Download / Share" reuses the PDF share
 * flow. Used by both the customer warranty screen and admin warranties.
 */
export default function WarrantyViewerModal({ order, holderName, isRTL, COLORS, visible, onClose }: Props) {
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<InvoiceSettings | null>(null);
  const [html, setHtml] = useState<string | null>(null);
  const [building, setBuilding] = useState(false);
  const [showFull, setShowFull] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const styles = makeStyles(COLORS, isRTL);
  const webViewAvailable = !!WebView;
  const w = deriveWarranty(order);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const s = await getInvoiceSettings();
      setSettings(s);
    } catch (e) {
      setError(getFriendlyError(e, isRTL ? 'ar' : 'en'));
    } finally {
      setLoading(false);
    }
  }, [isRTL]);

  useEffect(() => {
    if (!visible) return;
    // Reset per-open state so reopening a different certificate is clean.
    setShowFull(false);
    setHtml(null);
    load();
  }, [visible, load]);

  const onView = async () => {
    if (!settings) return;
    if (html) {
      setShowFull(true);
      return;
    }
    setBuilding(true);
    try {
      const built = await buildWarrantyHtml(order, holderName, settings, isRTL);
      setHtml(built);
      setShowFull(true);
    } catch (e) {
      setError(getFriendlyError(e, isRTL ? 'ar' : 'en'));
    } finally {
      setBuilding(false);
    }
  };

  const onShare = async () => {
    if (sharing) return;
    setSharing(true);
    try {
      await generateAndShareWarrantyPdf(order, holderName, isRTL);
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
            {isRTL ? 'شهادة الضمان' : 'Warranty certificate'}
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
            <MaterialCommunityIcons name="shield-alert-outline" size={48} color={COLORS.textSecondary} />
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
          w && (
            <View style={styles.summaryWrap}>
              <View style={styles.summaryCard}>
                <SummaryRow label={isRTL ? 'رقم الشهادة' : 'Certificate #'} value={certificateNumber(order)} styles={styles} ltr />
                <SummaryRow label={isRTL ? 'الجهاز' : 'Device'} value={deviceLabel(order, isRTL)} styles={styles} />
                <SummaryRow label={isRTL ? 'تاريخ الإصدار' : 'Issued'} value={formatInvoiceDate(w.startDate.toISOString())} styles={styles} ltr />
                <View style={styles.divider} />
                <SummaryRow
                  label={isRTL ? 'ساري حتى' : 'Valid until'}
                  value={formatInvoiceDate(w.endDate.toISOString())}
                  styles={styles}
                  emphasize
                  ltr
                />
                <View style={[styles.statusPill, { backgroundColor: w.isActive ? COLORS.primary + '1A' : COLORS.border }]}>
                  <MaterialCommunityIcons
                    name={w.isActive ? 'shield-check' : 'shield-off-outline'}
                    size={14}
                    color={w.isActive ? COLORS.primary : COLORS.textSecondary}
                  />
                  <Text style={[styles.statusText, { color: w.isActive ? COLORS.primary : COLORS.textSecondary }]}>
                    {w.isActive
                      ? (isRTL ? `ساري · متبقٍّ ${w.daysRemaining} يوماً` : `Active · ${w.daysRemaining} days left`)
                      : (isRTL ? 'منتهٍ' : 'Expired')}
                  </Text>
                </View>
              </View>
              <Text style={styles.hint}>
                {webViewAvailable
                  ? (isRTL
                      ? 'اضغط «عرض» لمعاينة الشهادة كاملة، أو «تنزيل / مشاركة» لحفظها كملف PDF.'
                      : 'Tap "View" to preview the full certificate, or "Download / Share" to save it as a PDF.')
                  : (isRTL
                      ? 'اضغط «تنزيل / مشاركة» لفتح الشهادة كاملة كملف PDF.'
                      : 'Tap "Download / Share" to open the full certificate as a PDF.')}
              </Text>
            </View>
          )
        )}

        {/* Footer actions */}
        {!loading && !error && (
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
                accessibilityLabel={isRTL ? 'عرض الشهادة' : 'View certificate'}
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
    rowValueEmphasis: { fontSize: 16, fontWeight: '900', color: COLORS.primary },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: COLORS.border, marginVertical: 2 },
    statusPill: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      alignSelf: isRTL ? 'flex-end' : 'flex-start',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
      marginTop: 4,
    },
    statusText: { fontSize: 12.5, fontWeight: '800' },
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
