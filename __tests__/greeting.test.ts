import { resolveGreetingName } from '../utils/greeting';

describe('resolveGreetingName', () => {
  it('uses the profile name (first word only)', () => {
    expect(resolveGreetingName('Mohamed Atef', 'x@y.com')).toBe('Mohamed');
  });

  it('trims surrounding whitespace on the profile name', () => {
    expect(resolveGreetingName('  Sara  ', null)).toBe('Sara');
  });

  it('falls back to the email handle when no name is set', () => {
    expect(resolveGreetingName('', 'muhammed@example.com')).toBe('muhammed');
  });

  it('ignores a whitespace-only profile name and uses the email', () => {
    expect(resolveGreetingName('   ', 'jane.doe@example.com')).toBe('jane.doe');
  });

  it('returns an empty string for a brand-new signup with no name and no email', () => {
    expect(resolveGreetingName(null, null)).toBe('');
    expect(resolveGreetingName('', '')).toBe('');
    expect(resolveGreetingName(undefined, undefined)).toBe('');
  });
});
