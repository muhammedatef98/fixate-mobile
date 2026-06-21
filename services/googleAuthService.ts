import { supabase } from '../lib/supabase';
import { logger } from '../utils/logger';

/**
 * Google Sign-In is a NATIVE module (`RNGoogleSignin`). It only exists in a
 * binary that was compiled WITH `@react-native-google-signin/google-signin`
 * (a custom dev client or an EAS/store build). In Expo Go, or in any older
 * binary built before the package was added, the native module is absent and
 * importing the JS library throws at load time:
 *
 *   TurboModuleRegistry.getEnforcing('RNGoogleSignin'): could not be found.
 *
 * That used to crash the whole app at startup. We therefore load the library
 * lazily behind a try/catch and guard every call, so the app always launches —
 * Google login simply stays disabled until a build that includes the native
 * module is installed, at which point it activates automatically.
 */

type GoogleSignInModule = typeof import('@react-native-google-signin/google-signin');

let GoogleSignin: GoogleSignInModule['GoogleSignin'] | null = null;
let statusCodes: Partial<GoogleSignInModule['statusCodes']> = {};
let nativeAvailable = false;

try {
  // Requiring the module triggers the native-module lookup; if the native
  // binary doesn't register `RNGoogleSignin`, this throws and we degrade.
  const mod = require('@react-native-google-signin/google-signin') as GoogleSignInModule;
  if (mod?.GoogleSignin) {
    GoogleSignin = mod.GoogleSignin;
    statusCodes = mod.statusCodes ?? {};
    nativeAvailable = true;
  }
} catch (err) {
  logger.warn(
    'Google Sign-In native module (RNGoogleSignin) is not in this binary — ' +
      'Google login is disabled. Rebuild the dev client / app to enable it.',
    err,
  );
}

/** True only when the native module is present in the running binary. */
export function isGoogleSignInAvailable(): boolean {
  return nativeAvailable;
}

/**
 * Call once at app startup (in _layout.tsx) before any Google sign-in attempt.
 * No-op when the native module isn't available, so it never crashes launch.
 * webClientId comes from Google Cloud Console → OAuth Credentials → Web client.
 * It must also match Supabase Dashboard → Auth → Providers → Google.
 */
export function configureGoogleSignIn() {
  if (!nativeAvailable || !GoogleSignin) return;
  try {
    GoogleSignin.configure({
      webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '',
    });
  } catch (err) {
    logger.warn('configureGoogleSignIn failed (non-fatal)', err);
  }
}

/**
 * Opens the native Google account picker, obtains an idToken,
 * then signs the user into Supabase via signInWithIdToken.
 *
 * Throws on unexpected errors; returns silently on user cancellation.
 * Throws a friendly error when the native module isn't available.
 */
export async function signInWithGoogle(): Promise<void> {
  if (!nativeAvailable || !GoogleSignin) {
    throw new Error(
      'Google Sign-In is not available in this build. Please update the app.',
    );
  }
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

    const userInfo = await GoogleSignin.signIn();
    const idToken = userInfo.data?.idToken;

    if (!idToken) {
      throw new Error('Google Sign-In: idToken is null — ensure webClientId is correct');
    }

    const { error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: idToken,
    });

    if (error) throw error;

    logger.info('signInWithGoogle: success');
  } catch (err: any) {
    if (err.code === statusCodes.SIGN_IN_CANCELLED) {
      logger.info('Google Sign-In: cancelled by user');
      return;
    }
    if (err.code === statusCodes.IN_PROGRESS) {
      logger.warn('Google Sign-In: already in progress');
      return;
    }
    logger.error('signInWithGoogle error', err);
    throw err;
  }
}

/**
 * Revokes Google access token and signs out the Google account.
 * Call this alongside supabase.auth.signOut(). No-op when unavailable.
 */
export async function signOutGoogle(): Promise<void> {
  if (!nativeAvailable || !GoogleSignin) return;
  try {
    await GoogleSignin.revokeAccess();
    await GoogleSignin.signOut();
  } catch (err) {
    logger.warn('signOutGoogle: error (non-fatal)', err);
  }
}
