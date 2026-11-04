
export function BirdIcon({ size = 29, strokeWidth, className = '', style, ...props }) {
  return (
    <span
      className={`inline-flex items-center justify-center shrink-0 ${className}`}
      style={{ width: size, height: size, ...style }}
      {...props}
    >
      <img
        src="/images/chiken_light.png"
        alt=""
        aria-hidden="true"
        width={size}
        height={size}
        className="w-full h-full object-contain dark:hidden"
      />
      <img
        src="/images/chiken_dark.png"
        alt=""
        aria-hidden="true"
        width={size}
        height={size}
        className="w-full h-full object-contain hidden dark:block dark:invert"
      />
    </span>
  );
}

export default BirdIcon;
