import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';
import { logger } from '../utils/logger';

/**
 * Sign in with Apple — iOS only. Mirrors the crash-safe lazy pattern of
 * googleAuthService: `expo-apple-authentication` is a native module, so in
 * any binary compiled without it the require throws and we simply keep the
 * button hidden instead of crashing at startup.
 */

type AppleAuthModule = typeof import('expo-apple-authentication');

let AppleAuth: AppleAuthModule | null = null;

if (Platform.OS === 'ios') {
  try {
    AppleAuth = require('expo-apple-authentication') as AppleAuthModule;
  } catch (err) {
    logger.warn(
      'expo-apple-authentication native module is not in this binary — ' +
        'Apple sign-in is disabled. Rebuild the app to enable it.',
      err,
    );
  }
}

/** True only on iOS builds that include the native module. */
export function isAppleSignInAvailable(): boolean {
  return Platform.OS === 'ios' && AppleAuth != null;
}

/**
 * Opens the native Apple sign-in sheet, then signs into Supabase with the
 * returned identity token. Returns silently on user cancellation.
 *
 * Apple only provides the user's name on the FIRST authorization ever, so
 * when present we persist it to auth metadata + public.users immediately —
 * it will never be offered again.
 */
export async function signInWithApple(): Promise<void> {
  if (!AppleAuth) {
    throw new Error('Apple Sign-In is not available in this build. Please update the app.');
  }
  try {
    const credential = await AppleAuth.signInAsync({
      requestedScopes: [
        AppleAuth.AppleAuthenticationScope.FULL_NAME,
        AppleAuth.AppleAuthenticationScope.EMAIL,
      ],
    });

    if (!credential.identityToken) {
      throw new Error('Apple Sign-In: no identity token returned');
    }

    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: credential.identityToken,
    });
    if (error) throw error;

    const fullName = [credential.fullName?.givenName, credential.fullName?.familyName]
      .filter(Boolean)
      .join(' ')
      .trim();
    if (fullName && data.user) {
      // Best-effort: never fail the sign-in over profile naming.
      try {
        await supabase.auth.updateUser({ data: { name: fullName, full_name: fullName } });
        const { data: row } = await supabase
          .from('users')
          .select('name')
          .eq('id', data.user.id)
          .maybeSingle();
        if (!row?.name?.trim()) {
          await supabase.from('users').update({ name: fullName }).eq('id', data.user.id);
        }
      } catch (nameErr) {
        logger.warn('signInWithApple: could not persist first-auth name', nameErr);
      }
    }

    logger.info('signInWithApple: success');
  } catch (err: any) {
    if (err?.code === 'ERR_REQUEST_CANCELED') {
      logger.info('Apple Sign-In: cancelled by user');
      return;
    }
    logger.error('signInWithApple error', err);
    throw err;
  }
}
