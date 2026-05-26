import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../services/supabaseClient';

/**
 * Why this exists
 * ===============
 *
 * In `@supabase/realtime-js`, `RealtimeClient.channel(topic)` returns the
 * EXISTING channel object when one with the same `realtime:${topic}` is
 * still registered in the client:
 *
 *     channel(topic, ...) {
 *       const exists = this.getChannels().find(c => c.topic === ...);
 *       if (!exists) { ...push new... } else { return exists; }
 *     }
 *
 * And `removeChannel(ch)` is **async** — it awaits the server's LEAVE
 * ACK before tearing down. The React `useEffect` cleanup function is
 * synchronous and cannot wait for that ACK.
 *
 * Sequence that produces
 *   "cannot add 'postgres_changes' callbacks for realtime:X after subscribe()":
 *
 *  1. Component mounts → `.channel(name).on(...).subscribe()` — state = joined.
 *  2. Component unmounts → cleanup fires `removeChannel(ch)` — the LEAVE
 *     request is dispatched but the channel sits in the registry, still
 *     in `joined` state, pending the server ACK.
 *  3. Component re-mounts (Strict Mode, navigation, Fast Refresh,
 *     parent re-render) WITHIN that window → `.channel(name)` returns
 *     the already-joined leftover → `.on(...)` throws.
 *
 * Fix: give every call a UNIQUE topic. Same-name collisions become
 * impossible, so the registry can asynchronously tear down the old
 * channel at its own pace while the new one is registered cleanly.
 *
 * The base topic stays in the unique name so server-side debugging is
 * still legible — only a short id suffix is appended.
 */

let _counter = 0;
const nextSuffix = () => {
  _counter = (_counter + 1) % 1_000_000;
  return `${Date.now().toString(36)}-${_counter.toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 6)}`;
};

export interface SubscribeUniqueOptions {
  onStatus?: (status: string, err?: Error) => void;
}

/**
 * Subscribe to a realtime channel that is guaranteed to be a fresh
 * instance, with proper async cleanup.
 *
 * `setup` runs while the channel is in `closed` state, so it's safe
 * to call `.on(...)` inside it. The function MUST return the channel
 * (realtime-js's fluent API does this for you: `ch.on(...).on(...)`).
 *
 * @returns A synchronous cleanup callable suitable for a useEffect
 *          cleanup return.
 */
export function subscribeUnique(
  baseTopic: string,
  setup: (ch: RealtimeChannel) => RealtimeChannel,
  opts: SubscribeUniqueOptions = {}
): () => void {
  const uniqueTopic = `${baseTopic}-${nextSuffix()}`;
  let channel: RealtimeChannel | null = supabase.channel(uniqueTopic);

  channel = setup(channel).subscribe((status: string, err?: Error) => {
    opts.onStatus?.(status, err);
  });

  let cleanedUp = false;
  return () => {
    if (cleanedUp || !channel) return;
    cleanedUp = true;
    const c = channel;
    channel = null;
    Promise.resolve(supabase.removeChannel(c)).catch(() => undefined);
  };
}
