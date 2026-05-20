import { useEffect, type RefObject } from 'react';
import { Keyboard, Platform, type FlatList } from 'react-native';

/**
 * Auto-scroll a chat FlatList to the bottom whenever the soft keyboard
 * opens. Without this, the keyboard pushes the input up but the FlatList
 * stays where it was, so the latest message can end up hidden behind the
 * keyboard — exactly the "I can't see what I'm typing" bug.
 *
 * Behaviour matches both platforms:
 *   - iOS fires `keyboardWillShow` ahead of the animation; we hook that
 *     for a smooth scroll.
 *   - Android only fires `keyboardDidShow`; we hook that and use a small
 *     delay so the FlatList has measured its new height post-resize.
 */
export function useScrollToEndOnKeyboard<T>(ref: RefObject<FlatList<T> | null>) {
  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const sub = Keyboard.addListener(showEvt, () => {
      // Two-pass scroll: one immediate (covers the "list is already long"
      // case) and one slightly delayed (covers the "list just re-sized"
      // case on Android).
      ref.current?.scrollToEnd({ animated: true });
      setTimeout(() => ref.current?.scrollToEnd({ animated: true }), 120);
    });
    return () => sub.remove();
  }, [ref]);
}
