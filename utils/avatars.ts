// Default avatar URLs based on gender
export const DEFAULT_AVATARS = {
  male: 'https://api.dicebear.com/7.x/avataaars/svg?seed=male&backgroundColor=b6e3f4',
  female: 'https://api.dicebear.com/7.x/avataaars/svg?seed=female&backgroundColor=ffdfbf&hair=long01',
  boy: 'https://api.dicebear.com/7.x/avataaars/svg?seed=boy&backgroundColor=c0aede',
  girl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=girl&backgroundColor=ffd5dc&hair=long02',
};

export type Gender = 'male' | 'female' | 'boy' | 'girl';

export const getDefaultAvatar = (gender?: Gender): string => {
  if (!gender) return DEFAULT_AVATARS.male;
  return DEFAULT_AVATARS[gender] || DEFAULT_AVATARS.male;
};

export const getAvatarUrl = (customUrl?: string, gender?: Gender): string => {
  if (customUrl) return customUrl;
  return getDefaultAvatar(gender);
};

// Palette for initials-fallback avatars. Deterministic per name so the same
// person always gets the same colour across screens.
const INITIALS_COLORS = [
  '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B',
  '#06B6D4', '#EF4444', '#14B8A6', '#6366F1', '#F97316',
];

export const getInitials = (name?: string | null): string => {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
};

export const getAvatarColor = (seed?: string | null): string => {
  const s = seed && seed.length ? seed : '?';
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = s.charCodeAt(i) + ((hash << 5) - hash);
  }
  return INITIALS_COLORS[Math.abs(hash) % INITIALS_COLORS.length];
};
