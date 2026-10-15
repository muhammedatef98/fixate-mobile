import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { supabase } from './supabaseClient';
import { logger } from '../utils/logger';

/**
 * Client for the `ai-assistant` Edge Function (AI repair assistant).
 *
 * The model key lives only on the server; the app sends the conversation and
 * optional damage photos, and gets back a plain-text reply.
 */

export type AssistantImage = { mimeType: 'image/jpeg'; data: string };

export type AssistantTurn = {
  role: 'user' | 'assistant';
  text?: string;
  images?: AssistantImage[];
};

export type AssistantResult =
  | { ok: true; reply: string; remaining?: number }
  | { ok: true; blocked: true }
  | {
      ok: false;
      reason: 'daily_limit' | 'not_configured' | 'unauthorized' | 'busy' | 'network' | 'error';
      limit?: number;
    };

/**
 * Shrinks a picked photo before upload: 1280px on the long edge and JPEG 0.7
 * keeps damage (cracks, lines, swelling) clearly visible while cutting a
 * multi-MB camera shot down to a few hundred KB.
 */
export async function prepareAssistantImage(uri: string, width?: number, height?: number): Promise<AssistantImage> {
  const resize = width && height && height > width ? { height: 1280 } : { width: 1280 };
  const result = await manipulateAsync(uri, [{ resize }], {
    compress: 0.7,
    format: SaveFormat.JPEG,
    base64: true,
  });
  if (!result.base64) throw new Error('Image encoding failed');
  return { mimeType: 'image/jpeg', data: result.base64 };
}

export async function askAssistant(turns: AssistantTurn[], language: 'ar' | 'en'): Promise<AssistantResult> {
  try {
    const { data, error } = await supabase.functions.invoke<{
      reply?: string | null;
      blocked?: boolean;
      remaining?: number;
    }>('ai-assistant', { body: { messages: turns, language } });

    if (error) {
      // Non-2xx: the function returns { error: <code> } — read it from the response.
      let code: string | undefined;
      let limit: number | undefined;
      const ctx = (error as any)?.context;
      if (ctx && typeof ctx.json === 'function') {
        try {
          const payload = await ctx.json();
          code = payload?.error;
          limit = payload?.limit;
        } catch {
          // body wasn't JSON
        }
      }
      if (code === 'daily_limit') return { ok: false, reason: 'daily_limit', limit };
      if (code === 'not_configured') return { ok: false, reason: 'not_configured' };
      if (code === 'unauthorized') return { ok: false, reason: 'unauthorized' };
      if (code === 'model_busy') return { ok: false, reason: 'busy' };
      if (!ctx) return { ok: false, reason: 'network' };
      logger.warn('ai-assistant error', code ?? (error as any)?.message);
      return { ok: false, reason: 'error' };
    }

    if (data?.blocked) return { ok: true, blocked: true };
    if (data?.reply) return { ok: true, reply: data.reply, remaining: data.remaining };
    return { ok: false, reason: 'error' };
  } catch (e) {
    logger.warn('ai-assistant request failed', e);
    return { ok: false, reason: 'network' };
  }
}
