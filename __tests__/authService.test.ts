import * as authService from '../services/authService';

jest.mock('../services/supabaseClient', () => ({
  supabase: {
    auth: {
      signUp: jest.fn(),
      signInWithPassword: jest.fn(),
      signOut: jest.fn(),
      getUser: jest.fn(),
      getSession: jest.fn(),
      onAuthStateChange: jest.fn(),
    },
    from: jest.fn(() => ({
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(),
    })),
  },
}));

jest.mock('../utils/logger', () => ({
  logger: { error: jest.fn(), info: jest.fn(), debug: jest.fn(), warn: jest.fn() },
}));

const { supabase } = require('../services/supabaseClient');

describe('authService', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('exports', () => {
    it('exports all required functions', () => {
      expect(typeof authService.signUpWithPhoneOrEmail).toBe('function');
      expect(typeof authService.loginWithPhoneOrEmail).toBe('function');
      expect(typeof authService.logout).toBe('function');
      expect(typeof authService.getCurrentUser).toBe('function');
      expect(typeof authService.getCurrentSession).toBe('function');
      expect(typeof authService.updateProfile).toBe('function');
      expect(typeof authService.onAuthStateChange).toBe('function');
    });
  });

  describe('loginWithPhoneOrEmail', () => {
    it('returns user and session on success', async () => {
      const mockUser = { id: 'user-1', email: 'test@test.com' };
      const mockSession = { access_token: 'token-123' };
      supabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: mockUser, session: mockSession },
        error: null,
      });

      const result = await authService.loginWithPhoneOrEmail({
        email: 'test@test.com',
        password: 'password123',
      });

      expect(result.user).toEqual(mockUser);
      expect(result.session).toEqual(mockSession);
    });

    it('throws on authentication error', async () => {
      supabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: new Error('Invalid credentials'),
      });

      await expect(
        authService.loginWithPhoneOrEmail({ email: 'bad@test.com', password: 'wrong' })
      ).rejects.toThrow('Invalid credentials');
    });
  });

  describe('getCurrentUser', () => {
    it('returns null when getUser throws', async () => {
      supabase.auth.getUser.mockRejectedValue(new Error('Network error'));
      const user = await authService.getCurrentUser();
      expect(user).toBeNull();
    });

    it('returns user on success', async () => {
      const mockUser = { id: 'user-1' };
      supabase.auth.getUser.mockResolvedValue({ data: { user: mockUser }, error: null });
      const user = await authService.getCurrentUser();
      expect(user).toEqual(mockUser);
    });
  });

  describe('logout', () => {
    it('calls signOut', async () => {
      supabase.auth.signOut.mockResolvedValue({ error: null });
      await expect(authService.logout()).resolves.not.toThrow();
      expect(supabase.auth.signOut).toHaveBeenCalledTimes(1);
    });

    it('does not throw when signOut fails (logout is idempotent / local-only)', async () => {
      supabase.auth.signOut.mockRejectedValue(new Error('Sign out failed'));
      await expect(authService.logout()).resolves.not.toThrow();
    });
  });
});
