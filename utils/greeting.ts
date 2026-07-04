/**
 * greeting.ts
 *
 * Resolve the first-name shown after the home greeting. Returns '' when neither
 * a profile name nor an email handle is available (a brand-new signup), so the
 * caller can render the greeting alone instead of an awkward blank or a generic
 * placeholder like "there" / "صديقي".
 */
export const resolveGreetingName = (
  profileName?: string | null,
  email?: string | null
): string =>
  (profileName?.trim() || email?.split('@')[0] || '').split(' ')[0].trim();
