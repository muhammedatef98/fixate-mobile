// Shared chat geometry — one bubble/composer shape for every chat surface
// (order chat, support, market, courier). Colors stay per-screen; only the
// shapes and type sizes are canonical, so the four chats read as one product.
import { BORDER_RADIUS } from '../../constants/theme';

export const CHAT_BUBBLE_MAX_WIDTH = '78%' as const;

export const CHAT_BUBBLE = {
  borderRadius: 16,
  paddingVertical: 8,
  paddingHorizontal: 12,
} as const;

export const CHAT_MSG_FONT_SIZE = 15;
export const CHAT_TIME_FONT_SIZE = 11;

export const CHAT_INPUT = {
  flex: 1,
  borderWidth: 1,
  borderRadius: BORDER_RADIUS.lg,
  paddingHorizontal: 14,
  paddingVertical: 10,
  minHeight: 44,
  maxHeight: 140,
  fontSize: CHAT_MSG_FONT_SIZE,
} as const;

export const CHAT_SEND_BTN = {
  width: 44,
  height: 44,
  borderRadius: 22,
  alignItems: 'center',
  justifyContent: 'center',
} as const;
