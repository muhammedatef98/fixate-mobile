import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { supabase } from '../services/supabaseClient';
import { logger } from '../utils/logger';
import type { OrderStatus } from '../types/order';

export interface Request {
  id: string;
  brand: string;
  deviceType: string;
  model: string;
  issue: string;
  description: string;
  location: string;
  status: OrderStatus;
  timestamp: Date;
  price: string;
  user_id: string;
  customerName?: string;
}

interface RequestContextType {
  requests: Request[];
  loading: boolean;
  refresh: () => Promise<void>;
  updateRequestStatus: (id: string, status: OrderStatus) => Promise<void>;
}

const RequestContext = createContext<RequestContextType | undefined>(undefined);

const mapOrderToRequest = (order: any, customerName?: string): Request => ({
  id: order.id,
  brand: order.device_brand ?? '',
  deviceType: order.service_type ?? '',
  model: order.device_model ?? '',
  issue: order.issue_description ?? '',
  description: order.issue_description ?? '',
  location: order.address ?? order.location ?? '',
  status: order.status as OrderStatus,
  timestamp: order.created_at ? new Date(order.created_at) : new Date(),
  price: order.estimated_price?.toString() ?? '',
  user_id: order.user_id,
  customerName,
});

export function RequestProvider({ children }: { children: ReactNode }) {
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('orders')
        .select('*, users:user_id (name)')
        .eq('status', 'pending')
        .is('technician_id', null)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setRequests(
        (data ?? []).map((o: any) => mapOrderToRequest(o, o.users?.name))
      );
    } catch (error) {
      // Network blips on cold-start are expected on mobile. Log at warn so
      // the dev-overlay doesn't show a red box for a recoverable failure.
      logger.warn('RequestContext refresh failed', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const channel = supabase
      .channel('requests-orders-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => {
          refresh();
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [refresh]);

  const updateRequestStatus = async (id: string, status: OrderStatus) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status })
        .eq('id', id);
      if (error) throw error;
      setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
    } catch (error) {
      logger.error('RequestContext updateRequestStatus error', error);
      throw error;
    }
  };

  return (
    <RequestContext.Provider value={{ requests, loading, refresh, updateRequestStatus }}>
      {children}
    </RequestContext.Provider>
  );
}

export function useRequests() {
  const context = useContext(RequestContext);
  if (context === undefined) {
    throw new Error('useRequests must be used within a RequestProvider');
  }
  return context;
}
