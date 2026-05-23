import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ScrollView,
  ActivityIndicator,
  Image,
  Linking,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { getColors, SPACING, BORDER_RADIUS } from '../constants/theme';
import { RTLIonicon } from '../components/RTLIcon';
import { safeBack } from '../utils/navigation';
import { supabase } from '../services/supabaseClient';
import ImageViewer from '../components/ImageViewer';

const STATUS_META = (s: string, isRTL: boolean): { label: string; color: string } => {
  const map: Record<string, { ar: string; en: string; color: string }> = {
    pending:         { ar: 'قيد الانتظار', en: 'Pending',       color: '#F59E0B' },
    confirmed:       { ar: 'مؤكد',          en: 'Confirmed',     color: '#3B82F6' },
    accepted:        { ar: 'مقبول',         en: 'Accepted',      color: '#3B82F6' },
    picking_up:      { ar: 'جاري الاستلام',  en: 'Picking up',    color: '#6366F1' },
    diagnosing:      { ar: 'جاري الفحص',     en: 'Diagnosing',    color: '#6366F1' },
    quoted:          { ar: 'عرض سعر',        en: 'Quoted',        color: '#8B5CF6' },
    awaiting_payment:{ ar: 'بانتظار الدفع',  en: 'Awaiting pay',  color: '#8B5CF6' },
    waiting_parts:   { ar: 'انتظار قطع',     en: 'Waiting parts', color: '#8B5CF6' },
    repairing:       { ar: 'جاري الإصلاح',   en: 'Repairing',     color: '#6366F1' },
    testing:         { ar: 'اختبار',         en: 'Testing',       color: '#6366F1' },
    delivering:      { ar: 'جاري التوصيل',   en: 'Delivering',    color: '#06B6D4' },
    completed:       { ar: 'مكتمل',          en: 'Completed',     color: '#16A34A' },
    cancelled:       { ar: 'ملغي',           en: 'Cancelled',     color: '#DC2626' },
  };
  const m = map[s];
  return m ? { label: isRTL ? m.ar : m.en, color: m.color } : { label: s, color: '#8A94A3' };
};

const fulfillmentLabel = (type: string | null | undefined, isRTL: boolean): string => {
  switch (type) {
    case 'mobile':
    case 'on_site':
      return isRTL ? 'خدمة في الموقع' : 'On-site service';
    case 'pickup':
    case 'pickup_delivery':
      return isRTL ? 'استلام وتسليم' : 'Pickup & delivery';
    case 'personal_handoff':
    case 'handoff':
    case 'drop_off':
      return isRTL ? 'تسليم باليد' : 'Drop-off / handoff';
    default:
      return isRTL ? 'غير محدد' : 'Not specified';
  }
};

const paymentStatusLabel = (s: string | null | undefined, isRTL: boolean): { label: string; color: string } => {
  switch (s) {
    case 'paid':
      return { label: isRTL ? 'مدفوع' : 'Paid', color: '#16A34A' };
    case 'pending':
      return { label: isRTL ? 'بانتظار الدفع' : 'Pending', color: '#F59E0B' };
    case 'refunded':
      return { label: isRTL ? 'مسترد' : 'Refunded', color: '#DC2626' };
    case 'failed':
      return { label: isRTL ? 'فشل' : 'Failed', color: '#DC2626' };
    default:
      return { label: isRTL ? 'غير محدد' : 'Not set', color: '#8A94A3' };
  }
};

export default function AdminOrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { language, isDark } = useApp();
  const { userProfile } = useAuth();
  const COLORS = getColors(isDark);
  const isRTL = language === 'ar';
  const styles = createStyles(COLORS, isRTL);

  const [order, setOrder] = useState<any | null>(null);
  const [customerName, setCustomerName] = useState<string>('');
  const [technicianName, setTechnicianName] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [viewer, setViewer] = useState<{ images: string[]; index: number } | null>(null);

  const profileLoaded = userProfile !== null;
  const isAdmin = (userProfile as any)?.is_admin === true;

  const load = useCallback(async () => {
    if (!id) { setLoading(false); return; }
    try {
      const { data: o } = await supabase
        .from('orders')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      setOrder(o);
      if (o?.user_id) {
        const { data: u } = await supabase
          .from('users')
          .select('name')
          .eq('id', o.user_id)
          .maybeSingle();
        setCustomerName((u as any)?.name ?? '');
      }
      if (o?.technician_id) {
        const { data: tech } = await supabase
          .from('technicians')
          .select('full_name')
          .eq('user_id', o.technician_id)
          .maybeSingle();
        setTechnicianName((tech as any)?.full_name ?? '');
      }
    } catch {
      // non-fatal
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (profileLoaded && isAdmin) load();
  }, [profileLoaded, isAdmin, load]);

  if (!profileLoaded) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </SafeAreaView>
    );
  }

  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.container}>
        <Header isRTL={isRTL} COLORS={COLORS} title={isRTL ? 'تفاصيل الطلب' : 'Order detail'} />
        <View style={styles.empty}>
          <MaterialCommunityIcons name="shield-alert-outline" size={64} color={COLORS.error} />
          <Text style={styles.emptyText}>{isRTL ? 'هذه الصفحة للأدمن فقط' : 'Admins only'}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const fmt = (n: any) => Number(n ?? 0).toLocaleString(isRTL ? 'ar-SA' : 'en-US');
  const sar = isRTL ? 'ر.س' : 'SAR';
  const dt = (v: string | null | undefined) =>
    v ? new Date(v).toLocaleString(isRTL ? 'ar-SA' : 'en-GB') : '—';

  const status = order ? STATUS_META(order.status, isRTL) : null;
  const payStatus = order ? paymentStatusLabel(order.payment_status, isRTL) : null;
  const beforePhotos: string[] = Array.isArray(order?.before_photos) ? order.before_photos : [];
  const afterPhotos: string[] = Array.isArray(order?.after_photos) ? order.after_photos : [];
  const mediaUrls: string[] = Array.isArray(order?.media_urls) ? order.media_urls : [];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <Header isRTL={isRTL} COLORS={COLORS} title={isRTL ? 'تفاصيل الطلب' : 'Order detail'} />

      {loading ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 50 }} />
      ) : !order ? (
        <View style={styles.empty}>
          <MaterialCommunityIcons name="file-search-outline" size={56} color={COLORS.textSecondary} />
          <Text style={styles.emptyText}>{isRTL ? 'الطلب غير موجود' : 'Order not found'}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 48 }}>
          {/* Title + status */}
          <View style={styles.titleRow}>
            <Text style={styles.device} numberOfLines={2}>
              {[order.device_brand, order.device_model].filter(Boolean).join(' ') || (isRTL ? 'طلب إصلاح' : 'Repair order')}
            </Text>
            {status && (
              <View style={[styles.statusPill, { backgroundColor: status.color + '20' }]}>
                <Text style={[styles.statusPillText, { color: status.color }]}>{status.label}</Text>
              </View>
            )}
          </View>
          <Text style={styles.orderId}>
            {order.order_number ?? `#${String(order.id).slice(0, 8).toUpperCase()}`}
          </Text>

          {/* Customer */}
          <Section title={isRTL ? 'العميل' : 'Customer'} icon="account-outline" COLORS={COLORS} isRTL={isRTL}>
            <Row k={isRTL ? 'الاسم' : 'Name'} v={customerName || '—'} {...{ styles }} />
            <PhoneRow k={isRTL ? 'الهاتف' : 'Phone'} phone={order.customer_phone} isRTL={isRTL} styles={styles} COLORS={COLORS} />
          </Section>

          {/* Technician */}
          <Section title={isRTL ? 'الفني' : 'Technician'} icon="account-wrench-outline" COLORS={COLORS} isRTL={isRTL}>
            {order.technician_id ? (
              <>
                <Row k={isRTL ? 'الاسم' : 'Name'} v={technicianName || '—'} styles={styles} />
                <PhoneRow k={isRTL ? 'الهاتف' : 'Phone'} phone={order.technician_phone} isRTL={isRTL} styles={styles} COLORS={COLORS} />
              </>
            ) : (
              <Text style={styles.muted}>{isRTL ? 'لم يُسنَد لفني بعد' : 'Not assigned to a technician yet'}</Text>
            )}
          </Section>

          {/* Service details */}
          <Section title={isRTL ? 'تفاصيل الخدمة' : 'Service details'} icon="wrench-outline" COLORS={COLORS} isRTL={isRTL}>
            <Row k={isRTL ? 'نوع الخدمة' : 'Service method'} v={fulfillmentLabel(order.fulfillment_type ?? order.service_type, isRTL)} styles={styles} />
            <Row k={isRTL ? 'وصف العطل' : 'Issue'} v={order.issue_description || '—'} styles={styles} />
            {!!order.spare_part_quality && (
              <Row k={isRTL ? 'جودة القطعة' : 'Part quality'} v={order.spare_part_quality} styles={styles} />
            )}
            <Row k={isRTL ? 'الموقع' : 'Location'} v={order.location || order.address || '—'} styles={styles} />
            {!!order.scheduled_date && (
              <Row k={isRTL ? 'الموعد' : 'Scheduled'} v={dt(order.scheduled_date)} styles={styles} />
            )}
            <Row k={isRTL ? 'تاريخ الإنشاء' : 'Created'} v={dt(order.created_at)} styles={styles} />
            {!!order.notes && (
              <Row k={isRTL ? 'ملاحظة العميل' : 'Customer note'} v={order.notes} styles={styles} />
            )}
          </Section>

          {/* Pricing */}
          <Section title={isRTL ? 'التسعير' : 'Pricing'} icon="cash-multiple" COLORS={COLORS} isRTL={isRTL}>
            <Row k={isRTL ? 'عرض السعر' : 'Quotation'} v={`${fmt(order.estimated_price)} ${sar}`} styles={styles} />
            {order.final_price != null && (
              <Row k={isRTL ? 'السعر النهائي' : 'Final price'} v={`${fmt(order.final_price)} ${sar}`} styles={styles} strong />
            )}
            {Number(order.delivery_fee) > 0 && (
              <Row k={isRTL ? 'رسوم التوصيل' : 'Delivery fee'} v={`${fmt(order.delivery_fee)} ${sar}`} styles={styles} />
            )}
            {Number(order.inspection_fee) > 0 && (
              <Row k={isRTL ? 'رسوم الفحص' : 'Inspection fee'} v={`${fmt(order.inspection_fee)} ${sar}`} styles={styles} />
            )}
            {Number(order.return_fee) > 0 && (
              <Row k={isRTL ? 'رسوم الإرجاع' : 'Return fee'} v={`${fmt(order.return_fee)} ${sar}`} styles={styles} />
            )}
            {Number(order.cancellation_fee_total) > 0 && (
              <Row k={isRTL ? 'رسوم الإلغاء' : 'Cancellation fee'} v={`${fmt(order.cancellation_fee_total)} ${sar}`} styles={styles} />
            )}
            {!!order.discount_code && (
              <Row k={isRTL ? 'كود الخصم' : 'Discount code'} v={order.discount_code} styles={styles} />
            )}
            {Number(order.discount_amount) > 0 && (
              <Row k={isRTL ? 'قيمة الخصم' : 'Discount amount'} v={`- ${fmt(order.discount_amount)} ${sar}`} styles={styles} />
            )}
            {order.loyalty_points_earned != null && (
              <Row k={isRTL ? 'نقاط الولاء' : 'Loyalty points'} v={fmt(order.loyalty_points_earned)} styles={styles} />
            )}
          </Section>

          {/* Payment */}
          <Section title={isRTL ? 'الدفع' : 'Payment'} icon="credit-card-outline" COLORS={COLORS} isRTL={isRTL}>
            <Row k={isRTL ? 'طريقة الدفع' : 'Method'} v={order.payment_method || '—'} styles={styles} />
            {payStatus && (
              <View style={styles.kvRow}>
                <Text style={styles.kvKey}>{isRTL ? 'حالة الدفع' : 'Status'}</Text>
                <View style={[styles.miniPill, { backgroundColor: payStatus.color + '20' }]}>
                  <Text style={[styles.miniPillText, { color: payStatus.color }]}>{payStatus.label}</Text>
                </View>
              </View>
            )}
            {!!order.payment_reference && (
              <Row k={isRTL ? 'مرجع الدفع' : 'Reference'} v={order.payment_reference} styles={styles} />
            )}
          </Section>

          {/* Quote / technician notes */}
          {(!!order.quote_notes || !!order.technician_notes) && (
            <Section title={isRTL ? 'ملاحظات الفني' : 'Technician notes'} icon="note-text-outline" COLORS={COLORS} isRTL={isRTL}>
              {!!order.quote_notes && (
                <Row k={isRTL ? 'ملاحظات عرض السعر' : 'Quote notes'} v={order.quote_notes} styles={styles} />
              )}
              {!!order.technician_notes && (
                <Row k={isRTL ? 'ملاحظات الإصلاح' : 'Repair notes'} v={order.technician_notes} styles={styles} />
              )}
            </Section>
          )}

          {/* Photos */}
          {mediaUrls.length > 0 && (
            <PhotoSection
              title={isRTL ? 'صور العميل' : 'Customer photos'}
              photos={mediaUrls}
              onOpen={(i: number) => setViewer({ images: mediaUrls, index: i })}
              COLORS={COLORS} isRTL={isRTL} styles={styles}
            />
          )}
          {beforePhotos.length > 0 && (
            <PhotoSection
              title={isRTL ? 'صور قبل الإصلاح' : 'Before-repair photos'}
              photos={beforePhotos}
              onOpen={(i: number) => setViewer({ images: beforePhotos, index: i })}
              COLORS={COLORS} isRTL={isRTL} styles={styles}
            />
          )}
          {afterPhotos.length > 0 && (
            <PhotoSection
              title={isRTL ? 'صور بعد الإصلاح' : 'After-repair photos'}
              photos={afterPhotos}
              onOpen={(i: number) => setViewer({ images: afterPhotos, index: i })}
              COLORS={COLORS} isRTL={isRTL} styles={styles}
            />
          )}
        </ScrollView>
      )}

      {viewer && (
        <ImageViewer
          visible
          images={viewer.images}
          initialIndex={viewer.index}
          onClose={() => setViewer(null)}
        />
      )}
    </SafeAreaView>
  );
}

function Header({ isRTL, COLORS, title }: any) {
  return (
    <View style={{
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: SPACING.m,
      paddingVertical: SPACING.m,
    }}>
      <TouchableOpacity onPress={() => safeBack('/admin-orders')} accessibilityRole="button">
        <RTLIonicon name="chevron-back" size={26} color={COLORS.text} />
      </TouchableOpacity>
      <Text style={{ fontSize: 20, fontWeight: '800', color: COLORS.text }}>{title}</Text>
      <View style={{ width: 26 }} />
    </View>
  );
}

function Section({ title, icon, children, COLORS, isRTL }: any) {
  return (
    <View style={{ marginTop: 18 }}>
      <View style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8,
      }}>
        <MaterialCommunityIcons name={icon} size={17} color={COLORS.textSecondary} />
        <Text style={{
          color: COLORS.textSecondary,
          fontSize: 12,
          fontWeight: '800',
          letterSpacing: 0.8,
          textTransform: 'uppercase',
        }}>
          {title}
        </Text>
      </View>
      <View style={{
        backgroundColor: COLORS.card,
        borderRadius: BORDER_RADIUS.md,
        borderWidth: 1,
        borderColor: COLORS.border,
        padding: 14,
      }}>
        {children}
      </View>
    </View>
  );
}

function Row({ k, v, styles, strong }: any) {
  return (
    <View style={styles.kvRow}>
      <Text style={styles.kvKey}>{k}</Text>
      <Text style={[styles.kvVal, strong && { color: styles._primary, fontSize: 15 }]}>{v}</Text>
    </View>
  );
}

function PhoneRow({ k, phone, isRTL, styles, COLORS }: any) {
  if (!phone) return <Row k={k} v="—" styles={styles} />;
  return (
    <View style={styles.kvRow}>
      <Text style={styles.kvKey}>{k}</Text>
      <TouchableOpacity onPress={() => Linking.openURL(`tel:${phone}`)}>
        <Text style={[styles.kvVal, { color: COLORS.primary }]}>{phone}</Text>
      </TouchableOpacity>
    </View>
  );
}

function PhotoSection({ title, photos, onOpen, COLORS, isRTL, styles }: any) {
  return (
    <Section title={title} icon="image-multiple-outline" COLORS={COLORS} isRTL={isRTL}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}
      >
        {photos.map((url: string, i: number) => (
          <TouchableOpacity key={i} onPress={() => onOpen(i)} activeOpacity={0.85}>
            <Image source={{ uri: url }} style={styles.photo} />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </Section>
  );
}

const createStyles = (C: any, isRTL: boolean) => {
  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    empty: { alignItems: 'center', paddingVertical: 60 },
    emptyText: { color: C.text, fontWeight: '700', marginTop: 12 },
    titleRow: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 12,
    },
    device: { color: C.text, fontSize: 19, fontWeight: '900', flex: 1, textAlign: isRTL ? 'right' : 'left' },
    statusPill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
    statusPillText: { fontSize: 12, fontWeight: '800' },
    orderId: { color: C.textSecondary, fontSize: 12, fontWeight: '700', marginTop: 4, textAlign: isRTL ? 'right' : 'left' },
    muted: { color: C.textSecondary, fontSize: 13 },
    kvRow: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      paddingVertical: 6,
      gap: 14,
    },
    kvKey: { color: C.textSecondary, fontSize: 13, flexShrink: 0, maxWidth: '42%', textAlign: isRTL ? 'right' : 'left' },
    kvVal: { color: C.text, fontSize: 13, fontWeight: '700', flex: 1, textAlign: isRTL ? 'left' : 'right' },
    miniPill: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999 },
    miniPillText: { fontSize: 11, fontWeight: '800' },
    photo: {
      width: 96,
      height: 96,
      borderRadius: BORDER_RADIUS.md,
      marginEnd: 8,
      backgroundColor: C.border,
    },
  });
  return { ...s, _primary: C.primary } as typeof s & { _primary: string };
};
