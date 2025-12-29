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
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { getColors, getShadows, SPACING, BORDER_RADIUS } from '../../constants/theme';
import { useApp } from '../../contexts/AppContext';
import { translations } from '../../constants/translations';
import { requests } from '../../lib/supabase-api';
import { ISSUE_CATEGORIES, filterIssuesByCategory, getIssueCategory } from '../../constants/issueCategories';
import NeuCard from '../../components/NeuCard';
import BottomNav from '../../components/BottomNav';

const STATUS_COLORS: any = {
  pending: '#F59E0B',
  confirmed: '#3B82F6',
  in_progress: '#8B5CF6',
  completed: '#10B981',
  cancelled: '#EF4444',
};

const STATUS_LABELS: any = {
  pending: { en: 'Pending', ar: 'قيد الانتظار' },
  confirmed: { en: 'Confirmed', ar: 'مؤكد' },
  in_progress: { en: 'In Progress', ar: 'جاري التنفيذ' },
  completed: { en: 'Completed', ar: 'مكتمل' },
  cancelled: { en: 'Cancelled', ar: 'ملغي' },
};

export default function OrdersScreen() {
  const router = useRouter();
  const { language, isDark } = useApp();
  const COLORS = getColors(isDark);
  const SHADOWS = getShadows(isDark);
  const t = translations[language];
  const isRTL = language === 'ar';

  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [categoryFilter, setCategoryFilter] = useState('all');

  useEffect(() => {
    loadOrders();
  }, [filter]);

  const loadOrders = async () => {
    try {
      setLoading(true);
      const data = await requests.getUserOrders();
      
      let filteredData = data;
      if (filter === 'active') {
        filteredData = data.filter((order: any) => 
          ['pending', 'confirmed', 'in_progress'].includes(order.status)
        );
      } else if (filter === 'completed') {
        filteredData = data.filter((order: any) => 
          ['completed', 'cancelled'].includes(order.status)
        );
      }
      
      setOrders(filteredData);
    } catch (error) {
      console.log('Error loading orders:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadOrders();
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const styles = createStyles(COLORS, SHADOWS, isRTL);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={COLORS.background} />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={[styles.backButton, SHADOWS.neu]}
          onPress={() => router.back()}
        >
          <MaterialIcons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={24} color={COLORS.text} />
        </TouchableOpacity>
        
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>{language === 'ar' ? 'طلباتي' : 'My Orders'}</Text>
        </View>
        
        <View style={{ width: 40 }} />
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[styles.filterTab, SHADOWS.neuSmall, filter === 'all' && [styles.filterTabActive, SHADOWS.neuInset]]}
          onPress={() => setFilter('all')}
        >
          <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>
            {language === 'ar' ? 'الكل' : 'All'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterTab, SHADOWS.neuSmall, filter === 'active' && [styles.filterTabActive, SHADOWS.neuInset]]}
          onPress={() => setFilter('active')}
        >
          <Text style={[styles.filterText, filter === 'active' && styles.filterTextActive]}>
            {language === 'ar' ? 'نشط' : 'Active'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterTab, SHADOWS.neuSmall, filter === 'completed' && [styles.filterTabActive, SHADOWS.neuInset]]}
          onPress={() => setFilter('completed')}
        >
          <Text style={[styles.filterText, filter === 'completed' && styles.filterTextActive]}>
            {language === 'ar' ? 'مكتمل' : 'Completed'}
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />
          }
        >
          {orders.length === 0 ? (
            <View style={styles.emptyContainer}>
              <MaterialIcons name="inbox" size={64} color={COLORS.textSecondary} />
              <Text style={styles.emptyText}>
                {language === 'ar' ? 'لا توجد طلبات' : 'No orders yet'}
              </Text>
              <Text style={styles.emptySubtext}>
                {language === 'ar' ? 'ابدأ بطلب خدمة صيانة' : 'Start by requesting a repair service'}
              </Text>
            </View>
          ) : (
            orders.map((order) => (
              <NeuCard key={order.id} style={styles.orderCard}>
                <View style={styles.orderHeader}>
                  <View>
                    <Text style={styles.orderService}>{order.services?.name || 'Service'}</Text>
                    <Text style={styles.orderDate}>{formatDate(order.created_at)}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[order.status] + '20' }]}>
                    <Text style={[styles.statusText, { color: STATUS_COLORS[order.status] }]}>
                      {STATUS_LABELS[order.status]?.[language] || order.status}
                    </Text>
                  </View>
                </View>

                <View style={styles.orderDetails}>
                  <View style={styles.detailRow}>
                    <MaterialIcons name="devices" size={20} color={COLORS.textSecondary} />
                    <Text style={styles.detailText}>
                      {order.device_brand} {order.device_model}
                    </Text>
                  </View>
                  
                  {order.issue_description && (
                    <View style={styles.detailRow}>
                      <MaterialIcons name="description" size={20} color={COLORS.textSecondary} />
                      <Text style={styles.detailText} numberOfLines={2}>
                        {order.issue_description}
                      </Text>
                    </View>
                  )}

                  {order.estimated_price && (
                    <View style={styles.detailRow}>
                      <MaterialIcons name="attach-money" size={20} color={COLORS.textSecondary} />
                      <Text style={styles.detailText}>
                        {order.estimated_price} {language === 'ar' ? 'ريال' : 'SAR'}
                      </Text>
                    </View>
                  )}
                </View>

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

                <View style={styles.actionButtons}>
                  <TouchableOpacity 
                    style={styles.chatButton}
                    onPress={() => router.push(`/chat/${order.id}`)}
                  >
                    <MaterialIcons name="chat" size={20} color={COLORS.primary} />
                    <Text style={styles.chatButtonText}>
                      {language === 'ar' ? 'محادثة' : 'Chat'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={styles.viewButton}
                    onPress={() => {
                      router.push(`/order-details?id=${order.id}`);
                    }}
                  >
                    <Text style={styles.viewButtonText}>
                      {language === 'ar' ? 'عرض التفاصيل' : 'View Details'}
                    </Text>
                    <MaterialIcons 
                      name={isRTL ? 'chevron-left' : 'chevron-right'} 
                      size={20} 
                      color={COLORS.primary} 
                    />
                  </TouchableOpacity>
                </View>
              </NeuCard>
            ))
          )}

          <View style={{ height: 100 }} />
        </ScrollView>
      )}

      <BottomNav currentRoute="/(customer)/orders" />
    </SafeAreaView>
  );
}

function createStyles(COLORS: any, SHADOWS: any, isRTL: boolean) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: COLORS.background,
    },
    header: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.md,
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: COLORS.background,
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerContent: {
      flex: 1,
      alignItems: 'center',
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: COLORS.text,
    },
    filterContainer: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      paddingHorizontal: SPACING.lg,
      marginBottom: SPACING.md,
      gap: SPACING.sm,
    },
    filterTab: {
      flex: 1,
      paddingVertical: SPACING.sm,
      borderRadius: BORDER_RADIUS.md,
      backgroundColor: COLORS.background,
      alignItems: 'center',
      justifyContent: 'center',
    },
    filterTabActive: {
      backgroundColor: COLORS.background,
    },
    filterText: {
      fontSize: 14,
      fontWeight: '600',
      color: COLORS.textSecondary,
    },
    filterTextActive: {
      color: COLORS.primary,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    scrollContent: {
      padding: SPACING.lg,
    },
    emptyContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: 100,
    },
    emptyText: {
      fontSize: 18,
      fontWeight: 'bold',
      color: COLORS.text,
      marginTop: SPACING.md,
    },
    emptySubtext: {
      fontSize: 14,
      color: COLORS.textSecondary,
      marginTop: SPACING.xs,
    },
    orderCard: {
      padding: SPACING.md,
      marginBottom: SPACING.md,
    },
    orderHeader: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: SPACING.md,
    },
    orderService: {
      fontSize: 16,
      fontWeight: 'bold',
      color: COLORS.text,
      textAlign: isRTL ? 'right' : 'left',
    },
    orderDate: {
      fontSize: 12,
      color: COLORS.textSecondary,
      marginTop: 2,
      textAlign: isRTL ? 'right' : 'left',
    },
    statusBadge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
    },
    statusText: {
      fontSize: 12,
      fontWeight: 'bold',
    },
    orderDetails: {
      gap: 8,
      marginBottom: SPACING.md,
    },
    detailRow: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 8,
    },
    detailText: {
      fontSize: 14,
      color: COLORS.textSecondary,
      flex: 1,
      textAlign: isRTL ? 'right' : 'left',
    },
    mediaPreview: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      marginBottom: SPACING.md,
    },
    mediaThumb: {
      width: 60,
      height: 60,
      borderRadius: 8,
      marginRight: isRTL ? 0 : 8,
      marginLeft: isRTL ? 8 : 0,
    },
    actionButtons: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      gap: 12,
      borderTopWidth: 1,
      borderTopColor: COLORS.border,
      paddingTop: SPACING.md,
    },
    chatButton: {
      flex: 1,
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: COLORS.primary + '10',
    },
    chatButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: COLORS.primary,
    },
    viewButton: {
      flex: 1,
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      paddingVertical: 8,
    },
    viewButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: COLORS.primary,
    },
  });
}
