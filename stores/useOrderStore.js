import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useOrderStore = create(
  persist(
    (set, get) => ({
      orders: [],
      currentOrder: null,
      loading: false,

      setLoading: (loading) => set({ loading }),

      addOrder: (order) =>
        set((state) => ({ orders: [...state.orders, order] })),

      updateOrder: (id, updates) =>
        set((state) => ({
          orders: state.orders.map((order) =>
            order.id === id ? { ...order, ...updates } : order
          ),
        })),

      removeOrder: (id) =>
        set((state) => ({
          orders: state.orders.filter((order) => order.id !== id),
        })),

      setCurrentOrder: (order) => set({ currentOrder: order }),

      clearOrders: () => set({ orders: [], currentOrder: null }),
    }),
    { name: 'order-storage' }
  )
);
