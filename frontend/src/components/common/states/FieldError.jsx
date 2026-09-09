/**
 * Field-level validation error — place directly under the invalid input.
 */
export default function FieldError({ message, id, className = "" }) {
  if (!message) return null;
  return (
    <p
      id={id}
      className={`mt-1 text-[11px] font-medium text-[#e11d48] ${className}`}
      role="alert"
    >
      {message}
    </p>
  );
}
