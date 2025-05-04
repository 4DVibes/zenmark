/**
 * Creates a debounced function that delays invoking func until after wait milliseconds have elapsed
 * since the last time the debounced function was invoked.
 *
 * @param func The function to debounce.
 * @param waitFor The number of milliseconds to delay.
 * @returns The new debounced function.
 */
export function debounce<F extends (...args: any[]) => any>(func: F, waitFor: number): (...args: Parameters<F>) => void {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    return (...args: Parameters<F>): void => {
        if (timeoutId !== null) {
            clearTimeout(timeoutId);
        }
        timeoutId = setTimeout(() => {
            func(...args);
        }, waitFor);
    };
} 