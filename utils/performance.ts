/**
 * Performance optimization utilities for Fixate app
 */

import { InteractionManager } from 'react-native';

/**
 * Delays execution until after interactions are complete
 * Useful for heavy operations that shouldn't block UI
 */
export const runAfterInteractions = (callback: () => void): void => {
  InteractionManager.runAfterInteractions(() => {
    callback();
  });
};

/**
 * Debounce function to limit how often a function can be called
 * Useful for search inputs, scroll handlers, etc.
 */
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout | null = null;

  return (...args: Parameters<T>) => {
    if (timeout) {
      clearTimeout(timeout);
    }

    timeout = setTimeout(() => {
      func(...args);
    }, wait);
  };
};

/**
 * Throttle function to ensure a function is called at most once per interval
 * Useful for scroll events, resize handlers, etc.
 */
export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle: boolean = false;

  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
};

/**
 * Memoization helper for expensive computations
 */
export const memoize = <T extends (...args: any[]) => any>(
  func: T
): ((...args: Parameters<T>) => ReturnType<T>) => {
  const cache = new Map<string, ReturnType<T>>();

  return (...args: Parameters<T>): ReturnType<T> => {
    const key = JSON.stringify(args);
    
    if (cache.has(key)) {
      return cache.get(key)!;
    }

    const result = func(...args);
    cache.set(key, result);
    return result;
  };
};

/**
 * Image optimization helper
 * Returns optimized dimensions while maintaining aspect ratio
 */
export const getOptimizedImageDimensions = (
  originalWidth: number,
  originalHeight: number,
  maxWidth: number = 1024,
  maxHeight: number = 1024
): { width: number; height: number } => {
  let width = originalWidth;
  let height = originalHeight;

  if (width > maxWidth) {
    height = (maxWidth / width) * height;
    width = maxWidth;
  }

  if (height > maxHeight) {
    width = (maxHeight / height) * width;
    height = maxHeight;
  }

  return {
    width: Math.round(width),
    height: Math.round(height),
  };
};

/**
 * Memory cleanup helper
 * Call this when unmounting components with heavy resources
 */
export const cleanupResources = (...cleanupFunctions: (() => void)[]): void => {
  cleanupFunctions.forEach((cleanup) => {
    try {
      cleanup();
    } catch (error) {
      console.warn('Error during cleanup:', error);
    }
  });
};

/**
 * Batch updates helper for multiple state updates
 * Reduces re-renders
 */
export const batchUpdates = (updates: (() => void)[]): void => {
  updates.forEach((update) => update());
};

/**
 * Check if device has low memory
 * Returns true if device might be struggling
 */
export const isLowMemoryDevice = (): boolean => {
  // This is a simple heuristic
  // In production, you might want to use a native module to check actual memory
  return false; // Placeholder - implement based on your needs
};

/**
 * Lazy load helper for heavy components
 */
export const lazyLoadComponent = async <T>(
  importFunc: () => Promise<T>,
  delay: number = 0
): Promise<T> => {
  if (delay > 0) {
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
  return importFunc();
};
