/**
 * routeDecision.ts — pure, side-effect-free routing decision helpers.
 *
 * These functions centralize the two trickiest routing decisions in the app so
 * they live in ONE place, are unit-testable, and can't silently drift between
 * the cold-launch entry (app/index.tsx) and the in-session auth guard
 * (app/_layout.tsx). They contain NO navigation calls and NO React/expo-router
 * dependencies — callers do the actual redirect and own the "when".
 *
 * Behaviour here is a 1:1 extraction of the previously-inline logic; changing
 * these functions changes routing, so keep them covered by routeDecision.test.
 */

export type AppFlow = 'customer' | 'technician';

export type ColdLaunchTarget =
  | '/(customer)'
  | '/(technician)'
  | '/onboarding'
  | '/role-selection';

export interface ColdLaunchInput {
  /** Is there an authenticated session? */
  isLoggedIn: boolean;
  /** The remembered flow from a prior session, or null if none saved. */
  lastRole: AppFlow | null;
  /** Has the user already completed/skipped the first-run onboarding? */
  seenOnboarding: boolean;
  /** Feature flag gating the onboarding intro. */
  onboardingEnabled: boolean;
}

/**
 * Cold-launch entry decision (app/index.tsx). Assumes the caller has already
 * waited for auth + the persisted reads to settle.
 *
 *  1. Logged in with a remembered flow → straight into that portal.
 *  2. Fresh, logged-out, onboarding enabled & unseen → onboarding intro.
 *  3. Otherwise → role-selection.
 */
export function decideColdLaunch(input: ColdLaunchInput): ColdLaunchTarget {
  const { isLoggedIn, lastRole, seenOnboarding, onboardingEnabled } = input;

  if (isLoggedIn && lastRole) {
    return lastRole === 'technician' ? '/(technician)' : '/(customer)';
  }

  if (onboardingEnabled && !isLoggedIn && !seenOnboarding) {
    return '/onboarding';
  }

  return '/role-selection';
}

export type AuthFlowTarget = '/admin' | '/(customer)' | '/(technician)';

export interface AuthFlowInput {
  /** Server-set admin claim (app_metadata.is_admin). Always wins. */
  isAdmin: boolean;
  /** The user arrived via an explicit customer auth source. */
  wantsCustomer: boolean;
  /** The user arrived via an explicit technician auth source. */
  wantsTechnician: boolean;
  /** Profile-stored role, used only as a fallback when no auth source binds. */
  profileRole: string | null | undefined;
}

/**
 * Target portal for a logged-in user who has landed on an auth screen
 * (app/_layout.tsx redirect-away logic). This is the historically bug-prone
 * "wrong portal" resolution, kept in one tested place.
 *
 * Resolution order:
 *   1. Admin → /admin (system-level, always wins).
 *   2. Explicit customer auth source → /(customer) (honours the user's choice
 *      even if their profile role is technician).
 *   3. Explicit technician auth source → /(technician).
 *   4. Fallback to the profile-stored role (technician → /(technician),
 *      anything else → /(customer)).
 */
export function decideAuthFlowTarget(input: AuthFlowInput): AuthFlowTarget {
  const { isAdmin, wantsCustomer, wantsTechnician, profileRole } = input;

  if (isAdmin) return '/admin';
  if (wantsCustomer) return '/(customer)';
  if (wantsTechnician) return '/(technician)';
  return profileRole === 'technician' ? '/(technician)' : '/(customer)';
}
