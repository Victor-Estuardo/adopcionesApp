/**
 * Envoltura de un campo de formulario: label asociado por `htmlFor`/`id` (nunca
 * solo placeholder), texto de ayuda opcional y mensaje de error opcional
 * (rojo, junto al campo). El control hijo debe llevar `id={id}` y, cuando haya
 * error, `aria-invalid` + `aria-describedby={`${id}-error`}`.
 */
export function Field({
  id,
  label,
  optional,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  optional?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-gray-700">
        {label}
        {optional && (
          <span className="ml-1 font-normal text-gray-400">(opcional)</span>
        )}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-xs font-medium text-pink-meraki">
          {error}
        </p>
      ) : (
        hint && <p className="text-xs text-gray-400">{hint}</p>
      )}
    </div>
  );
}
