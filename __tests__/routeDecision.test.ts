import {
  decideColdLaunch,
  decideAuthFlowTarget,
  type ColdLaunchInput,
  type AuthFlowInput,
} from '../utils/routeDecision';

const coldLaunch = (over: Partial<ColdLaunchInput> = {}): ColdLaunchInput => ({
  isLoggedIn: false,
  lastRole: null,
  seenOnboarding: false,
  onboardingEnabled: true,
  ...over,
});

describe('decideColdLaunch', () => {
  it('sends a returning logged-in customer straight into the customer portal', () => {
    expect(decideColdLaunch(coldLaunch({ isLoggedIn: true, lastRole: 'customer' }))).toBe(
      '/(customer)'
    );
  });

  it('sends a returning logged-in technician straight into the technician portal', () => {
    expect(decideColdLaunch(coldLaunch({ isLoggedIn: true, lastRole: 'technician' }))).toBe(
      '/(technician)'
    );
  });

  it('shows onboarding for a fresh, logged-out, unseen install', () => {
    expect(
      decideColdLaunch(coldLaunch({ isLoggedIn: false, seenOnboarding: false }))
    ).toBe('/onboarding');
  });

  it('skips onboarding once it has been seen', () => {
    expect(
      decideColdLaunch(coldLaunch({ isLoggedIn: false, seenOnboarding: true }))
    ).toBe('/role-selection');
  });

  it('skips onboarding when the feature flag is off', () => {
    expect(
      decideColdLaunch(
        coldLaunch({ isLoggedIn: false, seenOnboarding: false, onboardingEnabled: false })
      )
    ).toBe('/role-selection');
  });

  it('never shows onboarding to a logged-in user (falls back to role-selection when no remembered role)', () => {
    expect(
      decideColdLaunch(coldLaunch({ isLoggedIn: true, lastRole: null, seenOnboarding: false }))
    ).toBe('/role-selection');
  });

  it('logged out with intro already seen → role-selection', () => {
    expect(
      decideColdLaunch(coldLaunch({ isLoggedIn: false, lastRole: null, seenOnboarding: true }))
    ).toBe('/role-selection');
  });
});

const authFlow = (over: Partial<AuthFlowInput> = {}): AuthFlowInput => ({
  isAdmin: false,
  wantsCustomer: false,
  wantsTechnician: false,
  profileRole: null,
  ...over,
});

describe('decideAuthFlowTarget', () => {
  it('admin always wins, even over an explicit technician source', () => {
    expect(decideAuthFlowTarget(authFlow({ isAdmin: true, wantsTechnician: true }))).toBe(
      '/admin'
    );
  });

  it('an explicit customer auth source routes to the customer portal', () => {
    expect(decideAuthFlowTarget(authFlow({ wantsCustomer: true }))).toBe('/(customer)');
  });

  it('an explicit customer source overrides a technician profile role', () => {
    expect(
      decideAuthFlowTarget(authFlow({ wantsCustomer: true, profileRole: 'technician' }))
    ).toBe('/(customer)');
  });

  it('an explicit technician auth source routes to the technician portal', () => {
    expect(decideAuthFlowTarget(authFlow({ wantsTechnician: true }))).toBe('/(technician)');
  });

  it('falls back to a technician profile role when no auth source binds', () => {
    expect(decideAuthFlowTarget(authFlow({ profileRole: 'technician' }))).toBe('/(technician)');
  });

  it('falls back to the customer portal for a customer/absent profile role', () => {
    expect(decideAuthFlowTarget(authFlow({ profileRole: 'customer' }))).toBe('/(customer)');
    expect(decideAuthFlowTarget(authFlow({ profileRole: null }))).toBe('/(customer)');
    expect(decideAuthFlowTarget(authFlow({ profileRole: undefined }))).toBe('/(customer)');
  });
});

// ── Courier role (first-class role, added 2026-07) ─────────────────────────

describe('courier routing', () => {
  it('cold launch with a remembered courier flow goes straight to the courier portal', () => {
    expect(
      decideColdLaunch({
        isLoggedIn: true,
        lastRole: 'courier',
        seenOnboarding: true,
        onboardingEnabled: true,
      })
    ).toBe('/(courier)');
  });

  it('a logged-out user with a stale courier preference still sees role-selection', () => {
    expect(
      decideColdLaunch({
        isLoggedIn: false,
        lastRole: 'courier',
        seenOnboarding: true,
        onboardingEnabled: false,
      })
    ).toBe('/role-selection');
  });

  it('an explicit courier auth source routes to the courier portal', () => {
    expect(decideAuthFlowTarget(authFlow({ wantsCourier: true }))).toBe('/(courier)');
  });

  it('admin wins over an explicit courier source', () => {
    expect(decideAuthFlowTarget(authFlow({ isAdmin: true, wantsCourier: true }))).toBe('/admin');
  });

  it('an explicit customer source overrides a courier profile role', () => {
    expect(
      decideAuthFlowTarget(authFlow({ wantsCustomer: true, profileRole: 'courier' }))
    ).toBe('/(customer)');
  });

  it('falls back to a courier profile role when no auth source binds', () => {
    expect(decideAuthFlowTarget(authFlow({ profileRole: 'courier' }))).toBe('/(courier)');
  });
});
