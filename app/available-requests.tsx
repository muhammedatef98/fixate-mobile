import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import { requests as requestsApi, auth } from '../lib/supabase-api';
import { router } from 'expo-router';
import { logger } from '../utils/logger';

interface Request {
  id: string;
  device_type: string;
  brand: string;
  model: string;
  issue: string;
  service_type: string;
  location: string;
  estimated_price: number;
  status: string;
  created_at: string;
  customer: {
    name: string;
    phone: string;
  };
}

export default function AvailableRequestsScreen() {
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchAvailableRequests();
    
    // Polling for new requests (replace with WebSocket if needed)
    const interval = setInterval(fetchAvailableRequests, 30000); // Every 30 seconds

    return () => {
      clearInterval(interval);
    };
  }, []);

  const fetchAvailableRequests = async () => {
    try {
      const data = await requestsApi.getAvailableOrders();
      setRequests((data || []) as any);
    } catch (error) {
      logger.error('Error fetching requests:', error);
      Alert.alert('خطأ', 'فشل في تحميل الطلبات');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const acceptRequest = async (requestId: string) => {
    try {
      const user = await auth.getCurrentUser();
      if (!user) {
        Alert.alert('خطأ', 'يجب تسجيل الدخول أولاً');
        return;
      }

      await requestsApi.acceptOrder(requestId);

      Alert.alert('نجح!', 'تم قبول الطلب بنجاح');
      fetchAvailableRequests();
      router.push('/technician-dashboard');
    } catch (error: any) {
      logger.error('Error accepting request:', error);
      if (error.code === '23505') {
        Alert.alert('عذراً', 'تم قبول هذا الطلب من قبل فني آخر');
      } else {
        Alert.alert('خطأ', 'فشل في قبول الطلب');
      }
      fetchAvailableRequests();
    }
  };

  const renderRequest = ({ item }: { item: Request }) => (
    <View style={styles.requestCard}>
      <View style={styles.requestHeader}>
        <Text style={styles.deviceText}>
          {item.brand} {item.model}
        </Text>
        <View style={[
          styles.serviceTypeBadge,
          item.service_type === 'mobile' ? styles.mobileBadge : styles.pickupBadge
        ]}>
          <Text style={styles.serviceTypeText}>
            {item.service_type === 'mobile' ? '🔧 فني متنقل' : '🚚 استلام وتوصيل'}
          </Text>
        </View>
      </View>

      <View style={styles.requestDetails}>
        <Text style={styles.issueText}>المشكلة: {item.issue}</Text>
        <Text style={styles.locationText}>📍 {item.location}</Text>
        <Text style={styles.priceText}>السعر المتوقع: {item.estimated_price} ريال</Text>
        <Text style={styles.timeText}>
          ⏰ {new Date(item.created_at).toLocaleString('ar')}
        </Text>
      </View>

      <TouchableOpacity
        style={styles.acceptButton}
        onPress={() => acceptRequest(item.id)}
      >
        <Text style={styles.acceptButtonText}>قبول الطلب</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>الطلبات المتاحة</Text>
        <Text style={styles.headerSubtitle}>
          {requests.length} طلب متاح
        </Text>
      </View>

      <FlatList
        data={requests}
        renderItem={renderRequest}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchAvailableRequests();
            }}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {loading ? 'جاري التحميل...' : 'لا توجد طلبات متاحة حالياً'}
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#10B981',
    padding: 20,
    paddingTop: 60,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#fff',
    textAlign: 'center',
    marginTop: 5,
  },
  listContainer: {
    padding: 15,
  },
  requestCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  deviceText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  serviceTypeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
  },
  mobileBadge: {
    backgroundColor: '#E3F2FD',
  },
  pickupBadge: {
    backgroundColor: '#FFF3E0',
  },
  serviceTypeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  requestDetails: {
    marginBottom: 15,
  },
  issueText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  locationText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  priceText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#5DBEAA',
    marginBottom: 5,
  },
  timeText: {
    fontSize: 12,
    color: '#999',
  },
  acceptButton: {
    backgroundColor: '#5DBEAA',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  acceptButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
  },
});
