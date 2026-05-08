import { router } from 'expo-router';

/**
 * Navigates back if there's a screen to go back to, otherwise replaces with
 * the given fallback route. Prevents the dev-only "GO_BACK was not handled"
 * warning that appears when `router.back()` is called on an empty stack —
 * for example after a `router.replace` left no history behind it.
 */
export const safeBack = (fallback: string = '/role-selection') => {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace(fallback as any);
  }
};
