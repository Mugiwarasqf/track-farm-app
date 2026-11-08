import { Birdhouse } from 'lucide-react';

// Lucide's birdhouse, drawn in currentColor, so each caller's light and dark
// text colour classes (e.g. "text-stone-400 dark:text-[#64748B]") apply.
export function PenIcon({ size = 16, strokeWidth = 2, className = '', ...props }) {
  return (
    <Birdhouse
      size={size}
      strokeWidth={strokeWidth}
      className={className}
      aria-hidden="true"
      {...props}
    />
  );
}

export default PenIcon;
