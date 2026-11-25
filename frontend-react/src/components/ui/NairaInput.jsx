import { FIELD } from './Sheet';

/**
 * Money field that shows "₦45,000" while typing, so an extra zero is easy to
 * spot. `value` and `onChange` use plain digit strings ("45000"), like a
 * number input did.
 */
export function NairaInput({ value, onChange, className = FIELD, ...props }) {
  const digits = String(value ?? '').replace(/\D/g, '');
  const shown = digits ? `₦${Number(digits).toLocaleString('en-NG')}` : '';
  return (
    <input
      {...props}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      value={shown}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, '').replace(/^0+(?=\d)/, ''))}
      className={className}
    />
  );
}
