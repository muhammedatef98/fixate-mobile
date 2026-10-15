import { isRunningInExpoGo } from 'expo';
import { NativeModules, TurboModuleRegistry } from 'react-native';

/**
 * Runtime checks for native code that is not in every binary.
 *
 * Expo Go and older dev clients do not include every native module this app
 * uses (Firebase messaging, the dynamic app icon). A lazy `require()` inside a
 * try/catch is not enough in development: Metro reports the failed module
 * initialisation to LogBox as an uncaught error even though the caller catches
 * it. So callers check for the native module first and skip the feature when
 * it is missing.
 */

/** True inside the Expo Go app (not a development or store build). */
export function isExpoGo(): boolean {
  try {
    return isRunningInExpoGo();
  } catch {
    return false;
  }
}

/** Whether a React Native (classic or Turbo) native module is linked into this binary. */
export function hasNativeModule(name: string): boolean {
  if (isExpoGo()) return false;
  try {
    return NativeModules[name] != null || TurboModuleRegistry.get(name) != null;
  } catch {
    return false;
  }
}

/** Whether an Expo native module is linked into this binary. */
export function hasExpoNativeModule(name: string): boolean {
  if (isExpoGo()) return false;
  return (globalThis as any).expo?.modules?.[name] != null;
}
