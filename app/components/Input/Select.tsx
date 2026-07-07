import { forwardRef, type SelectHTMLAttributes } from "react";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  placeholder?: string;
}

/**
 * Select nativo estilizado.
 * - Placeholder real vía <option disabled hidden value="">
 * - Chevron custom con SVG en background (no requiere JS ni íconos externos)
 * - Estados: default, hover, focus, disabled, error
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ placeholder, className = "", children, ...props }, ref) => {
    return (
      <div className="relative">
        <select
          ref={ref}
          className={`
              appearance-none rounded-xl border bg-white
              px-4 py-2.5 pr-10 text-sm text-gray-800
              transition-colors duration-150
              border-gray-200
              hover:border-teal-300
              focus:outline-none focus:ring-2 focus:ring-teal-400/40 focus:border-teal-400
              disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400
              ${className}
            `}
          {...props}
        >
          {placeholder && (
            <option value="" disabled hidden>
              {placeholder}
            </option>
          )}
          {children}
        </select>

        {/* Chevron custom */}
        <svg
          className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-teal-500"
          viewBox="0 0 20 20"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M5 7.5L10 12.5L15 7.5"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    );
  },
);

Select.displayName = "Select";
