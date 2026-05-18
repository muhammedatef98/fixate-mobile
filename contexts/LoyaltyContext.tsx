import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import * as loyaltyService from '../services/loyaltyService';
import type { LoyaltySummary } from '../services/loyaltyService';
import { logger } from '../utils/logger';

interface LoyaltyContextType {
  summary: LoyaltySummary;
  loading: boolean;
  refresh: () => Promise<void>;
}

const EMPTY: LoyaltySummary = {
  balance: 0,
  lifetimeEarned: 0,
  isPlaceholder: true,
  transactions: [],
};

const LoyaltyContext = createContext<LoyaltyContextType | undefined>(undefined);

export function LoyaltyProvider({ children }: { children: React.ReactNode }) {
  const { user, userProfile } = useAuth();
  const [summary, setSummary] = useState<LoyaltySummary>(EMPTY);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    // Loyalty is a customer-only concept; skip for technicians.
    if (!user || (userProfile as any)?.role === 'technician') {
      setSummary(EMPTY);
      return;
    }
    setLoading(true);
    try {
      const s = await loyaltyService.getLoyaltySummary(user.id);
      setSummary(s);
    } catch (e) {
      logger.warn('loyalty refresh failed', e);
      setSummary(EMPTY);
    } finally {
      setLoading(false);
    }
  }, [user, userProfile]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <LoyaltyContext.Provider value={{ summary, loading, refresh }}>
      {children}
    </LoyaltyContext.Provider>
  );
}

export function useLoyalty() {
  const ctx = useContext(LoyaltyContext);
  if (!ctx) throw new Error('useLoyalty must be used within a LoyaltyProvider');
  return ctx;
}
