import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ScrollView,
  Image,
  Linking,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { useIsAdmin } from '../hooks/useAdminGuard';
import { PAYMENT_MODE_LABELS, type PaymentMode } from '../utils/paymentPlan';
import { getColors, SPACING, BORDER_RADIUS } from '../constants/theme';
import { RTLIonicon } from '../components/RTLIcon';
import { safeBack } from '../utils/navigation';
import { AnimatedBackButton } from '../components/AnimatedBackButton';
import { supabase } from '../services/supabaseClient';
import ImageViewer from '../components/ImageViewer';
import { fmtAdminDate, fmtAdminDateTime, fmtAdminNumber } from '../utils/dateFormat';
import { logger } from '../utils/logger';
import { resolveStorageUrls } from '../utils/resolveStorageUrls';
import { getOrderTimeline, actorTypeLabel, type OrderTimelineEvent } from '../services/orderTimelineService';
import GearLoader from '../components/GearLoader';

const STATUS_META = (s: string, isRTL: boolean): { label: string; color: string } => {
  const map: Record<string, { ar: string; en: string; color: string }> = {
    pending:         { ar: 'بانتظار العروض', en: 'Awaiting offers', color: '#F59E0B' },
    confirmed:       { ar: 'مؤكد',          en: 'Confirmed',     color: '#3B82F6' },
    accepted:        { ar: 'مقبول',         en: 'Accepted',      color: '#3B82F6' },
    picking_up:      { ar: 'جاري الاستلام',  en: 'Picking up',    color: '#6366F1' },
    diagnosing:      { ar: 'جاري الفحص',     en: 'Diagnosing',    color: '#6366F1' },
    quoted:          { ar: 'عرض سعر',        en: 'Quoted',        color: '#8B5CF6' },
    awaiting_payment:{ ar: 'بإنتظار الدفع',  en: 'Awaiting pay',  color: '#8B5CF6' },
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
      return { label: isRTL ? 'بإنتظار الدفع' : 'Pending', color: '#F59E0B' };
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
  const [resolvedMedia, setResolvedMedia] = useState<string[]>([]);
  const [resolvedBefore, setResolvedBefore] = useState<string[]>([]);
  const [resolvedAfter, setResolvedAfter] = useState<string[]>([]);
  const [timeline, setTimeline] = useState<OrderTimelineEvent[]>([]);
  // Marketplace offers on this order (admin visibility into the bidding stage).
  const [offers, setOffers] = useState<any[]>([]);
  const [offerNames, setOfferNames] = useState<Record<string, string>>({});

  const { isAdmin, checking: adminChecking } = useIsAdmin();
  // Gate on the admin check (JWT claim + RBAC RPC), never on the users-row
  // fetch: if that read fails, userProfile stays null forever and the screen
  // would hang on a blank spinner (2026-07-05 regression).
  const profileLoaded = !adminChecking;

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
      // Resolve signed URLs for all photo arrays
      const [signedMedia, signedBefore, signedAfter] = await Promise.all([
        resolveStorageUrls(Array.isArray(o?.media_urls) ? o.media_urls : []),
        resolveStorageUrls(Array.isArray(o?.before_photos) ? o.before_photos : []),
        resolveStorageUrls(Array.isArray(o?.after_photos) ? o.after_photos : []),
      ]);
      setResolvedMedia(signedMedia.filter(Boolean));
      setResolvedBefore(signedBefore.filter(Boolean));
      setResolvedAfter(signedAfter.filter(Boolean));

      // Marketplace offers (RLS: admins read all). Names resolved via the
      // public card view since users is otherwise own-row-only.
      const { data: offerRows } = await supabase
        .from('order_offers')
        .select('*')
        .eq('order_id', id)
        .order('created_at', { ascending: false });
      const rows = offerRows ?? [];
      setOffers(rows);
      const techIds = [...new Set(rows.map((r: any) => r.technician_id))];
      if (techIds.length > 0) {
        const { data: cards } = await supabase
          .from('public_user_cards')
          .select('id, name')
          .in('id', techIds);
        const names: Record<string, string> = {};
        for (const c of cards ?? []) names[(c as any).id] = (c as any).name ?? '';
        setOfferNames(names);
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

  // §13 — load the order's status-change timeline (admin view).
  useEffect(() => {
    if (!order?.id) return;
    getOrderTimeline(String(order.id)).then(setTimeline).catch(() => {});
  }, [order?.id, order?.status]);

  if (!profileLoaded) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <GearLoader size={48} />
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

  const fmt = (n: any) => fmtAdminNumber(n, isRTL);
  const sar = isRTL ? 'ر.س' : 'SAR';
  const dt = (v: string | null | undefined) => fmtAdminDateTime(v, isRTL);

  const status = order ? STATUS_META(order.status, isRTL) : null;
  const payStatus = order ? paymentStatusLabel(order.payment_status, isRTL) : null;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <Header isRTL={isRTL} COLORS={COLORS} title={isRTL ? 'تفاصيل الطلب' : 'Order detail'} />

      {loading ? (
        <GearLoader size={48} style={{ marginTop: 50 }} />
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
              <Text style={styles.muted}>
                {isRTL
                  ? 'لم يُسنَد لفني بعد — الطلب في مرحلة استقبال العروض'
                  : 'Not assigned yet — the request is collecting offers'}
              </Text>
            )}
          </Section>

          {/* Marketplace offers — who quoted what, and what happened to each
              offer (accepted / rejected by customer / expired / withdrawn). */}
          {offers.length > 0 && (
            <Section
              title={`${isRTL ? 'عروض الفنيين' : 'Technician offers'} (${offers.length})`}
              icon="gavel"
              COLORS={COLORS}
              isRTL={isRTL}
            >
              {offers.map((o: any) => {
                const meta: Record<string, { ar: string; en: string; color: string }> = {
                  pending: { ar: 'قيد الانتظار', en: 'Pending', color: '#F59E0B' },
                  accepted: { ar: 'مقبول', en: 'Accepted', color: '#10B981' },
                  rejected: { ar: 'رفضه العميل', en: 'Declined by customer', color: '#EF4444' },
                  expired: { ar: 'انتهى (فاز عرض آخر)', en: 'Expired (another offer won)', color: '#6B7280' },
                  withdrawn: { ar: 'سحبه الفني', en: 'Withdrawn by technician', color: '#6B7280' },
                };
                const m = meta[o.status] ?? meta.pending;
                return (
                  <View
                    key={o.id}
                    style={{
                      flexDirection: isRTL ? 'row-reverse' : 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingVertical: 8,
                      gap: 8,
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: COLORS.text, fontWeight: '700', fontSize: 13, textAlign: isRTL ? 'right' : 'left' }}>
                        {offerNames[o.technician_id] || (isRTL ? 'فني' : 'Technician')}
                      </Text>
                      <Text style={{ color: COLORS.textSecondary, fontSize: 11, marginTop: 2, textAlign: isRTL ? 'right' : 'left' }}>
                        {dt(o.created_at)}
                      </Text>
                    </View>
                    <Text style={{ color: COLORS.text, fontWeight: '800', fontSize: 14 }}>
                      {fmt(o.amount)} {sar}
                    </Text>
                    <View style={{ backgroundColor: m.color + '20', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 }}>
                      <Text style={{ color: m.color, fontSize: 10.5, fontWeight: '700' }}>
                        {isRTL ? m.ar : m.en}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </Section>
          )}

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
            <Row
              k={isRTL ? 'التقدير المبدئي' : 'Initial estimate'}
              v={`${fmt(order.estimated_price)} ${sar}`}
              styles={styles}
            />
            {order.accepted_offer_amount != null && (
              <Row k={isRTL ? 'العرض المقبول (السعر المتفق عليه)' : 'Accepted offer (agreed price)'} v={`${fmt(order.accepted_offer_amount)} ${sar}`} styles={styles} strong />
            )}
            {order.accepted_offer_amount == null && order.final_price != null && (
              <Row k={isRTL ? 'السعر النهائي (نظام سابق)' : 'Final price (legacy)'} v={`${fmt(order.final_price)} ${sar}`} styles={styles} strong />
            )}
            {Number(order.spare_parts_cost) > 0 && (
              <Row k={isRTL ? 'تكلفة قطع الغيار (داخلية)' : 'Spare-part cost (internal)'} v={`${fmt(order.spare_parts_cost)} ${sar}`} styles={styles} />
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
            {!!order.payment_mode && (
              <Row
                k={isRTL ? 'سياسة الدفع' : 'Payment policy'}
                v={PAYMENT_MODE_LABELS[order.payment_mode as PaymentMode]?.[isRTL ? 'ar' : 'en'] ?? order.payment_mode}
                styles={styles}
              />
            )}
            {order.upfront_amount_due != null && (
              <Row k={isRTL ? 'المطلوب مقدماً' : 'Due upfront'} v={`${fmt(order.upfront_amount_due)} ${sar}`} styles={styles} />
            )}
            <Row k={isRTL ? 'المدفوع فعلياً' : 'Amount paid'} v={`${fmt(order.amount_paid ?? 0)} ${sar}`} styles={styles} strong />
            {(() => {
              const totalDue = Number(order.accepted_offer_amount ?? order.final_price ?? order.estimated_price ?? 0)
                + Number(order.delivery_fee ?? 0)
                - Number(order.discount_amount ?? 0);
              const remaining = Math.max(0, totalDue - Number(order.amount_paid ?? 0));
              return remaining > 0 ? (
                <Row k={isRTL ? 'المتبقي' : 'Remaining balance'} v={`${fmt(remaining)} ${sar}`} styles={styles} />
              ) : null;
            })()}
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

          {/* Technician notes */}
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

          {/* Photos — all using resolved signed URLs */}
          {resolvedMedia.length > 0 && (
            <PhotoSection
              title={isRTL ? 'صور العميل' : 'Customer photos'}
              photos={resolvedMedia}
              onOpen={(i: number) => setViewer({ images: resolvedMedia, index: i })}
              COLORS={COLORS} isRTL={isRTL} styles={styles}
            />
          )}
          {resolvedBefore.length > 0 && (
            <PhotoSection
              title={isRTL ? 'صور قبل الإصلاح' : 'Before-repair photos'}
              photos={resolvedBefore}
              onOpen={(i: number) => setViewer({ images: resolvedBefore, index: i })}
              COLORS={COLORS} isRTL={isRTL} styles={styles}
            />
          )}
          {resolvedAfter.length > 0 && (
            <PhotoSection
              title={isRTL ? 'صور بعد الإصلاح' : 'After-repair photos'}
              photos={resolvedAfter}
              onOpen={(i: number) => setViewer({ images: resolvedAfter, index: i })}
              COLORS={COLORS} isRTL={isRTL} styles={styles}
            />
          )}

          {/* §13 — status-change timeline (who + when) */}
          {timeline.length > 0 && (
            <View style={{
              marginTop: 8,
              backgroundColor: COLORS.card,
              borderRadius: BORDER_RADIUS.lg,
              borderWidth: 1,
              borderColor: COLORS.border,
              padding: 16,
            }}>
              <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <MaterialCommunityIcons name="history" size={18} color={COLORS.primary} />
                <Text style={{ fontSize: 15, fontWeight: '800', color: COLORS.text }}>
                  {isRTL ? 'سجل حالة الطلب' : 'Order status history'}
                </Text>
              </View>
              {timeline.map((ev, i) => {
                const isLast = i === timeline.length - 1;
                return (
                  <View key={ev.id} style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: 12, alignItems: 'stretch' }}>
                    <View style={{ width: 14, alignItems: 'center' }}>
                      <View style={{ width: 12, height: 12, borderRadius: 6, marginTop: 2, backgroundColor: isLast ? COLORS.primary : COLORS.border }} />
                      {!isLast && <View style={{ width: 2, flex: 1, marginTop: 2, backgroundColor: COLORS.border }} />}
                    </View>
                    <View style={{ flex: 1, paddingBottom: isLast ? 0 : 14 }}>
                      <Text style={{ fontSize: 14, fontWeight: '800', color: COLORS.text, textAlign: isRTL ? 'right' : 'left' }}>
                        {STATUS_META(ev.status, isRTL).label}
                      </Text>
                      <Text style={{ fontSize: 11.5, fontWeight: '600', color: COLORS.textSecondary, marginTop: 3, textAlign: isRTL ? 'right' : 'left' }}>
                        {fmtAdminDateTime(ev.created_at, isRTL)} · {actorTypeLabel(ev.actor_type, isRTL)}
                      </Text>
                      {!!ev.note && (
                        <Text style={{ fontSize: 12, color: COLORS.textSecondary, marginTop: 3, textAlign: isRTL ? 'right' : 'left' }}>
                          {ev.note}
                        </Text>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
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
      <AnimatedBackButton
        onPress={() => safeBack('/admin-orders')}
        color={COLORS.text}
        backgroundColor={COLORS.surface ?? COLORS.background}
        size={42}
        iconSize={22}
        rtl
      />
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
        contentContainerStyle={{
          gap: 8,
          paddingVertical: 4,
          flexDirection: isRTL ? 'row-reverse' : 'row',
        }}
      >
        {photos.map((url: string, i: number) => (
          <PhotoTile
            key={`${i}:${url}`}
            url={url}
            onPress={() => onOpen(i)}
            styles={styles}
            COLORS={COLORS}
          />
        ))}
      </ScrollView>
    </Section>
  );
}

function PhotoTile({ url, onPress, styles, COLORS }: any) {
  const [failed, setFailed] = React.useState(false);
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel="View photo"
      style={styles.photoWrap}
    >
      {failed ? (
        <View style={[styles.photo, styles.photoFallback]}>
          <MaterialCommunityIcons name="image-broken-variant" size={24} color={COLORS.textSecondary} />
        </View>
      ) : (
        <Image
          source={{ uri: url }}
          style={styles.photo}
          onError={(e) => {
            logger.warn('admin photo failed to load', { url, error: e.nativeEvent?.error });
            setFailed(true);
          }}
        />
      )}
      <View style={styles.photoOverlay}>
        <MaterialCommunityIcons name="magnify-plus-outline" size={14} color="#fff" />
      </View>
    </TouchableOpacity>
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
    photoWrap: {
      position: 'relative',
      width: 96,
      height: 96,
      borderRadius: BORDER_RADIUS.md,
      overflow: 'hidden',
    },
    photo: {
      width: 96,
      height: 96,
      borderRadius: BORDER_RADIUS.md,
      backgroundColor: C.border,
    },
    photoFallback: {
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: C.cardAlt,
    },
    photoOverlay: {
      position: 'absolute',
      bottom: 6,
      right: 6,
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: 'rgba(0,0,0,0.55)',
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
  return { ...s, _primary: C.primary } as typeof s & { _primary: string };
};
