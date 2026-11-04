import { useEffect, useState } from 'react';

// After this long the message changes, so a slow network doesn't feel stuck.
const SLOW_AFTER_MS = 4000;

/**
 * The app's full-page loading screen: an advanced multi-ring spinner with a
 * counting number in the center and a subtle status line.
 *
 * @param {Object} props
 * @param {string} [props.label]  What's loading, shown and read out.
 */
export function LoadingIndicator({ label = 'Loading' }) {
  const [slow, setSlow] = useState(false);
  const [count, setCount] = useState(0);

  useEffect(() => {
    const slowTimer = setTimeout(() => setSlow(true), SLOW_AFTER_MS);
    return () => clearTimeout(slowTimer);
  }, []);

  // Count from 0 → 99 over ~3 s (every 30 ms), then hold at 99
  useEffect(() => {
    if (count >= 99) return;
    const step = setTimeout(() => setCount((c) => Math.min(c + 1, 99)), 30);
    return () => clearTimeout(step);
  }, [count]);

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-busy="true"
      className="flex flex-col items-center gap-8"
    >
      {/* Multi-ring spinner with counter in center */}
      <div className="relative w-20 h-20 flex items-center justify-center">
        {/* Outer ring — slow */}
        <span
          aria-hidden="true"
          className="absolute inset-0 rounded-full border-[3px] border-[#DFFF83]/20 border-t-[#DFFF83] animate-spin"
          style={{ animationDuration: '1.4s' }}
        />
        {/* Middle ring — medium, reverse */}
        <span
          aria-hidden="true"
          className="absolute inset-[7px] rounded-full border-[2.5px] border-[#B7DA3E]/15 border-b-[#B7DA3E] animate-spin"
          style={{ animationDuration: '1s', animationDirection: 'reverse' }}
        />
        {/* Inner ring — fast */}
        <span
          aria-hidden="true"
          className="absolute inset-[14px] rounded-full border-2 border-[#17191A]/10 border-t-[#17191A]/60 animate-spin"
          style={{ animationDuration: '0.7s' }}
        />
        {/* Incrementing counter */}
        <span
          aria-hidden="true"
          className="text-[13px] font-bold tabular-nums text-gray-600 dark:text-white select-none"
        >
          {count}%
        </span>
      </div>

      {/* Status text */}
      <p className="text-[13px] font-medium tracking-wide text-[#70829B]" aria-live="polite">
        {slow ? 'Still loading, hang tight…' : label}
      </p>
    </div>
  );
}

export default LoadingIndicator;
