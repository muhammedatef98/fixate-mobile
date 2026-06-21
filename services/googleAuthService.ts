import {
  GoogleSignin,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import { supabase } from '../lib/supabase';
import { logger } from '../utils/logger';

/**
 * Call once at app startup (in _layout.tsx) before any Google sign-in attempt.
 * webClientId comes from Google Cloud Console → OAuth Credentials → Web client.
 * It must also match what's configured in Supabase Dashboard → Auth → Providers → Google.
 */
export function configureGoogleSignIn() {
  GoogleSignin.configure({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '',
  });
}

/**
 * Opens the native Google account picker, obtains an idToken,
 * then signs the user into Supabase via signInWithIdToken.
 *
 * Throws on unexpected errors; returns silently on user cancellation.
 */
export async function signInWithGoogle(): Promise<void> {
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
 * Call this alongside supabase.auth.signOut().
 */
export async function signOutGoogle(): Promise<void> {
  try {
    await GoogleSignin.revokeAccess();
    await GoogleSignin.signOut();
  } catch (err) {
    logger.warn('signOutGoogle: error (non-fatal)', err);
  }
}
