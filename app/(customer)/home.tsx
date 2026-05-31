import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Dimensions,
  StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { COLORS, SPACING, SHADOWS } from '../../constants/theme';
import { MaterialIcons, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../contexts/AuthContext';
import { useApp } from '../../contexts/AppContext';
import { useOrders } from '../../contexts/OrdersContext';
import NotificationBell from '../../components/NotificationBell';
import {
  ORDER_STATUS_LABELS_AR,
  ORDER_STATUS_LABELS_EN,
  isTerminalStatus,
} from '../../types/order';

const { width } = Dimensions.get('window');

const SERVICES = [
  { id: 'phone', name: 'جوالات', nameEn: 'Phones', icon: 'cellphone', color: '#10B981', bg: '#ECFDF5' },
  { id: 'laptop', name: 'لابتوب', nameEn: 'Laptops', icon: 'laptop', color: '#3B82F6', bg: '#EFF6FF' },
  { id: 'tablet', name: 'تابلت', nameEn: 'Tablets', icon: 'tablet', color: '#8B5CF6', bg: '#F5F3FF' },
  { id: 'gaming', name: 'ألعاب', nameEn: 'Gaming', icon: 'gamepad-variant', color: '#6366F1', bg: '#EEF2FF' },
  { id: 'watch', name: 'ساعات', nameEn: 'Watches', icon: 'watch', color: '#EC4899', bg: '#FDF2F8' },
  { id: 'contact', name: 'اتصل بنا', nameEn: 'Contact', icon: 'phone', color: '#EF4444', bg: '#FEF2F2' },
];

const PROMOTIONS = [
  { id: 1, title: 'خصم 25%', titleEn: '25% OFF', subtitle: 'على صيانة الشاشات الأصلية', subtitleEn: 'On original screen repairs', icon: 'cellphone-screenshot', bgFrom: '#10B981', bgTo: '#059669' },
  { id: 2, title: 'فحص مجاني', titleEn: 'Free check-up', subtitle: 'شامل لجميع أجهزة آبل', subtitleEn: 'For all Apple devices', icon: 'apple', bgFrom: '#3B82F6', bgTo: '#1D4ED8' },
  { id: 3, title: 'وصول سريع', titleEn: 'Fast arrival', subtitle: 'فني محترف يصلك في موقعك', subtitleEn: 'A pro technician comes to you', icon: 'clock-fast', bgFrom: '#F59E0B', bgTo: '#D97706' },
];

export default function CustomerHomeScreen() {
  const router = useRouter();
  const { userProfile } = useAuth();
  const { orders } = useOrders();
  const { language } = useApp();
  const isRTL = language !== 'en';

  const hour = new Date().getHours();
  const greetingWord = isRTL
    ? hour < 12 ? 'صباح الخير' : hour < 18 ? 'مساء الخير' : 'مساءك سعيد'
    : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const firstName =
    userProfile?.name?.split(' ')[0] || (isRTL ? 'صديقنا' : 'there');

  // Most recent order that is not completed/cancelled.
  const activeOrder = orders.find((o) => !isTerminalStatus(o.status));
  const statusLabel = activeOrder
    ? (isRTL ? ORDER_STATUS_LABELS_AR : ORDER_STATUS_LABELS_EN)[activeOrder.status]
    : '';
  const isPending = activeOrder?.status === 'pending';

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* ── Header: greeting + bell ─────────────────────── */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting} numberOfLines={1}>
              {`${greetingWord}، ${firstName} 👋`}
            </Text>
            <Text style={styles.greetingSub}>
              {isRTL ? 'كيف نقدر نساعدك اليوم؟' : 'How can we help you today?'}
            </Text>
          </View>
          <NotificationBell style={[styles.notificationBtn, SHADOWS.small]} color={COLORS.text} />
        </View>

        {/* ── Search ──────────────────────────────────────── */}
        <TouchableOpacity
          style={[styles.searchContainer, SHADOWS.small]}
          onPress={() => router.push('/(customer)/services')}
          accessibilityRole="button"
        >
          <Ionicons name="search" size={20} color={COLORS.textSecondary} />
          <Text style={[styles.searchPlaceholder, { textAlign: isRTL ? 'right' : 'left' }]}>
            {isRTL ? 'ابحث عن جهاز، عطل، أو خدمة...' : 'Search a device, issue or service...'}
          </Text>
        </TouchableOpacity>

        {/* ── Active order card OR welcome hero ───────────── */}
        {activeOrder ? (
          <TouchableOpacity
            style={[styles.activeOrderCard, SHADOWS.medium]}
            activeOpacity={0.9}
            onPress={() => router.push({ pathname: '/order-details', params: { id: activeOrder.id } })}
          >
            <View style={styles.orderStatusLine}>
              <View style={[styles.statusDot, { backgroundColor: isPending ? COLORS.warning : COLORS.success }]} />
              <Text style={[styles.orderStatusText, { color: isPending ? COLORS.warning : COLORS.success }]}>
                {statusLabel}
              </Text>
              <Text style={styles.orderTrackLink}>{isRTL ? 'تتبّع ‹' : 'Track ›'}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.orderContent}>
              <View style={styles.deviceIcon}>
                <MaterialCommunityIcons name="cellphone-cog" size={24} color={COLORS.primary} />
              </View>
              <View style={styles.orderDetails}>
                <Text style={styles.deviceName} numberOfLines={1}>
                  {[activeOrder.device_brand, activeOrder.device_model].filter(Boolean).join(' ') ||
                    (isRTL ? 'طلب إصلاح' : 'Repair order')}
                </Text>
                <Text style={styles.issueType} numberOfLines={1}>
                  {activeOrder.issue_description || (isRTL ? 'قيد المتابعة' : 'In progress')}
                </Text>
              </View>
              <MaterialIcons
                name={isRTL ? 'arrow-back-ios' : 'arrow-forward-ios'}
                size={16}
                color={COLORS.textSecondary}
              />
            </View>
          </TouchableOpacity>
        ) : (
          <View style={[styles.welcomeHero, SHADOWS.medium]}>
            <MaterialCommunityIcons name="tools" size={32} color={COLORS.primary} />
            <Text style={styles.welcomeTitle}>
              {isRTL ? 'جهازك يحتاج إصلاح؟' : 'Device needs a fix?'}
            </Text>
            <Text style={styles.welcomeSub}>
              {isRTL
                ? 'احجز فنياً محترفاً خلال دقيقة واحدة.'
                : 'Book a professional technician in under a minute.'}
            </Text>
          </View>
        )}

        {/* ── Primary CTA: New Repair Request ─────────────── */}
        <TouchableOpacity
          style={[styles.primaryCta, SHADOWS.medium]}
          activeOpacity={0.9}
          onPress={() => router.push('/request')}
        >
          <LinearGradient
            colors={[COLORS.primary, COLORS.primaryDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.primaryCtaGradient}
          >
            <View style={styles.primaryCtaIcon}>
              <MaterialCommunityIcons name="plus-circle" size={26} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.primaryCtaTitle}>
                {isRTL ? 'طلب إصلاح جديد' : 'Request New Repair'}
              </Text>
              <Text style={styles.primaryCtaSub}>
                {isRTL ? 'فني يصلك أينما كنت' : 'A technician comes to you'}
              </Text>
            </View>
            <MaterialIcons
              name={isRTL ? 'arrow-back' : 'arrow-forward'}
              size={22}
              color="#fff"
            />
          </LinearGradient>
        </TouchableOpacity>

        {/* ── Quick actions: My Orders / Market / Track ───── */}
        <View style={styles.quickRow}>
          <QuickAction
            icon="clipboard-text-outline"
            label={isRTL ? 'طلباتي' : 'My Orders'}
            color="#3B82F6"
            onPress={() => router.push('/(customer)/orders')}
          />
          <QuickAction
            icon="storefront-outline"
            label={isRTL ? 'السوق' : 'Market'}
            color="#F59E0B"
            onPress={() => router.push('/market')}
          />
          <QuickAction
            icon="map-marker-path"
            label={isRTL ? 'تتبّع الطلب' : 'Track Order'}
            color="#10B981"
            onPress={() =>
              router.push(
                activeOrder
                  ? { pathname: '/order-details', params: { id: activeOrder.id } }
                  : '/(customer)/orders'
              )
            }
          />
        </View>

        {/* ── Services grid ───────────────────────────────── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{isRTL ? 'خدماتنا' : 'Our services'}</Text>
          <TouchableOpacity onPress={() => router.push('/(customer)/services')}>
            <Text style={styles.seeAll}>{isRTL ? 'عرض الكل' : 'See all'}</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.servicesGrid}>
          {SERVICES.map((service) => (
            <TouchableOpacity
              key={service.id}
              style={styles.serviceCard}
              activeOpacity={0.7}
              onPress={() => service.id === 'contact' ? router.push('/contact') : router.push('/request')}
            >
              <View style={[styles.serviceIconContainer, { backgroundColor: service.bg }]}>
                <MaterialCommunityIcons name={service.icon as any} size={30} color={service.color} />
              </View>
              <Text style={styles.serviceName}>{isRTL ? service.name : service.nameEn}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Promotions (bottom) ─────────────────────────── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{isRTL ? 'عروض وأخبار' : 'Offers & news'}</Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: SPACING.l, gap: SPACING.m }}
        >
          {PROMOTIONS.map((promo) => (
            <View key={promo.id} style={[styles.promoCard, SHADOWS.medium]}>
              <LinearGradient
                colors={[promo.bgFrom, promo.bgTo]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFillObject}
              />
              <MaterialCommunityIcons
                name={promo.icon as any}
                size={120}
                color="rgba(255,255,255,0.18)"
                style={{ position: 'absolute', right: -16, top: -16 }}
              />
              <View style={styles.promoContent}>
                <Text style={styles.promoTitle}>{isRTL ? promo.title : promo.titleEn}</Text>
                <Text style={styles.promoSubtitle}>{isRTL ? promo.subtitle : promo.subtitleEn}</Text>
              </View>
            </View>
          ))}
        </ScrollView>
      </ScrollView>
    </SafeAreaView>
  );
}

function QuickAction({ icon, label, color, onPress }: {
  icon: any; label: string; color: string; onPress: () => void;
}) {
  return (
    <TouchableOpacity style={[styles.quickCard, SHADOWS.small]} activeOpacity={0.8} onPress={onPress}>
      <View style={[styles.quickIcon, { backgroundColor: color + '18' }]}>
        <MaterialCommunityIcons name={icon} size={24} color={color} />
      </View>
      <Text style={styles.quickLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: { paddingBottom: SPACING.xxl },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.l,
    paddingTop: SPACING.xl,
    gap: SPACING.m,
  },
  greeting: { fontSize: 22, fontWeight: 'bold', color: COLORS.text, marginBottom: 2 },
  greetingSub: { fontSize: 13, color: COLORS.textSecondary },
  notificationBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    marginHorizontal: SPACING.l,
    padding: SPACING.m,
    borderRadius: 16,
    marginBottom: SPACING.l,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.s,
  },
  searchPlaceholder: { color: COLORS.textSecondary, fontSize: 14, flex: 1 },

  activeOrderCard: {
    marginHorizontal: SPACING.l,
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: SPACING.m,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.l,
  },
  orderStatusLine: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.s, gap: 8 },
  statusDot: { width: 9, height: 9, borderRadius: 5 },
  orderStatusText: { fontSize: 14, fontWeight: 'bold', flex: 1 },
  orderTrackLink: { fontSize: 13, color: COLORS.primary, fontWeight: '700' },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: SPACING.s },
  orderContent: { flexDirection: 'row', alignItems: 'center', gap: SPACING.m },
  deviceIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  orderDetails: { flex: 1 },
  deviceName: { fontSize: 16, fontWeight: 'bold', color: COLORS.text },
  issueType: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },

  welcomeHero: {
    marginHorizontal: SPACING.l,
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: SPACING.l,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.l,
    alignItems: 'flex-start',
    gap: 6,
  },
  welcomeTitle: { fontSize: 17, fontWeight: 'bold', color: COLORS.text, marginTop: 6 },
  welcomeSub: { fontSize: 13, color: COLORS.textSecondary },

  primaryCta: {
    marginHorizontal: SPACING.l,
    borderRadius: 18,
    marginBottom: SPACING.l,
  },
  primaryCtaGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.m,
    padding: SPACING.l,
    borderRadius: 18,
  },
  primaryCtaIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryCtaTitle: { color: '#fff', fontSize: 17, fontWeight: 'bold' },
  primaryCtaSub: { color: 'rgba(255,255,255,0.9)', fontSize: 13, marginTop: 2 },

  quickRow: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.l,
    gap: SPACING.m,
    marginBottom: SPACING.xl,
  },
  quickCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    paddingVertical: SPACING.m,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  quickIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickLabel: { fontSize: 13, fontWeight: '600', color: COLORS.text },

  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.l,
    marginBottom: SPACING.m,
  },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.text },
  seeAll: { fontSize: 14, color: COLORS.primary, fontWeight: '600' },

  servicesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: SPACING.l,
    gap: SPACING.m,
    marginBottom: SPACING.xl,
  },
  serviceCard: {
    width: (width - SPACING.l * 2 - SPACING.m * 2) / 3,
    alignItems: 'center',
    marginBottom: SPACING.s,
  },
  serviceIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.s,
  },
  serviceName: { fontSize: 14, fontWeight: '600', color: COLORS.text },

  promoCard: {
    width: width * 0.72,
    height: 130,
    borderRadius: 20,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    padding: SPACING.l,
  },
  promoContent: { alignItems: 'flex-start' },
  promoTitle: { color: '#FFF', fontSize: 22, fontWeight: 'bold', marginBottom: 4 },
  promoSubtitle: { color: 'rgba(255,255,255,0.9)', fontSize: 13 },
});
