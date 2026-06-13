import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Pressable,
  Alert,
  TextInput,
  Switch,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useApp } from '../contexts/AppContext';
import { getColors, SPACING, BORDER_RADIUS } from '../constants/theme';
import {
  AdminScreenHeader,
  AdminSearchBar,
  AdminFilterChips,
  AdminEmptyState,
  AdminStatusPill,
  ADMIN_CARD_SHADOW,
  type AdminFilterChip,
  type StatusTone,
} from '../components/admin/AdminUI';
import { useRequirePermission } from '../hooks/usePermissions';
import {
  listInvoices,
  getInvoiceSettings,
  saveInvoiceSettings,
  updateInvoiceStatus,
  type Invoice,
  type InvoiceStatus,
  type InvoiceSettings,
} from '../services/invoiceService';
import { generateAndShareInvoicePdf } from '../services/invoicePdf';
import { getFriendlyError } from '../utils/errorMessages';

type Tab = 'invoices' | 'settings';
type Filter = InvoiceStatus | 'all';

const statusTone = (s: InvoiceStatus): { tone: StatusTone; icon: string } => {
  switch (s) {
    case 'paid': return { tone: 'success', icon: 'checkmark-circle' };
    case 'issued': return { tone: 'info', icon: 'document-text' };
    case 'void': return { tone: 'neutral', icon: 'close-circle' };
    case 'refunded': return { tone: 'warning', icon: 'arrow-undo' };
    default: return { tone: 'neutral', icon: 'document' };
  }
};

const money = (n: number, isRTL: boolean) =>
  `${(Number(n) || 0).toLocaleString(isRTL ? 'ar-SA' : 'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${isRTL ? 'ر.س' : 'SAR'}`;

export default function AdminBillingScreen() {
  const { language, isDark } = useApp();
  const COLORS = getColors(isDark);
  const isRTL = language === 'ar';
  const styles = useMemo(() => createStyles(COLORS, isRTL), [COLORS, isRTL]);

  const { loading: permLoading } = useRequirePermission('billing_management');

  const [tab, setTab] = useState<Tab>('invoices');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Invoice | null>(null);
  const [settings, setSettings] = useState<InvoiceSettings | null>(null);

  const load = useCallback(async () => {
    const [inv, s] = await Promise.all([listInvoices({ status: 'all', limit: 300 }), getInvoiceSettings()]);
    setInvoices(inv);
    setSettings(s);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!permLoading) load();
  }, [permLoading, load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return invoices.filter((i) => {
      if (filter !== 'all' && i.status !== filter) return false;
      if (!s) return true;
      return (
        i.invoice_number.toLowerCase().includes(s) ||
        (i.customer_name || '').toLowerCase().includes(s) ||
        (i.customer_phone || '').toLowerCase().includes(s) ||
        (i.customer_email || '').toLowerCase().includes(s)
      );
    });
  }, [invoices, filter, search]);

  const totalCollected = useMemo(
    () => invoices.filter((i) => i.status === 'paid').reduce((a, i) => a + (i.total || 0), 0),
    [invoices]
  );

  const chips: AdminFilterChip<Filter>[] = [
    { key: 'all', en: 'All', ar: 'الكل', count: invoices.length },
    { key: 'issued', en: 'Issued', ar: 'صادرة', count: invoices.filter((i) => i.status === 'issued').length },
    { key: 'paid', en: 'Paid', ar: 'مدفوعة', count: invoices.filter((i) => i.status === 'paid').length },
    { key: 'refunded', en: 'Refunded', ar: 'مستردة', count: invoices.filter((i) => i.status === 'refunded').length },
    { key: 'void', en: 'Void', ar: 'ملغاة', count: invoices.filter((i) => i.status === 'void').length },
  ];

  if (permLoading || loading) {
    return (
      <SafeAreaView style={[styles.safe, { justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={COLORS.card} />
      <AdminScreenHeader
        title={isRTL ? 'الفوترة والفواتير' : 'Billing & Invoices'}
        subtitle={isRTL ? `${money(totalCollected, isRTL)} محصّلة` : `${money(totalCollected, isRTL)} collected`}
      />

      <View style={[styles.tabsRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        {(['invoices', 'settings'] as Tab[]).map((t) => (
          <TouchableOpacity key={t} onPress={() => setTab(t)} style={[styles.tab, tab === t && { borderBottomColor: COLORS.primary }]}>
            <Text style={[styles.tabText, { color: tab === t ? COLORS.primary : COLORS.textSecondary }]}>
              {t === 'invoices' ? (isRTL ? 'الفواتير' : 'Invoices') : (isRTL ? 'إعدادات الفوترة' : 'Invoice settings')}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'invoices' ? (
        <>
          <View style={{ paddingHorizontal: SPACING.lg, paddingTop: 12 }}>
            <AdminSearchBar value={search} onChangeText={setSearch} placeholder={isRTL ? 'رقم الفاتورة أو العميل' : 'Invoice # or customer'} resultCount={filtered.length} />
          </View>
          <AdminFilterChips filters={chips} value={filter} onChange={setFilter} />
          <ScrollView
            contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 60 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
          >
            {filtered.length === 0 ? (
              <AdminEmptyState icon="file-document-outline" title={isRTL ? 'لا توجد فواتير' : 'No invoices'} body={isRTL ? 'تُنشأ الفواتير تلقائياً عند اكتمال الطلبات.' : 'Invoices are created automatically when orders complete.'} />
            ) : (
              filtered.map((inv) => {
                const tone = statusTone(inv.status);
                return (
                  <TouchableOpacity key={inv.id} style={[styles.row, ADMIN_CARD_SHADOW]} onPress={() => setSelected(inv)}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.invNo}>{inv.invoice_number}</Text>
                      <Text style={styles.invSub} numberOfLines={1}>
                        {inv.customer_name || inv.customer_phone || '—'} · {new Date(inv.issued_at).toLocaleDateString(isRTL ? 'ar-SA' : 'en-US')}
                      </Text>
                    </View>
                    <View style={{ alignItems: isRTL ? 'flex-start' : 'flex-end', gap: 6 }}>
                      <Text style={styles.invTotal}>{money(inv.total, isRTL)}</Text>
                      <AdminStatusPill label={isRTL ? statusAr(inv.status) : inv.status} tone={tone.tone} icon={tone.icon} />
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
        </>
      ) : (
        settings && <SettingsForm settings={settings} isRTL={isRTL} COLORS={COLORS} styles={styles} onSaved={load} />
      )}

      {selected && (
        <InvoiceDetail
          invoice={selected}
          isRTL={isRTL}
          COLORS={COLORS}
          styles={styles}
          onClose={() => setSelected(null)}
          onChanged={async () => {
            await load();
            setSelected(null);
          }}
        />
      )}
    </SafeAreaView>
  );
}

const statusAr = (s: InvoiceStatus) =>
  ({ issued: 'صادرة', paid: 'مدفوعة', void: 'ملغاة', refunded: 'مستردة' }[s] || s);

// ─── Invoice detail ────────────────────────────────────────────────────────
function InvoiceDetail({ invoice, isRTL, COLORS, styles, onClose, onChanged }: any) {
  const [busy, setBusy] = useState(false);

  const download = async () => {
    setBusy(true);
    try {
      await generateAndShareInvoicePdf(invoice, isRTL);
    } catch (e) {
      Alert.alert(isRTL ? 'خطأ' : 'Error', getFriendlyError(e, isRTL ? 'ar' : 'en'));
    } finally {
      setBusy(false);
    }
  };

  const setStatus = (status: InvoiceStatus) => {
    Alert.alert(
      isRTL ? 'تغيير حالة الفاتورة' : 'Change invoice status',
      isRTL ? `تعيين الحالة إلى ${statusAr(status)}؟` : `Set status to ${status}?`,
      [
        { text: isRTL ? 'إلغاء' : 'Cancel', style: 'cancel' },
        {
          text: isRTL ? 'تأكيد' : 'Confirm',
          onPress: async () => {
            try {
              await updateInvoiceStatus(invoice.id, status);
              await onChanged();
            } catch (e) {
              Alert.alert(isRTL ? 'خطأ' : 'Error', getFriendlyError(e, isRTL ? 'ar' : 'en'));
            }
          },
        },
      ]
    );
  };

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { maxHeight: '90%' }]}>
        <View style={[styles.detailHead, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          <Text style={styles.sheetTitle}>{invoice.invoice_number}</Text>
          <AdminStatusPill label={isRTL ? statusAr(invoice.status) : invoice.status} {...statusTone(invoice.status)} />
        </View>
        <ScrollView showsVerticalScrollIndicator={false}>
          <DetailRow label={isRTL ? 'العميل' : 'Customer'} value={invoice.customer_name} isRTL={isRTL} styles={styles} />
          <DetailRow label={isRTL ? 'الجوال' : 'Phone'} value={invoice.customer_phone} isRTL={isRTL} styles={styles} />
          {!!invoice.technician_name && <DetailRow label={isRTL ? 'الفني' : 'Technician'} value={invoice.technician_name} isRTL={isRTL} styles={styles} />}
          <DetailRow label={isRTL ? 'التاريخ' : 'Date'} value={new Date(invoice.issued_at).toLocaleString(isRTL ? 'ar-SA' : 'en-US')} isRTL={isRTL} styles={styles} />

          <View style={styles.lineHead}>
            <Text style={[styles.lineHeadText, { flex: 1 }]}>{isRTL ? 'الوصف' : 'Item'}</Text>
            <Text style={styles.lineHeadText}>{isRTL ? 'المبلغ' : 'Amount'}</Text>
          </View>
          {invoice.line_items.map((l: any, i: number) => (
            <View key={i} style={[styles.lineRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              <Text style={[styles.lineLabel, { flex: 1 }]}>{isRTL ? l.labelAr : l.labelEn}</Text>
              <Text style={styles.lineAmt}>{money(l.amount, isRTL)}</Text>
            </View>
          ))}

          <View style={styles.totalsBox}>
            <TotalRow label={isRTL ? 'المجموع' : 'Subtotal'} value={money(invoice.subtotal, isRTL)} isRTL={isRTL} styles={styles} />
            <TotalRow label={`${isRTL ? 'الضريبة' : 'VAT'} (${Math.round((invoice.vat_rate || 0) * 100)}%)`} value={money(invoice.vat_amount, isRTL)} isRTL={isRTL} styles={styles} />
            <TotalRow label={isRTL ? 'الإجمالي' : 'Total'} value={money(invoice.total, isRTL)} isRTL={isRTL} styles={styles} grand />
          </View>

          <TouchableOpacity style={[styles.primaryBtn, busy && { opacity: 0.6 }]} disabled={busy} onPress={download}>
            {busy ? <ActivityIndicator color="#fff" /> : (
              <>
                <Ionicons name="download-outline" size={18} color="#fff" />
                <Text style={styles.primaryBtnText}>{isRTL ? 'تنزيل / مشاركة PDF' : 'Download / Share PDF'}</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={[styles.statusActions, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            {invoice.status !== 'paid' && <SmallBtn label={isRTL ? 'مدفوعة' : 'Mark paid'} color="#16A34A" onPress={() => setStatus('paid')} styles={styles} />}
            {invoice.status !== 'refunded' && <SmallBtn label={isRTL ? 'استرداد' : 'Refund'} color="#F59E0B" onPress={() => setStatus('refunded')} styles={styles} />}
            {invoice.status !== 'void' && <SmallBtn label={isRTL ? 'إلغاء' : 'Void'} color="#DC2626" onPress={() => setStatus('void')} styles={styles} />}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

function DetailRow({ label, value, isRTL, styles }: any) {
  if (!value) return null;
  return (
    <View style={[styles.dRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
      <Text style={styles.dLabel}>{label}</Text>
      <Text style={styles.dValue}>{value}</Text>
    </View>
  );
}
function TotalRow({ label, value, isRTL, styles, grand }: any) {
  return (
    <View style={[styles.tRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }, grand && styles.tRowGrand]}>
      <Text style={[styles.tLabel, grand && styles.tLabelGrand]}>{label}</Text>
      <Text style={[styles.tValue, grand && styles.tValueGrand]}>{value}</Text>
    </View>
  );
}
function SmallBtn({ label, color, onPress, styles }: any) {
  return (
    <TouchableOpacity style={[styles.smallBtn, { borderColor: color }]} onPress={onPress}>
      <Text style={[styles.smallBtnText, { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

// Module-scope so the TextInput keeps focus across parent re-renders.
function SettingField({
  label,
  value,
  onChange,
  keyboard,
  multiline,
  styles,
  placeholderColor,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  keyboard?: any;
  multiline?: boolean;
  styles: any;
  placeholderColor: string;
}) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && { height: 80, textAlignVertical: 'top' }]}
        value={value}
        onChangeText={onChange}
        keyboardType={keyboard}
        multiline={multiline}
        placeholderTextColor={placeholderColor}
      />
    </View>
  );
}

// ─── Settings form ─────────────────────────────────────────────────────────
function SettingsForm({ settings, isRTL, COLORS, styles, onSaved }: any) {
  const [s, setS] = useState<InvoiceSettings>(settings);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof InvoiceSettings, v: any) => setS((prev) => ({ ...prev, [k]: v }));

  const save = async () => {
    setBusy(true);
    try {
      await saveInvoiceSettings({ ...s, vatRate: Number(s.vatRate) || 0 });
      Alert.alert(isRTL ? 'تم الحفظ' : 'Saved', isRTL ? 'تم تحديث إعدادات الفوترة.' : 'Invoice settings updated.');
      await onSaved();
    } catch (e) {
      Alert.alert(isRTL ? 'خطأ' : 'Error', getFriendlyError(e, isRTL ? 'ar' : 'en'));
    } finally {
      setBusy(false);
    }
  };

  const field = (label: string, k: keyof InvoiceSettings, keyboard?: any, multiline?: boolean) => (
    <SettingField
      label={label}
      value={String((s as any)[k] ?? '')}
      onChange={(v) => set(k, v)}
      keyboard={keyboard}
      multiline={multiline}
      styles={styles}
      placeholderColor={COLORS.textSecondary}
    />
  );

  return (
    <ScrollView contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 80 }} keyboardShouldPersistTaps="handled">
      <View style={[styles.toggleRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        <Text style={styles.fieldLabel}>{isRTL ? 'تفعيل الفواتير' : 'Invoices enabled'}</Text>
        <Switch value={s.enabled} onValueChange={(v) => set('enabled', v)} trackColor={{ true: COLORS.primary }} />
      </View>

      {field(isRTL ? 'اسم الشركة' : 'Company name', 'companyName')}
      {field(isRTL ? 'رابط الشعار (URL)' : 'Logo URL', 'logoUrl')}
      {field(isRTL ? 'الرقم الضريبي (VAT)' : 'VAT number', 'vatNumber', 'numeric')}
      {field(isRTL ? 'السجل التجاري (CR)' : 'CR number', 'crNumber', 'numeric')}
      {field(isRTL ? 'العنوان' : 'Address', 'address', undefined, true)}
      {field(isRTL ? 'البريد الإلكتروني' : 'Email', 'email', 'email-address')}
      {field(isRTL ? 'الجوال' : 'Phone', 'phone', 'phone-pad')}
      {field(isRTL ? 'نسبة الضريبة (مثال 0.15)' : 'VAT rate (e.g. 0.15)', 'vatRate', 'numeric')}

      <View style={[styles.toggleRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        <Text style={styles.fieldLabel}>{isRTL ? 'الأسعار شاملة الضريبة' : 'Prices include VAT'}</Text>
        <Switch value={s.pricesIncludeVat} onValueChange={(v) => set('pricesIncludeVat', v)} trackColor={{ true: COLORS.primary }} />
      </View>

      {field(isRTL ? 'تذييل الفاتورة' : 'Invoice footer', 'footer', undefined, true)}
      {field(isRTL ? 'النص القانوني / الضريبي' : 'Legal / tax text', 'legalText', undefined, true)}
      {field(isRTL ? 'بادئة رقم الفاتورة' : 'Invoice number prefix', 'prefix')}

      <TouchableOpacity style={[styles.primaryBtn, busy && { opacity: 0.6 }]} disabled={busy} onPress={save}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>{isRTL ? 'حفظ الإعدادات' : 'Save settings'}</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const createStyles = (C: any, isRTL: boolean) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: C.background },
    tabsRow: { borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: C.card },
    tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
    tabText: { fontSize: 14, fontWeight: '700' },
    row: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: BORDER_RADIUS.lg ?? 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: C.border, gap: 10 },
    invNo: { color: C.text, fontSize: 15, fontWeight: '800', textAlign: isRTL ? 'right' : 'left' },
    invSub: { color: C.textSecondary, fontSize: 12, marginTop: 3, textAlign: isRTL ? 'right' : 'left' },
    invTotal: { color: C.text, fontSize: 15, fontWeight: '800' },
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
    sheet: { backgroundColor: C.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: SPACING.lg, paddingBottom: 36 },
    sheetTitle: { color: C.text, fontSize: 18, fontWeight: '800' },
    detailHead: { alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
    dRow: { justifyContent: 'space-between', paddingVertical: 6, gap: 10 },
    dLabel: { color: C.textSecondary, fontSize: 13 },
    dValue: { color: C.text, fontSize: 13, fontWeight: '700', flexShrink: 1, textAlign: isRTL ? 'left' : 'right' },
    lineHead: { flexDirection: isRTL ? 'row-reverse' : 'row', marginTop: 16, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: C.border },
    lineHeadText: { color: C.textSecondary, fontSize: 11, fontWeight: '800' },
    lineRow: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.border, gap: 10 },
    lineLabel: { color: C.text, fontSize: 13, textAlign: isRTL ? 'right' : 'left' },
    lineAmt: { color: C.text, fontSize: 13, fontWeight: '700' },
    totalsBox: { marginTop: 12, backgroundColor: C.card, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: C.border },
    tRow: { justifyContent: 'space-between', paddingVertical: 4 },
    tRowGrand: { borderTopWidth: 1, borderTopColor: C.border, marginTop: 6, paddingTop: 8 },
    tLabel: { color: C.textSecondary, fontSize: 13 },
    tLabelGrand: { color: C.text, fontSize: 16, fontWeight: '800' },
    tValue: { color: C.text, fontSize: 13, fontWeight: '700' },
    tValueGrand: { color: C.primary, fontSize: 18, fontWeight: '800' },
    primaryBtn: { flexDirection: isRTL ? 'row-reverse' : 'row', gap: 8, backgroundColor: C.primary, borderRadius: 14, paddingVertical: 15, alignItems: 'center', justifyContent: 'center', marginTop: 20 },
    primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
    statusActions: { gap: 8, marginTop: 14, justifyContent: 'center' },
    smallBtn: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, borderWidth: 1.5 },
    smallBtnText: { fontSize: 13, fontWeight: '800' },
    fieldLabel: { color: C.text, fontSize: 13, fontWeight: '700', marginBottom: 6, textAlign: isRTL ? 'right' : 'left' },
    input: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, color: C.text, fontSize: 14, textAlign: isRTL ? 'right' : 'left' },
    toggleRow: { alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  });
