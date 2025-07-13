/**
 * Debounce Hooks
 * Debounce hooks to delay expensive operations like search
 * 
 * Migrated to TypeScript with comprehensive type safety for debounce operations.
 */

import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Debounce hook to delay expensive operations like search
 * @param value - The value to debounce
 * @param delay - Delay in milliseconds
 * @returns Debounced value
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Debounced callback hook
 * @param callback - Function to debounce
 * @param delay - Delay in milliseconds
 * @param deps - Dependencies array
 * @returns Debounced callback
 */
export function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T, 
  delay: number, 
  deps: React.DependencyList = []
): (...args: Parameters<T>) => void {
  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | undefined>();

  const debouncedCallback = useCallback((...args: Parameters<T>) => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    const newTimer = setTimeout(() => {
      callback(...args);
    }, delay);

    setDebounceTimer(newTimer);
  }, [callback, delay, debounceTimer]);

  useEffect(() => {
    return () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
    };
  }, [debounceTimer]);

  useEffect(() => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      setDebounceTimer(undefined);
    }
  }, deps);

  return debouncedCallback;
}

/**
 * Advanced debounce hook with leading and trailing options
 * @param callback - Function to debounce
 * @param delay - Delay in milliseconds
 * @param options - Debounce options
 * @returns Debounced callback with control methods
 */
export function useAdvancedDebounce<T extends (...args: any[]) => any>(
  callback: T,
  delay: number,
  options: {
    leading?: boolean;
    trailing?: boolean;
    maxWait?: number;
  } = {}
): {
  debouncedCallback: (...args: Parameters<T>) => void;
  cancel: () => void;
  flush: () => void;
  pending: boolean;
} {
  const { leading = false, trailing = true, maxWait } = options;
  
  const callbackRef = useRef(callback);
  const lastArgsRef = useRef<Parameters<T>>();
  const lastCallTimeRef = useRef<number>();
  const lastInvokeTimeRef = useRef<number>(0);
  const timerRef = useRef<NodeJS.Timeout>();
  const maxTimerRef = useRef<NodeJS.Timeout>();
  const [pending, setPending] = useState(false);

  // Update callback ref when callback changes
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const invokeFunc = useCallback((time: number) => {
    const args = lastArgsRef.current;
    if (args) {
      lastInvokeTimeRef.current = time;
      setPending(false);
      return callbackRef.current(...args);
    }
  }, []);

  const leadingEdge = useCallback((time: number) => {
    lastInvokeTimeRef.current = time;
    timerRef.current = setTimeout(timerExpired, delay);
    setPending(true);
    return leading ? invokeFunc(time) : undefined;
  }, [delay, leading, invokeFunc]);

  const remainingWait = useCallback((time: number) => {
    const timeSinceLastCall = time - (lastCallTimeRef.current || 0);
    const timeSinceLastInvoke = time - lastInvokeTimeRef.current;
    const timeWaiting = delay - timeSinceLastCall;

    return maxWait !== undefined
      ? Math.min(timeWaiting, maxWait - timeSinceLastInvoke)
      : timeWaiting;
  }, [delay, maxWait]);

  const shouldInvoke = useCallback((time: number) => {
    const timeSinceLastCall = time - (lastCallTimeRef.current || 0);
    const timeSinceLastInvoke = time - lastInvokeTimeRef.current;

    return (
      lastCallTimeRef.current === undefined ||
      timeSinceLastCall >= delay ||
      timeSinceLastCall < 0 ||
      (maxWait !== undefined && timeSinceLastInvoke >= maxWait)
    );
  }, [delay, maxWait]);

  const timerExpired = useCallback(() => {
    const time = Date.now();
    if (shouldInvoke(time)) {
      return trailingEdge(time);
    }
    timerRef.current = setTimeout(timerExpired, remainingWait(time));
  }, [shouldInvoke, remainingWait]);

  const trailingEdge = useCallback((time: number) => {
    timerRef.current = undefined;
    if (trailing && lastArgsRef.current) {
      return invokeFunc(time);
    }
    lastArgsRef.current = undefined;
    setPending(false);
    return undefined;
  }, [trailing, invokeFunc]);

  const cancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = undefined;
    }
    if (maxTimerRef.current) {
      clearTimeout(maxTimerRef.current);
      maxTimerRef.current = undefined;
    }
    lastInvokeTimeRef.current = 0;
    lastArgsRef.current = undefined;
    lastCallTimeRef.current = undefined;
    setPending(false);
  }, []);

  const flush = useCallback(() => {
    if (timerRef.current) {
      const result = trailingEdge(Date.now());
      cancel();
      return result;
    }
  }, [cancel, trailingEdge]);

  const debouncedCallback = useCallback((...args: Parameters<T>) => {
    const time = Date.now();
    const isInvoking = shouldInvoke(time);

    lastArgsRef.current = args;
    lastCallTimeRef.current = time;

    if (isInvoking) {
      if (!timerRef.current) {
        return leadingEdge(time);
      }
      if (maxWait !== undefined) {
        timerRef.current = setTimeout(timerExpired, delay);
        maxTimerRef.current = setTimeout(() => invokeFunc(time), maxWait);
        return leading ? invokeFunc(time) : undefined;
      }
    }
    if (!timerRef.current) {
      timerRef.current = setTimeout(timerExpired, delay);
      setPending(true);
    }
  }, [shouldInvoke, leadingEdge, maxWait, delay, timerExpired, leading, invokeFunc]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancel();
    };
  }, [cancel]);

  return {
    debouncedCallback,
    cancel,
    flush,
    pending
  };
}

/**
 * Debounced state hook
 * @param initialValue - Initial state value
 * @param delay - Delay in milliseconds
 * @returns Tuple of [debouncedValue, setValue, immediateValue]
 */
export function useDebouncedState<T>(
  initialValue: T, 
  delay: number
): [T, React.Dispatch<React.SetStateAction<T>>, T] {
  const [immediateValue, setImmediateValue] = useState<T>(initialValue);
  const debouncedValue = useDebounce(immediateValue, delay);

  return [debouncedValue, setImmediateValue, immediateValue];
}

export default useDebounce;