import { MapPin } from 'lucide-react';

// Lucide's map pin, drawn in currentColor, so each caller's light and dark
// text colour classes (e.g. "text-stone-500 dark:text-[#94A3B8]") apply.
export function LocationIcon({ size = 16, strokeWidth = 2, className = '', ...props }) {
  return (
    <MapPin
      size={size}
      strokeWidth={strokeWidth}
      className={className}
      aria-hidden="true"
      {...props}
    />
  );
}

export default LocationIcon;
