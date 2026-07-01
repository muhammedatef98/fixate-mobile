import { useEffect, useRef, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { supabase } from '../../lib/supabase';
import { useApp } from '../../contexts/AppContext';
import { isAdminUser } from '../../constants/admin';
import { logger } from '../../utils/logger';

/**
 * Deep-link auth callback landing screen.
 *
 * Supabase verifies the token in an auth link (email change, OAuth, magic
 * link, recovery) server-side and then redirects the browser to our hosted
 * landing page, which in turn opens `fixatee:///auth/callback#access_token=…
 * &refresh_token=…&type=…`. Before this screen existed, that deep link
 * resolved to no route and the user hit the "+not-found" page — the
 * "Go to app → page doesn't exist" bug.
 *
 * Responsibilities:
 *   1. Read the URL that opened the app (works for both cold-start, via
 *      Linking.getInitialURL, and warm-start, via the 'url' event — both
 *      surfaced by Linking.useURL()).
 *   2. If the URL carries access/refresh tokens in its fragment, promote
 *      them into a real session so the (already server-confirmed) change —
 *      e.g. the new email — is live immediately instead of waiting for the
 *      next ~hourly JWT auto-refresh.
 *   3. If there are no tokens (Supabase already consumed them, or the client
 *      already had a session), just refresh so we pull the latest claims.
 *   4. Route the user to the correct home for their role.
 */

interface AuthCallbackParams {
  access_token?: string;
  refresh_token?: string;
  type?: string;
}

/** Pull auth params from either the URL fragment (#…) or query (?…). */
function parseAuthParams(url: string): AuthCallbackParams {
  try {
    const parsed = new URL(url);
    const raw =
      (parsed.hash ? parsed.hash.replace(/^#/, '') : '') ||
      (parsed.search ? parsed.search.replace(/^\?/, '') : '');
    const params = new URLSearchParams(raw);
    return {
      access_token: params.get('access_token') ?? undefined,
      refresh_token: params.get('refresh_token') ?? undefined,
      type: params.get('type') ?? undefined,
    };
  } catch {
    return {};
  }
}

async function resolveHomeRoute(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return '/role-selection';
  if (isAdminUser(session.user)) return '/admin';
  try {
    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', session.user.id)
      .maybeSingle();
    return profile?.role === 'technician' ? '/(technician)' : '/(customer)';
  } catch {
    return '/(customer)';
  }
}

export default function AuthCallbackScreen() {
  const router = useRouter();
  const { language } = useApp();
  const isRTL = language === 'ar';
  const url = Linking.useURL();
  const handledRef = useRef(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // Guard against double-processing: useURL can emit the same URL more than
    // once (e.g. an initial value followed by a re-render), and we only want
    // to run the session handoff a single time.
    if (handledRef.current) return;

    // On cold start the URL may arrive on a later render than the first mount;
    // wait until we actually have one before deciding there's nothing to do.
    if (url === null) return;
    handledRef.current = true;

    (async () => {
      try {
        const { access_token, refresh_token } = parseAuthParams(url);
        if (access_token && refresh_token) {
          const { error } = await supabase.auth.setSession({ access_token, refresh_token });
          if (error) logger.warn('auth/callback setSession failed', error);
        } else {
          // No tokens in the link: the change is already applied server-side,
          // so just pull the freshest session/claims.
          await supabase.auth.refreshSession().catch(() => undefined);
        }
      } catch (e) {
        logger.warn('auth/callback handling threw', e);
      } finally {
        const target = await resolveHomeRoute();
        setDone(true);
        router.replace(target as never);
      }
    })();
  }, [url, router]);

  return (
    <View style={styles.container}>
      {!done && <ActivityIndicator size="large" color="#10b981" />}
      <Text style={styles.title}>
        {isRTL ? '✅ تم تأكيد الإيميل' : '✅ Email confirmed'}
      </Text>
      <Text style={styles.subtitle}>
        {isRTL ? 'جارٍ فتح التطبيق…' : 'Opening the app…'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#ffffff',
    gap: 12,
  },
  title: { fontSize: 20, fontWeight: '700', color: '#111827', textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#6b7280', textAlign: 'center' },
});
