import { useId } from "react";
import { FaTimes } from "react-icons/fa";
import { useFocusTrap } from "~/hooks/useFocusTrap";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  /** Botones de acción del pie. Si se omite, no se muestra el pie. */
  footer?: React.ReactNode;
  size?: "md" | "lg";
}

/**
 * Modal centrado (hoja inferior en móvil). Accesible: Escape cierra, el foco
 * queda atrapado dentro mientras está abierto y vuelve al disparador al cerrar
 * (`useFocusTrap`). Entra con `animate-modal-pop`.
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = "md",
}: ModalProps) {
  const titleId = useId();
  const containerRef = useFocusTrap<HTMLDivElement>(open, onClose);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div
        className="absolute inset-0 bg-[#1F1D1A]/40"
        onClick={onClose}
        aria-hidden
      />

      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`relative flex max-h-[92vh] w-full flex-col rounded-t-2xl bg-white shadow-xl animate-modal-pop focus:outline-none sm:max-h-[88vh] sm:rounded-2xl ${
          size === "lg" ? "sm:max-w-lg" : "sm:max-w-md"
        }`}
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2 id={titleId} className="text-base font-bold text-gray-800">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-medium-turquoise-meraki/40"
          >
            <FaTimes className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>

        {footer && (
          <div className="flex gap-3 border-t border-gray-100 px-5 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
