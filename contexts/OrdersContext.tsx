import React, { createContext, useContext, useState, useEffect } from 'react';
import * as orderService from '../services/orderService';
import { useAuth } from './AuthContext';
import { logger } from '../utils/logger';

interface OrdersContextType {
  orders: orderService.Order[];
  loading: boolean;
  refreshOrders: () => Promise<void>;
  createOrder: (orderData: orderService.CreateOrderData) => Promise<orderService.Order>;
  updateOrderStatus: (orderId: string, status: orderService.Order['status']) => Promise<void>;
}

const OrdersContext = createContext<OrdersContextType | undefined>(undefined);

export function OrdersProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [orders, setOrders] = useState<orderService.Order[]>([]);
  const [loading, setLoading] = useState(false);

  const refreshOrders = async () => {
    if (!user) return;

    setLoading(true);
    try {
      // This context feeds CUSTOMER-surface screens (my-orders, request).
      // Multi-role: even an account that is also a technician sees their own
      // customer orders here — the technician area has its own loaders.
      const fetchedOrders = await orderService.getMyOrders(user.id);

      setOrders(fetchedOrders);
    } catch (error) {
      logger.error('Error refreshing orders', error);
    } finally {
      setLoading(false);
    }
  };

  const createOrder = async (orderData: orderService.CreateOrderData): Promise<orderService.Order> => {
    if (!user) throw new Error('User not authenticated');

    const newOrder = await orderService.createOrder(user.id, orderData);
    await refreshOrders();
    return newOrder;
  };

  const updateOrderStatus = async (orderId: string, status: orderService.Order['status']) => {
    await orderService.updateOrderStatus(orderId, status);
    await refreshOrders();
  };

  useEffect(() => {
    if (user) {
      refreshOrders();
    }
  }, [user]);

  return (
    <OrdersContext.Provider
      value={{
        orders,
        loading,
        refreshOrders,
        createOrder,
        updateOrderStatus,
      }}
    >
      {children}
    </OrdersContext.Provider>
  );
}

export function useOrders() {
  const context = useContext(OrdersContext);
  if (context === undefined) {
    throw new Error('useOrders must be used within an OrdersProvider');
  }
  return context;
}
