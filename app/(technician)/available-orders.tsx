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
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { getColors, getShadows, SPACING, BORDER_RADIUS } from '../../constants/theme';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import { translations } from '../../constants/translations';
import * as orderService from '../../services/orderService';
import { subscribeToPendingOrders } from '../../services/realtimeService';
import { supabase } from '../../services/supabaseClient';
import { resolveOrderMediaUrls } from '../../services/storageService';
import { ISSUE_CATEGORIES, getIssueCategory } from '../../constants/issueCategories';
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
  // B-5 Wave 4: signed-URL mirror for customer media thumbnails on each
  // available-order card. Keyed by order.id. Falls back to stored URLs.
  const [displayMediaByOrderId, setDisplayMediaByOrderId] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [technicianLocation, setTechnicianLocation] = useState<{lat: number, lon: number} | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // Assignment eligibility — a suspended/excluded technician cannot take jobs.
  const [eligible, setEligible] = useState<boolean | null>(null);

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

  // Re-sign customer media for every order whenever the list changes.
  // Batched into a single createSignedUrls round-trip then partitioned
  // back by order.id, matching the resolver fall-back semantics.
  useEffect(() => {
    let cancelled = false;
    const entries = orders
      .map((o) => [o.id, Array.isArray((o as any).media_urls) ? ((o as any).media_urls as string[]) : []] as const)
      .filter(([, arr]) => arr.length > 0);
    if (entries.length === 0) { setDisplayMediaByOrderId({}); return; }
    const flat: string[] = entries.flatMap(([, arr]) => arr);
    resolveOrderMediaUrls(flat)
      .then((resolved) => {
        if (cancelled) return;
        const next: Record<string, string[]> = {};
        let cursor = 0;
        entries.forEach(([k, arr]) => {
          next[k] = arr.map((original, j) => resolved[cursor + j] ?? original);
          cursor += arr.length;
        });
        setDisplayMediaByOrderId(next);
      })
      .catch(() => { /* keep stored URLs */ });
    return () => { cancelled = true; };
  }, [orders]);

  useEffect(() => {
    loadOrders();
    getTechnicianLocation();

    // subscribeToPendingOrders now returns its own cleanup callable.
    return subscribeToPendingOrders((order) => {
      setOrders((prev) => (prev.some((o) => o.id === order.id) ? prev : [order, ...prev]));
    });
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

  const handleAcceptOrder = async (orderId: string) => {
    try {
      if (!user) return;
      if (eligible === false) {
        Alert.alert(
          language === 'ar' ? 'غير متاح' : 'Not available',
          language === 'ar'
            ? 'حسابك كفني موقوف حالياً ولا يمكنك قبول طلبات جديدة.'
            : 'Your technician account is restricted — you cannot accept new jobs.'
        );
        return;
      }
      await orderService.assignOrderToTechnician(orderId, user.id);
      await orderService.updateOrderStatus(orderId, 'accepted');
      
      Alert.alert(
        language === 'ar' ? 'نجح!' : 'Success!',
        language === 'ar' ? 'تم قبول الطلب بنجاح' : 'Order accepted successfully'
      );
      
      // Navigate to manage order screen
      router.push({
        pathname: '/(technician)/manage-order',
        params: { id: orderId }
      });
    } catch (error) {
      logger.error('Error accepting order:', error);
      Alert.alert(
        language === 'ar' ? 'خطأ' : 'Error',
        language === 'ar' ? 'حدث خطأ أثناء قبول الطلب' : 'An error occurred while accepting the order'
      );
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

        {order.media_urls && order.media_urls.length > 0 && (
          <ScrollView horizontal style={styles.mediaPreview} showsHorizontalScrollIndicator={false}>
            {order.media_urls.map((url: string, index: number) => (
              <Image
                key={index}
                source={{ uri: displayMediaByOrderId[order.id]?.[index] ?? url }}
                style={styles.mediaThumb}
              />
            ))}
          </ScrollView>
        )}

        <View style={styles.orderFooter}>
          <View style={styles.priceContainer}>
            <Text style={styles.priceLabel}>
              {language === 'ar' ? 'عرض السعر' : 'Quotation'}
            </Text>
            <Text style={styles.priceValue}>
              {order.estimated_price} {language === 'ar' ? 'ر.س' : 'SAR'}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.acceptButton}
            onPress={() => {
              router.push({
                pathname: '/(technician)/manage-order',
                params: { id: order.id }
              });
            }}
          >
            <MaterialIcons name="visibility" size={20} color="#FFF" />
            <Text style={styles.acceptButtonText}>
              {language === 'ar' ? 'عرض التفاصيل' : 'View Details'}
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
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: COLORS.text }]}>
          {language === 'ar' ? 'الطلبات المتاحة' : 'Available Orders'}
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 20,
    marginRight: SPACING.sm,
    backgroundColor: COLORS.cardAlt,
  },
  categoryText: {
    fontSize: 14,
    marginLeft: SPACING.xs,
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.md,
  },
  orderInfo: {
    flex: 1,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: 12,
    marginBottom: SPACING.sm,
  },
  categoryBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: SPACING.xs,
  },
  orderDevice: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  distanceBadge: {
    flexDirection: 'row',
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
    marginLeft: SPACING.xs,
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
    flexDirection: 'row',
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
    paddingHorizontal: SPACING.l,
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: BORDER_RADIUS.sm,
    ...SHADOWS.small,
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
