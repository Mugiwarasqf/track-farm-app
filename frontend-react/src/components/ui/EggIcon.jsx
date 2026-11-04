export function EggIcon({ size = 16, strokeWidth, className = '', style, ...props }) {
  return (
    <span
      className={`inline-flex items-center justify-center shrink-0 ${className}`}
      style={{ width: size, height: size, ...style }}
      {...props}
    >
      <img
        src="/icon/blackegg-icon.png"
        alt=""
        aria-hidden="true"
        width={size}
        height={size}
        className="w-full h-full object-contain dark:hidden"
      />
      <img
        src="/icon/whiteeeg.png"
        alt=""
        aria-hidden="true"
        width={size}
        height={size}
        className="w-full h-full object-contain hidden dark:block"
      />
    </span>
  );
}

export default EggIcon;
