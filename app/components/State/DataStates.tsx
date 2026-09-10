import { useRevalidator } from "@remix-run/react";
import { FaExclamationTriangle } from "react-icons/fa";

/**
 * Estado de error para una vista administrativa que carga datos de un loader.
 * El `message` debe ser específico a la vista (no un texto genérico repetido).
 * "Reintentar" revalida el loader sin recargar la página.
 */
export function DataErrorState({ message }: { message: string }) {
  const revalidator = useRevalidator();
  const retrying = revalidator.state === "loading";

  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-6 py-12 text-center"
    >
      <FaExclamationTriangle className="h-7 w-7 text-red-500" aria-hidden />
      <p className="max-w-sm text-sm text-red-700">{message}</p>
      <button
        type="button"
        onClick={() => revalidator.revalidate()}
        disabled={retrying}
        className="rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 disabled:opacity-60"
      >
        {retrying ? "Reintentando…" : "Reintentar"}
      </button>
    </div>
  );
}

/**
 * Estado vacío para una vista administrativa que carga datos de un loader.
 * `title`/`message` describen qué aparecerá aquí (contexto de la vista) y, si el
 * usuario puede crear el primer registro, `action` ofrece el atajo para hacerlo.
 */
export function DataEmptyState({
  title,
  message,
  action,
}: {
  title: string;
  message: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[#E4E0D6] py-16 text-center">
      <p className="font-medium text-[#1F1D1A]">{title}</p>
      <p className="max-w-xs text-sm text-[#8A8577]">{message}</p>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-1 rounded-xl bg-[#1F1D1A] px-4 py-2 text-sm font-medium text-white hover:bg-[#3A362E] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F1D1A]/40"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
