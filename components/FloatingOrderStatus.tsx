import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS, SPACING, BORDER_RADIUS, SHADOWS } from '../constants/theme';
import { useApp } from '../contexts/AppContext';
import { requests } from '../lib/supabase-api';
import { logger } from '../utils/logger';
import { RTLMaterialIcon } from './RTLIcon';

export default function FloatingOrderStatus() {
  const router = useRouter();
  const pathname = usePathname();
  const { language } = useApp();
  const isRTL = language === 'ar';
  const [activeOrder, setActiveOrder] = useState<any>(null);
  const [visible, setVisible] = useState(false);
  
  // Animation
  const slideAnim = new Animated.Value(100);

  useEffect(() => {
    checkActiveOrder();
    
    // Subscribe to real-time updates for orders
    const subscription = requests.subscribeToOrders(() => {
      checkActiveOrder();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    // Hide on specific screens (like the order details screen itself)
    if (pathname.includes('/orders') || pathname.includes('/chat')) {
      hide();
    } else if (activeOrder) {
      show();
    }
  }, [pathname, activeOrder]);

  const checkActiveOrder = async () => {
    try {
      const allRequests = await requests.getAll();
      const active = allRequests.find(r =>
        ['pending', 'accepted', 'picking_up', 'diagnosing', 'waiting_parts', 'repairing', 'testing', 'delivering'].includes(r.status)
      );
      
      if (active) {
        setActiveOrder(active);
        if (!pathname.includes('/orders') && !pathname.includes('/chat')) {
          show();
        }
      } else {
        setActiveOrder(null);
        hide();
      }
    } catch (error) {
      logger.debug('Error checking active order:', error);
    }
  };

  const show = () => {
    setVisible(true);
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
      easing: Easing.out(Easing.ease),
    }).start();
  };

  const hide = () => {
    Animated.timing(slideAnim, {
      toValue: 100,
      duration: 300,
      useNativeDriver: true,
      easing: Easing.in(Easing.ease),
    }).start(() => setVisible(false));
  };

  if (!activeOrder || !visible) return null;

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return isRTL ? 'جاري البحث عن فني...' : 'Finding technician...';
      case 'accepted': return isRTL ? 'تم القبول' : 'Accepted';
      case 'picking_up': return isRTL ? 'الفني في الطريق إليك' : 'Technician is on the way';
      case 'diagnosing': return isRTL ? 'جاري فحص الجهاز' : 'Diagnosing';
      case 'waiting_parts': return isRTL ? 'انتظار قطع غيار' : 'Waiting for parts';
      case 'repairing': return isRTL ? 'جاري الإصلاح' : 'Repair in progress';
      case 'testing': return isRTL ? 'اختبار الجودة' : 'Quality testing';
      case 'delivering': return isRTL ? 'جاري التسليم' : 'Delivering';
      default: return isRTL ? 'طلب نشط' : 'Active Order';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return COLORS.warning;
      case 'accepted':
      case 'picking_up': return COLORS.primary;
      case 'waiting_parts': return COLORS.warning;
      case 'diagnosing':
      case 'repairing':
      case 'testing':
      case 'delivering': return COLORS.info;
      default: return COLORS.textSecondary;
    }
  };

  return (
    <Animated.View 
      style={[
        styles.container, 
        { transform: [{ translateY: slideAnim }] },
        SHADOWS.medium
      ]}
    >
      <TouchableOpacity 
        style={styles.content}
        onPress={() => router.push(`/(customer)/orders`)}
      >
        <View style={[styles.iconContainer, { backgroundColor: getStatusColor(activeOrder.status) + '20' }]}>
          <MaterialIcons 
            name="delivery-dining" 
            size={24} 
            color={getStatusColor(activeOrder.status)} 
          />
        </View>
        
        <View style={styles.textContainer}>
          <Text style={styles.title}>
            {isRTL ? 'طلب جاري' : 'Active Order'} #{activeOrder.id.slice(0, 4)}
          </Text>
          <Text style={styles.subtitle}>
            {getStatusText(activeOrder.status)}
          </Text>
        </View>

        <RTLMaterialIcon name="chevron-right" 
          size={24} 
          color={COLORS.textSecondary} 
        />
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 90, // Above bottom nav
    left: SPACING.lg,
    right: SPACING.lg,
    backgroundColor: '#FFFFFF',
    borderRadius: BORDER_RADIUS.lg,
    zIndex: 1000,
    elevation: 5,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  subtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
});
