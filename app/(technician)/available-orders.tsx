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
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { getColors, getShadows, SPACING, BORDER_RADIUS } from '../../constants/theme';
import { useApp } from '../../contexts/AppContext';
import { translations } from '../../constants/translations';
import { requests, auth } from '../../lib/api';
import { ISSUE_CATEGORIES, getIssueCategory } from '../../constants/issueCategories';
import NeuCard from '../../components/NeuCard';

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
  const COLORS = getColors(isDark);
  const SHADOWS = getShadows(isDark);
  const t = translations[language];
  const isRTL = language === 'ar';

  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [technicianLocation, setTechnicianLocation] = useState<{lat: number, lon: number} | null>(null);

  useEffect(() => {
    loadOrders();
    getTechnicianLocation();
    
    // Set up real-time subscription for new orders
    const subscription = requests.subscribeToNew((newOrder) => {
      // Add new order to the list
      setOrders(prev => [newOrder, ...prev]);
      
      // Show notification
      Alert.alert(
        language === 'ar' ? 'طلب جديد!' : 'New Order!',
        language === 'ar' 
          ? `طلب صيانة جديد: ${newOrder.device_brand} ${newOrder.device_model}`
          : `New repair request: ${newOrder.device_brand} ${newOrder.device_model}`,
        [
          { text: language === 'ar' ? 'عرض' : 'View', onPress: () => {} },
          { text: language === 'ar' ? 'لاحقاً' : 'Later', style: 'cancel' }
        ]
      );
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  const getTechnicianLocation = async () => {
    // TODO: Get actual technician location from profile or GPS
    // For now, using a default location
    setTechnicianLocation({ lat: 24.7136, lon: 46.6753 }); // Riyadh
  };

  const loadOrders = async () => {
    try {
      setLoading(true);
      const availableOrders = await requests.getAvailable();
      setOrders(availableOrders || []);
    } catch (error) {
      console.error('Error loading orders:', error);
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
      const user = await auth.getCurrentUser();
      if (!user) return;

      const success = await requests.assignToTechnician(orderId, user.id);
      
      if (success) {
        Alert.alert(
          language === 'ar' ? 'نجح!' : 'Success!',
          language === 'ar' ? 'تم قبول الطلب بنجاح' : 'Order accepted successfully'
        );
        loadOrders(); // Refresh list
      }
    } catch (error) {
      console.error('Error accepting order:', error);
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
        const category = getIssueCategory(order.service_id);
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

        <Text style={styles.orderDescription} numberOfLines={2}>
          {order.issue_description}
        </Text>

        {order.media_urls && order.media_urls.length > 0 && (
          <ScrollView horizontal style={styles.mediaPreview} showsHorizontalScrollIndicator={false}>
            {order.media_urls.map((url, index) => (
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
              {language === 'ar' ? 'السعر التقديري' : 'Estimated Price'}
            </Text>
            <Text style={styles.priceValue}>
              {order.estimated_price} {language === 'ar' ? 'ر.س' : 'SAR'}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.acceptButton}
            onPress={() => handleAcceptOrder(order.id)}
          >
            <MaterialIcons name="check-circle" size={20} color="#FFF" />
            <Text style={styles.acceptButtonText}>
              {language === 'ar' ? 'قبول' : 'Accept'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.orderLocation}>
          <MaterialIcons name="place" size={14} color={COLORS.textSecondary} />
          <Text style={styles.locationText} numberOfLines={1}>
            {order.location}
          </Text>
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

      {renderCategoryFilters()}

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
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
    backgroundColor: '#F3F4F6',
  },
  categoryText: {
    fontSize: 14,
    marginLeft: SPACING.xs,
    color: '#64748B',
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
    color: '#1F2937',
  },
  distanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10B981' + '20',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: 12,
  },
  distanceText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#10B981',
    marginLeft: SPACING.xs,
  },
  orderDescription: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: SPACING.md,
    lineHeight: 20,
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  priceContainer: {
    flex: 1,
  },
  priceLabel: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: SPACING.xs,
  },
  priceValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#10B981',
  },
  acceptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10B981',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: 12,
  },
  acceptButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFF',
    marginLeft: SPACING.xs,
  },
  orderLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  locationText: {
    fontSize: 12,
    color: '#64748B',
    marginLeft: SPACING.xs,
    flex: 1,
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
