import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import { getColors } from '../constants/theme';
import { getLastRole, type AppRole } from '../utils/rolePreference';

/**
 * Cold-launch entry point. Decides the first screen:
 *   - Logged in with a remembered flow  → jump straight into it (customer or
 *     technician), skipping role-selection.
 *   - Otherwise                         → role-selection.
 *
 * We hold on a neutral loader until BOTH the auth session and the saved-role
 * read have settled, so role-selection never flashes before the redirect on
 * a returning user's cold launch.
 */
export default function EntryPoint() {
  const { user, loading } = useAuth();
  const { isDark } = useApp();
  const COLORS = getColors(isDark);

  const [roleResolved, setRoleResolved] = useState(false);
  const [lastRole, setLastRole] = useState<AppRole | null>(null);

  useEffect(() => {
    let cancelled = false;
    getLastRole().then((role) => {
      if (cancelled) return;
      setLastRole(role);
      setRoleResolved(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Wait for the session and the persisted role before deciding — avoids a
  // role-selection flash on returning users.
  if (loading || !roleResolved) {
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

  // Logged out, or no remembered flow yet → let them choose.
  return <Redirect href="/role-selection" />;
}
