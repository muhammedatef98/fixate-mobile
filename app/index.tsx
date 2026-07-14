import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import { getColors } from '../constants/theme';
import GearLoader from '../components/GearLoader';
import { getLastRole, type AppRole } from '../utils/rolePreference';
import { hasSeenOnboarding } from '../utils/onboardingPreference';
import { ONBOARDING_ENABLED } from '../constants/featureFlags';
import { decideColdLaunch } from '../utils/routeDecision';

/**
 * Cold-launch entry point. Decides the first screen:
 *   - Logged in with a remembered flow  → jump straight into it (customer or
 *     technician), skipping role-selection.
 *   - Fresh install, logged out, has not seen onboarding → onboarding intro.
 *   - Otherwise                         → role-selection.
 *
 * We hold on a neutral loader until the auth session, the saved-role read, AND
 * the onboarding-seen read have ALL settled, so nothing (role-selection or a
 * mis-routed portal) ever flashes before the correct redirect. Onboarding is
 * gated to logged-out users only — a signed-in user never sees it.
 */
export default function EntryPoint() {
  const { user, loading } = useAuth();
  const { isDark } = useApp();
  const COLORS = getColors(isDark);

  const [roleResolved, setRoleResolved] = useState(false);
  const [lastRole, setLastRole] = useState<AppRole | null>(null);
  const [onboardingResolved, setOnboardingResolved] = useState(false);
  const [seenOnboarding, setSeenOnboarding] = useState(true);

  useEffect(() => {
    let cancelled = false;
    // Read both persisted prefs in parallel; each flips its own "resolved"
    // gate so the loader below only lifts once every decision input is known.
    getLastRole().then((role) => {
      if (cancelled) return;
      setLastRole(role);
      setRoleResolved(true);
    });
    hasSeenOnboarding().then((seen) => {
      if (cancelled) return;
      setSeenOnboarding(seen);
      setOnboardingResolved(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Wait for the session, the persisted role, and the onboarding flag before
  // deciding — avoids a role-selection or onboarding flash on returning users.
  if (loading || !roleResolved || !onboardingResolved) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background }}>
        <GearLoader size={56} />
      </View>
    );
  }

  // Single source of truth for the cold-launch decision (see
  // utils/routeDecision.ts + routeDecision.test):
  //   1. Logged in with a remembered flow → straight into that portal.
  //   2. Fresh, logged-out, onboarding enabled & unseen → onboarding intro.
  //      (Signed-in users never see it; the _layout auth guard also bounces a
  //      logged-in user off /onboarding, so it stays logged-out-only.)
  //   3. Otherwise → role-selection.
  const target = decideColdLaunch({
    isLoggedIn: !!user,
    lastRole,
    seenOnboarding,
    onboardingEnabled: ONBOARDING_ENABLED,
  });
  return <Redirect href={target} />;
}
