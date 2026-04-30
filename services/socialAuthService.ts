import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { supabase } from './supabaseClient';
import { logger } from '../utils/logger';

export type SocialProvider = 'google' | 'facebook' | 'apple' | 'twitter';

const REDIRECT_URL = Linking.createURL('/auth/callback');

/**
 * Sign in with a social OAuth provider via Supabase.
 * Opens an in-app browser to the provider's auth page; on success Supabase
 * sends back to REDIRECT_URL which the app handles via deep linking.
 *
 * Provider must be enabled and configured in:
 *   Supabase Dashboard → Authentication → Providers
 */
export const signInWithSocial = async (provider: SocialProvider): Promise<void> => {
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: REDIRECT_URL,
        skipBrowserRedirect: true,
      },
    });
    if (error) throw error;
    if (!data?.url) throw new Error('No auth URL returned');

    const result = await WebBrowser.openAuthSessionAsync(data.url, REDIRECT_URL);
    if (result.type !== 'success' || !result.url) {
      throw new Error('Authentication cancelled');
    }

    const url = new URL(result.url);
    const params = new URLSearchParams(url.hash.replace(/^#/, '') || url.search.replace(/^\?/, ''));
    const access_token = params.get('access_token');
    const refresh_token = params.get('refresh_token');
    if (!access_token || !refresh_token) {
      throw new Error('Missing tokens in OAuth callback');
    }
    const { error: setErr } = await supabase.auth.setSession({ access_token, refresh_token });
    if (setErr) throw setErr;
  } catch (err: any) {
    logger.error(`signInWithSocial(${provider}) error`, err);
    throw err;
  }
};
