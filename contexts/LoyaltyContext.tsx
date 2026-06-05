import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import * as loyaltyService from '../services/loyaltyService';
import type { LoyaltySummary } from '../services/loyaltyService';
import { getLoyaltySettings, type LoyaltySettings } from '../services/platformSettingsService';
import { logger } from '../utils/logger';

interface LoyaltyContextType {
  summary: LoyaltySummary;
  settings: LoyaltySettings | null;
  loading: boolean;
  refresh: () => Promise<void>;
  /** True only when the platform feature flag is explicitly enabled.
   *  Defaults to `false` while settings load to avoid flashing loyalty
   *  UI on an admin who has the flag turned off. */
  enabled: boolean;
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
  const [settings, setSettings] = useState<LoyaltySettings | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    // Load settings first so we know whether to bother fetching the ledger.
    let cfg: LoyaltySettings | null = null;
    try {
      cfg = await getLoyaltySettings();
      setSettings(cfg);
    } catch (e) {
      logger.warn('loyalty settings unavailable', e);
    }

    // Loyalty is a customer-only concept; skip for technicians.
    if (!user || (userProfile as any)?.role === 'technician') {
      setSummary(EMPTY);
      return;
    }
    if (cfg && cfg.enabled === false) {
      // Loyalty disabled by admin: empty out the summary so all UI hides.
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

  // `enabled` is the single source of truth for every loyalty-related
  // surface in the app. UI checks this — not the summary — because the
  // summary can be empty for a brand-new user who is *eligible* for
  // loyalty. A null settings object means "still loading" and we treat
  // that as disabled to avoid a flash of loyalty UI before the gate.
  const enabled = settings?.enabled === true;

  return (
    <LoyaltyContext.Provider value={{ summary, settings, loading, refresh, enabled }}>
      {children}
    </LoyaltyContext.Provider>
  );
}

export function useLoyalty() {
  const ctx = useContext(LoyaltyContext);
  if (!ctx) throw new Error('useLoyalty must be used within a LoyaltyProvider');
  return ctx;
}
