import { useEffect, useRef } from 'react';

type EffectCallback = () => void | (() => void | undefined);
type DependencyList = readonly unknown[];

/**
 * A custom hook that mimics useEffect but debounces the effect execution.
 * @param effect Imperative function that can return a cleanup function.
 * @param deps If present, effect will only activate if the values in the list change.
 * @param delay The delay in milliseconds to wait before executing the effect.
 */
export function useDebouncedEffect(
    effect: EffectCallback,
    deps: DependencyList,
    delay: number
): void {
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const cleanupRef = useRef<ReturnType<EffectCallback> | null>(null);

    useEffect(() => {
        // Clear any existing timeout and run previous cleanup
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }
        if (typeof cleanupRef.current === 'function') {
            cleanupRef.current();
            cleanupRef.current = null;
        }

        // Set a new timeout to run the effect
        timeoutRef.current = setTimeout(() => {
            cleanupRef.current = effect();
        }, delay);

        // Cleanup function for when the component unmounts or deps change *before* timeout
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
            // Run the effect's cleanup if it exists
            if (typeof cleanupRef.current === 'function') {
                cleanupRef.current();
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [...deps, delay]); // Include delay in dependencies? Usually stable, but good practice
} 