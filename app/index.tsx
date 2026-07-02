import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import { getColors } from '../constants/theme';
import { getLastRole, type AppRole } from '../utils/rolePreference';
import { hasSeenOnboarding } from '../utils/onboardingPreference';
import { ONBOARDING_ENABLED } from '../constants/featureFlags';

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
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  // Returning, logged-in user with a remembered flow → go straight in.
  if (user && lastRole) {
    return <Redirect href={lastRole === 'technician' ? '/(technician)' : '/(customer)'} />;
  }

  // Fresh, logged-out install that has never seen the intro → onboarding.
  // Gated behind ONBOARDING_ENABLED so it can be disabled via OTA without a
  // code change. (Signed-in users skip it entirely; the _layout auth guard also
  // bounces a logged-in user off /onboarding, so this stays logged-out-only.)
  if (ONBOARDING_ENABLED && !user && !seenOnboarding) {
    return <Redirect href="/onboarding" />;
  }

  // Logged out (intro already seen), or no remembered flow yet → let them choose.
  return <Redirect href="/role-selection" />;
}
