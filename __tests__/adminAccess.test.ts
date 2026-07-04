import type { User } from '@supabase/supabase-js';
import { isAdminUser, canAccessAdmin } from '../constants/admin';

// Minimal User shape — only app_metadata is read by the helpers under test.
const mkUser = (app_metadata: Record<string, unknown> = {}): User =>
  ({ id: 'u1', app_metadata } as unknown as User);

describe('isAdminUser', () => {
  it('is false for a null / undefined user', () => {
    expect(isAdminUser(null)).toBe(false);
    expect(isAdminUser(undefined)).toBe(false);
  });

  it('is true when app_metadata.is_admin === true', () => {
    expect(isAdminUser(mkUser({ is_admin: true }))).toBe(true);
  });

  it('is true when app_metadata.roles contains "admin"', () => {
    expect(isAdminUser(mkUser({ roles: ['admin', 'x'] }))).toBe(true);
  });

  it('is false for an ordinary user with no admin claim', () => {
    expect(isAdminUser(mkUser({}))).toBe(false);
    expect(isAdminUser(mkUser({ is_admin: false, roles: ['customer'] }))).toBe(false);
  });

  it('never trusts user_metadata for the admin decision', () => {
    const forged = { id: 'u1', app_metadata: {}, user_metadata: { is_admin: true } } as unknown as User;
    expect(isAdminUser(forged)).toBe(false);
  });
});

describe('canAccessAdmin', () => {
  it('grants access to a legacy JWT full admin regardless of RBAC perms', () => {
    expect(canAccessAdmin(mkUser({ is_admin: true }), [])).toBe(true);
    expect(canAccessAdmin(mkUser({ is_admin: true }), null)).toBe(true);
  });

  it('grants access to an RBAC staff member (non-empty permission set) without a JWT claim', () => {
    // This is the promoted-manager case that was previously bounced.
    expect(canAccessAdmin(mkUser({}), ['support_management'])).toBe(true);
    expect(canAccessAdmin(mkUser({}), ['full_admin_access'])).toBe(true);
  });

  it('denies access when neither the JWT claim nor any RBAC permission is present', () => {
    expect(canAccessAdmin(mkUser({}), [])).toBe(false);
    expect(canAccessAdmin(mkUser({}), null)).toBe(false);
    expect(canAccessAdmin(mkUser({}), undefined)).toBe(false);
  });

  it('denies access for a signed-out user', () => {
    expect(canAccessAdmin(null, [])).toBe(false);
    expect(canAccessAdmin(null, ['full_admin_access'])).toBe(false);
  });
});
