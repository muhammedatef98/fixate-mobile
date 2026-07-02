/**
 * featureFlags.ts — lightweight, build-time feature switches.
 *
 * These are plain constants (no remote config) so they ship in the JS bundle
 * and can be toggled via an EAS Update / OTA publish without a native rebuild.
 * Keep them boolean and side-effect free.
 */

/**
 * First-run onboarding carousel (app/onboarding.tsx).
 *
 * When true, a logged-OUT user who has never seen the intro is routed through
 * onboarding before role-selection (see app/index.tsx). Flip to false to
 * instantly disable/quarantine onboarding across all clients via an OTA
 * publish — the cold-launch gate then skips straight to role-selection with no
 * other code changes required. Signed-in users are never affected either way.
 */
export const ONBOARDING_ENABLED = true;
