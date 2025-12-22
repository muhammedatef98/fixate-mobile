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
