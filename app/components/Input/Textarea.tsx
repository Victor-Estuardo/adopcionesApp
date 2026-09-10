import { forwardRef, type TextareaHTMLAttributes } from "react";

/** Textarea estilizado, mismo lenguaje visual que `Input` y `Select`. */
export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className = "", ...props }, ref) => (
  <textarea
    ref={ref}
    className={`w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 focus:border-medium-turquoise-meraki focus:outline-none focus:ring-2 focus:ring-medium-turquoise-meraki/30 ${className}`}
    {...props}
  />
));

Textarea.displayName = "Textarea";
