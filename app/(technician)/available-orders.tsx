import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Image,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { getColors, getShadows, SPACING, BORDER_RADIUS } from '../../constants/theme';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import { translations } from '../../constants/translations';
import * as orderService from '../../services/orderService';
import {
  submitOffer,
  getMyOffers,
  type OrderOffer,
} from '../../services/offerMarketplaceService';
import { subscribeToPendingOrders, subscribeToAvailableOrderRemovals } from '../../services/realtimeService';
import { supabase } from '../../services/supabaseClient';
import { safeBack } from '../../utils/navigation';
import { ISSUE_CATEGORIES, getIssueCategory } from '../../constants/issueCategories';
import { SPARE_PART_LABELS, type SparePartQuality } from '../../types/order';
import NeuCard from '../../components/NeuCard';
import ErrorState from '../../components/ErrorState';
import { SkeletonOrderCard } from '../../components/SkeletonLoader';
import { getFriendlyError } from '../../utils/errorMessages';
import { logger } from '../../utils/logger';

// Human-readable label for how the customer wants the device serviced.
function fulfillmentLabel(type: string | null | undefined, language: string): string {
  const ar = language === 'ar';
  switch (type) {
    case 'mobile':
    case 'on_site':
      return ar ? 'خدمة في موقعك' : 'On-site service';
    case 'pickup':
    case 'pickup_delivery':
      return ar ? 'استلام وتسليم' : 'Pickup & delivery';
    case 'personal_handoff':
    case 'handoff':
    case 'drop_off':
      return ar ? 'تسليم باليد' : 'Drop-off / handoff';
    default:
      return ar ? 'طريقة الخدمة غير محددة' : 'Service method not specified';
  }
}

// Calculate distance between two coordinates (Haversine formula)
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function AvailableOrdersScreen() {
  const router = useRouter();
  const { language, isDark } = useApp();
  const { user } = useAuth();
  const COLORS = getColors(isDark);
  const SHADOWS = getShadows(isDark);
  const t = translations[language];
  const isRTL = language === 'ar';
  const styles = makeStyles(COLORS, isRTL, SHADOWS);

  const [orders, setOrders] = useState<orderService.Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [technicianLocation, setTechnicianLocation] = useState<{lat: number, lon: number} | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // Assignment eligibility — a suspended/excluded technician cannot take jobs.
  const [eligible, setEligible] = useState<boolean | null>(null);
  // Marketplace: my submitted offers keyed by order_id, plus the offer sheet.
  const [myOffers, setMyOffers] = useState<Record<string, OrderOffer>>({});
  const [offerTarget, setOfferTarget] = useState<orderService.Order | null>(null);
  const [offerAmount, setOfferAmount] = useState('');
  const [offerNote, setOfferNote] = useState('');
  const [submittingOffer, setSubmittingOffer] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase
          .from('technicians')
          .select('technician_status')
          .eq('user_id', user.id)
          .maybeSingle();
        if (cancelled) return;
        const s = (data as any)?.technician_status;
        setEligible(s !== 'excluded' && s !== 'suspended');
      } catch {
        if (!cancelled) setEligible(true);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  useEffect(() => {
    loadOrders();
    getTechnicianLocation();

    // New pending orders appear instantly (RLS allows technicians to SELECT
    // pending+unassigned orders, so postgres_changes INSERT is delivered).
    const cleanupAdd = subscribeToPendingOrders((order) => {
      setOrders((prev) => (prev.some((o) => o.id === order.id) ? prev : [order, ...prev]));
    });
    // Accepted/cancelled orders disappear instantly via the broadcast topic.
    const cleanupRemove = subscribeToAvailableOrderRemovals((orderId) => {
      setOrders((prev) => prev.filter((o) => o.id !== orderId));
    });
    return () => {
      cleanupAdd();
      cleanupRemove();
    };
  }, []);

  const getTechnicianLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        logger.warn('Location permission denied');
        setTechnicianLocation({ lat: 24.7136, lon: 46.6753 });
        return;
      }
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setTechnicianLocation({
        lat: position.coords.latitude,
        lon: position.coords.longitude,
      });
    } catch (error) {
      logger.error('Failed to get technician location', error);
      setTechnicianLocation({ lat: 24.7136, lon: 46.6753 });
    }
  };

  const loadOrders = async () => {
    try {
      setLoading(true);
      // Get technician's city from location or profile
      // For now, we'll try to extract city from the current location address
      let city = '';
      if (technicianLocation) {
        const reverseGeocode = await Location.reverseGeocodeAsync({
          latitude: technicianLocation.lat,
          longitude: technicianLocation.lon
        });
        if (reverseGeocode.length > 0) {
          city = reverseGeocode[0].city || '';
        }
      }
      
      setErrorMessage(null);
      const availableOrders = await orderService.getAvailableOrders();
      setOrders(availableOrders || []);

      // My submitted offers, so cards show "you already quoted X" instead of
      // letting the technician double-submit blindly.
      if (user?.id) {
        const offers = await getMyOffers(user.id);
        const map: Record<string, OrderOffer> = {};
        for (const o of offers) map[o.order_id] = o;
        setMyOffers(map);
      }
    } catch (error: any) {
      logger.error('Error loading orders:', error);
      setErrorMessage(getFriendlyError(error, language));
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadOrders();
    setRefreshing(false);
  };

  // Marketplace flow: technicians no longer claim requests directly — they
  // submit a quote and the customer picks one. Opening the sheet pre-fills
  // any existing pending offer for a revision.
  const handleOpenOffer = (order: orderService.Order) => {
    if (eligible === false) {
      Alert.alert(
        language === 'ar' ? 'غير متاح' : 'Not available',
        language === 'ar'
          ? 'حسابك كفني موقوف حالياً ولا يمكنك تقديم عروض جديدة.'
          : 'Your technician account is restricted — you cannot submit new offers.'
      );
      return;
    }
    const existing = myOffers[order.id];
    setOfferAmount(
      existing?.status === 'pending' ? String(Math.round(existing.amount)) : ''
    );
    setOfferNote(existing?.status === 'pending' ? existing.note ?? '' : '');
    setOfferTarget(order);
  };

  const handleSubmitOffer = async () => {
    if (!offerTarget || !user) return;
    const amount = Number(offerAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      Alert.alert(
        language === 'ar' ? 'تنبيه' : 'Notice',
        language === 'ar' ? 'اكتب سعراً صحيحاً بالريال' : 'Enter a valid price in SAR'
      );
      return;
    }
    setSubmittingOffer(true);
    try {
      const offer = await submitOffer(offerTarget.id, amount, offerNote.trim() || undefined);
      setMyOffers((prev) => ({ ...prev, [offerTarget.id]: offer }));
      setOfferTarget(null);
      Alert.alert(
        language === 'ar' ? 'تم الإرسال ✓' : 'Sent ✓',
        language === 'ar'
          ? 'وصل عرضك للعميل. سيصلك إشعار إذا تم قبوله.'
          : "Your offer reached the customer. You'll be notified if it's accepted."
      );
    } catch (error: any) {
      logger.error('Error submitting offer:', error);
      const msg = String(error?.message ?? '');
      const closed = msg.includes('order_not_open');
      if (closed) {
        setOrders((prev) => prev.filter((o) => o.id !== offerTarget.id));
        setOfferTarget(null);
      }
      Alert.alert(
        language === 'ar' ? 'خطأ' : 'Error',
        closed
          ? (language === 'ar' ? 'هذا الطلب لم يعد متاحاً للعروض.' : 'This request is no longer open for offers.')
          : getFriendlyError(error, language)
      );
    } finally {
      setSubmittingOffer(false);
    }
  };

  const getDistance = (order: any): string => {
    if (!technicianLocation || !order.latitude || !order.longitude) {
      return '-- km';
    }
    
    const distance = calculateDistance(
      technicianLocation.lat,
      technicianLocation.lon,
      order.latitude,
      order.longitude
    );
    
    return `${distance.toFixed(1)} km`;
  };

  const filteredOrders = categoryFilter === 'all' 
    ? orders 
    : orders.filter(order => {
        const category = getIssueCategory(order.service_id || '');
        return category === categoryFilter;
      });

  // Sort by distance
  const sortedOrders = [...filteredOrders].sort((a, b) => {
    if (!technicianLocation) return 0;
    
    const distA = a.latitude && a.longitude 
      ? calculateDistance(technicianLocation.lat, technicianLocation.lon, a.latitude, a.longitude)
      : 999999;
    const distB = b.latitude && b.longitude
      ? calculateDistance(technicianLocation.lat, technicianLocation.lon, b.latitude, b.longitude)
      : 999999;
    
    return distA - distB;
  });

  const renderCategoryFilters = () => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.categoryScroll}
      contentContainerStyle={styles.categoryContent}
    >
      {ISSUE_CATEGORIES.map((category) => (
        <TouchableOpacity
          key={category.id}
          style={[
            styles.categoryChip,
            categoryFilter === category.id && {
              backgroundColor: category.color,
            },
          ]}
          onPress={() => setCategoryFilter(category.id)}
        >
          <MaterialCommunityIcons
            name={category.icon as any}
            size={18}
            color={categoryFilter === category.id ? '#FFF' : COLORS.textSecondary}
          />
          <Text
            style={[
              styles.categoryText,
              categoryFilter === category.id && styles.categoryTextActive,
            ]}
          >
            {language === 'ar' ? category.nameAr : category.name}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  const renderOrderCard = (order: any) => {
    const category = ISSUE_CATEGORIES.find(c => c.id === getIssueCategory(order.service_id));
    const distance = getDistance(order);
    const myOffer = myOffers[order.id];

    return (
      <NeuCard key={order.id} style={styles.orderCard}>
        <View style={styles.orderHeader}>
          <View style={styles.orderInfo}>
            <View style={[styles.categoryBadge, { backgroundColor: category?.color + '20' }]}>
              <MaterialCommunityIcons
                name={category?.icon as any}
                size={16}
                color={category?.color}
              />
              <Text style={[styles.categoryBadgeText, { color: category?.color }]}>
                {language === 'ar' ? category?.nameAr : category?.name}
              </Text>
            </View>
            <Text style={styles.orderDevice}>
              {order.device_brand} {order.device_model}
            </Text>
          </View>
          <View style={styles.distanceBadge}>
            <MaterialIcons name="location-on" size={16} color={COLORS.primary} />
            <Text style={styles.distanceText}>{distance}</Text>
          </View>
        </View>

        <Text style={styles.orderDescription} numberOfLines={3}>
          {order.issue_description}
        </Text>

        <View style={styles.detailLine}>
          <MaterialIcons name="place" size={15} color={COLORS.textSecondary} />
          <Text style={styles.detailLineText} numberOfLines={1}>
            {order.location || (language === 'ar' ? 'الموقع غير محدد' : 'Location not specified')}
          </Text>
        </View>
        <View style={styles.detailLine}>
          <MaterialCommunityIcons name="truck-fast-outline" size={15} color={COLORS.textSecondary} />
          <Text style={styles.detailLineText}>
            {fulfillmentLabel(order.fulfillment_type ?? order.service_type, language)}
          </Text>
        </View>
        {/* Spare-part quality the customer chose — shown before acceptance so
            the technician knows which parts the job calls for. */}
        {!!order.spare_part_quality && SPARE_PART_LABELS[order.spare_part_quality as SparePartQuality] && (
          <View style={styles.detailLine}>
            <MaterialCommunityIcons name="shield-check" size={15} color={COLORS.textSecondary} />
            <Text style={styles.detailLineText}>
              {(language === 'ar' ? 'جودة قطعة الغيار: ' : 'Spare-part quality: ') +
                SPARE_PART_LABELS[order.spare_part_quality as SparePartQuality][language === 'ar' ? 'ar' : 'en']}
            </Text>
          </View>
        )}

        {order.media_urls && order.media_urls.length > 0 && (
          <ScrollView horizontal style={styles.mediaPreview} showsHorizontalScrollIndicator={false}>
            {order.media_urls.map((url: string, index: number) => (
              <Image
                key={index}
                source={{ uri: url }}
                style={styles.mediaThumb}
              />
            ))}
          </ScrollView>
        )}

        <View style={styles.orderFooter}>
          <View style={styles.priceContainer}>
            <Text style={styles.priceLabel}>
              {language === 'ar' ? 'التقدير المبدئي للعميل' : "Customer's initial estimate"}
            </Text>
            <Text style={styles.priceValue}>
              {order.estimated_price
                ? `${order.estimated_price} ${language === 'ar' ? 'ر.س' : 'SAR'}`
                : language === 'ar' ? 'حسب الفحص' : 'On inspection'}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.detailsButton}
            onPress={() => {
              router.push({
                pathname: '/(technician)/manage-order',
                params: { id: order.id }
              });
            }}
          >
            <MaterialIcons name="visibility" size={18} color={COLORS.primary} />
            <Text style={[styles.acceptButtonText, { color: COLORS.primary }]}>
              {language === 'ar' ? 'التفاصيل' : 'Details'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.acceptButton}
            onPress={() => handleOpenOffer(order)}
          >
            <MaterialCommunityIcons
              name={myOffer?.status === 'pending' ? 'pencil-outline' : 'cash-plus'}
              size={18}
              color="#FFF"
            />
            <Text style={styles.acceptButtonText}>
              {myOffer?.status === 'pending'
                ? language === 'ar' ? `عرضك: ${Math.round(myOffer.amount)} ر.س` : `Your offer: ${Math.round(myOffer.amount)}`
                : language === 'ar' ? 'قدّم عرض سعر' : 'Submit offer'}
            </Text>
          </TouchableOpacity>
        </View>
      </NeuCard>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: COLORS.background }]}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={COLORS.background}
      />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => safeBack('/(technician)')}>
          <MaterialIcons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: COLORS.text }]}>
          {language === 'ar' ? 'الطلبات المتاحة' : 'Available Requests'}
        </Text>
        <TouchableOpacity onPress={handleRefresh}>
          <MaterialIcons name="refresh" size={24} color={COLORS.text} />
        </TouchableOpacity>
      </View>

      {eligible === false && (
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            gap: 10,
            margin: 16,
            padding: 14,
            borderRadius: 12,
            backgroundColor: COLORS.error + '15',
            borderWidth: 1,
            borderColor: COLORS.error + '40',
          }}
        >
          <MaterialCommunityIcons name="account-cancel-outline" size={22} color={COLORS.error} />
          <Text style={{ flex: 1, color: COLORS.text, fontSize: 13, fontWeight: '700', textAlign: isRTL ? 'right' : 'left' }}>
            {language === 'ar'
              ? 'حسابك كفني موقوف حالياً — لا يمكنك قبول طلبات جديدة.'
              : 'Your technician account is restricted — you cannot accept new jobs.'}
          </Text>
        </View>
      )}

      {renderCategoryFilters()}

      {loading ? (
        <View style={{ paddingTop: 16, paddingHorizontal: 16 }}>
          <SkeletonOrderCard />
          <SkeletonOrderCard />
          <SkeletonOrderCard />
        </View>
      ) : errorMessage ? (
        <ErrorState message={errorMessage} onRetry={loadOrders} />
      ) : (
        <ScrollView
          style={styles.content}
          contentContainerStyle={{ paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={COLORS.primary}
            />
          }
        >
          {sortedOrders.length === 0 ? (
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons
                name="clipboard-text-off"
                size={64}
                color={COLORS.textSecondary}
              />
              <Text style={[styles.emptyText, { color: COLORS.textSecondary }]}>
                {language === 'ar' ? 'لا توجد طلبات متاحة حالياً' : 'No available orders at the moment'}
              </Text>
            </View>
          ) : (
            sortedOrders.map(renderOrderCard)
          )}
        </ScrollView>
      )}

      {/* Offer sheet — the technician quotes; the customer chooses. */}
      <Modal
        visible={!!offerTarget}
        transparent
        animationType="slide"
        onRequestClose={() => setOfferTarget(null)}
      >
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={[styles.offerSheet, { backgroundColor: COLORS.card }]}>
            <Text style={[styles.offerTitle, { color: COLORS.text }]}>
              {language === 'ar' ? 'قدّم عرض سعر' : 'Submit your offer'}
            </Text>
            <Text style={{ color: COLORS.textSecondary, fontSize: 13, textAlign: isRTL ? 'right' : 'left', lineHeight: 20 }}>
              {language === 'ar'
                ? `${offerTarget?.device_brand ?? ''} ${offerTarget?.device_model ?? ''} — يرى العميل عرضك مع عروض الفنيين الآخرين ويختار واحداً.`
                : `${offerTarget?.device_brand ?? ''} ${offerTarget?.device_model ?? ''} — the customer sees your offer alongside others and picks one.`}
            </Text>

            <View style={[styles.offerInputWrap, { borderColor: COLORS.border, flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              <TextInput
                style={[styles.offerInput, { color: COLORS.text }]}
                placeholder={language === 'ar' ? 'السعر المعروض' : 'Offered price'}
                placeholderTextColor={COLORS.textSecondary}
                keyboardType="numeric"
                value={offerAmount}
                onChangeText={setOfferAmount}
                textAlign={isRTL ? 'right' : 'left'}
              />
              <Text style={{ color: COLORS.textSecondary, fontWeight: '700' }}>
                {language === 'ar' ? 'ر.س' : 'SAR'}
              </Text>
            </View>

            <View style={[styles.offerInputWrap, { borderColor: COLORS.border, minHeight: 70, alignItems: 'flex-start', paddingVertical: 10 }]}>
              <TextInput
                style={[styles.offerInput, { color: COLORS.text }]}
                placeholder={language === 'ar' ? 'ملاحظة للعميل (اختياري)' : 'Note to the customer (optional)'}
                placeholderTextColor={COLORS.textSecondary}
                value={offerNote}
                onChangeText={setOfferNote}
                multiline
                textAlign={isRTL ? 'right' : 'left'}
              />
            </View>

            <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: 10 }}>
              <TouchableOpacity
                style={[styles.offerCancel, { borderColor: COLORS.border }]}
                onPress={() => setOfferTarget(null)}
                disabled={submittingOffer}
                accessibilityRole="button"
              >
                <Text style={{ color: COLORS.textSecondary, fontWeight: '700' }}>
                  {language === 'ar' ? 'إلغاء' : 'Cancel'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.offerSubmit, { backgroundColor: COLORS.primary, opacity: submittingOffer ? 0.6 : 1 }]}
                onPress={handleSubmitOffer}
                disabled={submittingOffer}
                accessibilityRole="button"
              >
                {submittingOffer ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={{ color: '#fff', fontWeight: '800' }}>
                    {language === 'ar' ? 'إرسال العرض' : 'Send offer'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const makeStyles = (COLORS: any, isRTL: boolean, SHADOWS: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.m,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.text,
  },
  categoryScroll: {
    maxHeight: 50,
  },
  categoryContent: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
  },
  categoryChip: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 20,
    marginEnd: SPACING.sm,
    backgroundColor: COLORS.cardAlt,
  },
  categoryText: {
    fontSize: 14,
    marginStart: SPACING.xs,
    color: COLORS.textSecondary,
  },
  categoryTextActive: {
    color: '#FFF',
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: SPACING.lg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING.xl * 2,
  },
  emptyText: {
    fontSize: 16,
    marginTop: SPACING.lg,
    textAlign: 'center',
  },
  orderCard: {
    padding: SPACING.lg,
    marginBottom: SPACING.md,
  },
  orderHeader: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.md,
  },
  orderInfo: {
    flex: 1,
  },
  categoryBadge: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    alignSelf: isRTL ? 'flex-end' : 'flex-start',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: 12,
    marginBottom: SPACING.sm,
  },
  categoryBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    marginStart: SPACING.xs,
  },
  orderDevice: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  distanceBadge: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary + '20',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: 12,
  },
  distanceText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary,
    marginStart: SPACING.xs,
  },
  orderDescription: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
    lineHeight: 20,
  },
  detailLine: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 5,
  },
  detailLineText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    flex: 1,
    textAlign: isRTL ? 'right' : 'left',
  },
  orderFooter: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.md,
  },
  priceContainer: {
    flex: 1,
  },
  priceLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  priceValue: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.primary,
  },
  acceptButton: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.m,
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: BORDER_RADIUS.sm,
    ...SHADOWS.small,
  },
  detailsButton: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.primary,
    paddingHorizontal: SPACING.m,
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: BORDER_RADIUS.sm,
    marginEnd: SPACING.xs,
    gap: 4,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  offerSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: SPACING.xl,
    gap: SPACING.md,
    paddingBottom: SPACING.xl + 12,
  },
  offerTitle: {
    fontSize: 18,
    fontWeight: '800',
    textAlign: isRTL ? 'right' : 'left',
  },
  offerInputWrap: {
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: 14,
    minHeight: 52,
    gap: 8,
  },
  offerInput: {
    flex: 1,
    fontSize: 15,
  },
  offerCancel: {
    flex: 1,
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  offerSubmit: {
    flex: 2,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  acceptButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFF',
    marginLeft: SPACING.xs,
  },
  mediaPreview: {
    marginVertical: SPACING.sm,
  },
  mediaThumb: {
    width: 80,
    height: 80,
    borderRadius: BORDER_RADIUS.md,
    marginRight: SPACING.xs,
  },
});
