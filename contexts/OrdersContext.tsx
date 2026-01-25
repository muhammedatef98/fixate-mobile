import React, { createContext, useContext, useState, useEffect } from 'react';
import * as orderService from '../services/orderService';
import { useAuth } from './AuthContext';

interface OrdersContextType {
  orders: orderService.Order[];
  loading: boolean;
  refreshOrders: () => Promise<void>;
  createOrder: (orderData: orderService.CreateOrderData) => Promise<orderService.Order>;
  updateOrderStatus: (orderId: string, status: orderService.Order['status']) => Promise<void>;
}

const OrdersContext = createContext<OrdersContextType | undefined>(undefined);

export function OrdersProvider({ children }: { children: React.ReactNode }) {
  const { user, userProfile } = useAuth();
  const [orders, setOrders] = useState<orderService.Order[]>([]);
  const [loading, setLoading] = useState(false);

  const refreshOrders = async () => {
    if (!user) return;

    setLoading(true);
    try {
      let fetchedOrders: orderService.Order[] = [];

      if (userProfile?.role === 'technician') {
        // Get technician orders
        fetchedOrders = await orderService.getTechnicianOrders(user.id);
      } else {
        // Get customer orders
        fetchedOrders = await orderService.getMyOrders(user.id);
      }

      setOrders(fetchedOrders);
    } catch (error) {
      console.error('Error refreshing orders:', error);
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
  }, [user, userProfile?.role]);

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
