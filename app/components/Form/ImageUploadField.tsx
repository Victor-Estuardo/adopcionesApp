import { useEffect, useId, useRef, useState } from "react";
import { FaCloudUploadAlt, FaTimes } from "react-icons/fa";

/* Etiqueta legible por MIME type, para decirle al usuario qué formatos sí
   acepta el campo en vez de un genérico "formato no permitido". */
const MIME_LABEL: Record<string, string> = {
  "image/png": "PNG",
  "image/jpeg": "JPG",
  "image/jpg": "JPG",
  "image/webp": "WEBP",
  "image/svg+xml": "SVG",
  "application/pdf": "PDF",
};

function formatAllowedList(mimeTypes: string[]) {
  const labels = [
    ...new Set(mimeTypes.map((m) => MIME_LABEL[m] ?? m.split("/")[1] ?? m)),
  ];
  if (labels.length <= 1) return labels.join("");
  return `${labels.slice(0, -1).join(", ")} o ${labels[labels.length - 1]}`;
}

interface ImageUploadFieldProps {
  /** `name` del `<input type="file">` que lee la acción. */
  name: string;
  label: string;
  /** Lista de MIME types permitidos, separada por comas (igual que el backend). */
  accept: string;
  maxMB: number;
  hint?: string;
  optional?: boolean;
  /** URL de la imagen actual (modo edición). */
  currentUrl?: string | null;
  /** Si se pasa, "Quitar" sobre la imagen actual emite un hidden
   *  `<input name={removeName} value="true">` para que la acción la borre. */
  removeName?: string;
}

/**
 * Campo de carga de una imagen con **vista previa antes de guardar**: muestra
 * la imagen elegida (o la actual, en edición), valida tipo y tamaño en el
 * cliente reflejando las reglas del backend, y deja quitarla. El archivo viaja
 * en el `FormData` del formulario que envuelve al campo.
 */
export function ImageUploadField({
  name,
  label,
  accept,
  maxMB,
  hint,
  optional,
  currentUrl,
  removeName,
}: ImageUploadFieldProps) {
  const inputId = useId();
  const errorId = `${inputId}-error`;
  const inputRef = useRef<HTMLInputElement>(null);
  const accepted = accept.split(",").map((s) => s.trim());

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [removed, setRemoved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl]
  );

  const resetFileInput = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setPreviewUrl(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const picked = event.currentTarget.files?.[0] ?? null;
    setError(null);
    if (!picked) {
      resetFileInput();
      return;
    }
    if (!accepted.includes(picked.type)) {
      setError(
        `"${label}": usa un archivo ${formatAllowedList(accepted)}.`
      );
      resetFileInput();
      return;
    }
    if (picked.size > maxMB * 1024 * 1024) {
      setError(`"${label}" no debe superar los ${maxMB}MB.`);
      resetFileInput();
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(picked);
    setPreviewUrl(URL.createObjectURL(picked));
    setRemoved(false);
  };

  const shownUrl = previewUrl ?? (currentUrl && !removed ? currentUrl : null);

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={inputId} className="flex cursor-pointer flex-col gap-1.5">
        <span className="text-sm font-medium text-gray-700">
          {label}
          {optional && (
            <span className="ml-1 font-normal text-gray-400">(opcional)</span>
          )}
        </span>

        <span className="relative flex h-32 items-center justify-center overflow-hidden rounded-lg border border-dashed border-gray-300 bg-gray-50 text-center text-xs text-gray-400 transition-colors hover:border-medium-turquoise-meraki/60 focus-within:ring-2 focus-within:ring-medium-turquoise-meraki/40">
          {shownUrl ? (
            <img
              src={shownUrl}
              alt=""
              className="h-full w-full object-contain"
            />
          ) : (
            <span className="flex flex-col items-center gap-1.5">
              <FaCloudUploadAlt className="h-6 w-6 text-gray-300" aria-hidden />
              {hint ?? "Haz clic para subir una imagen"}
            </span>
          )}
        </span>

        <input
          id={inputId}
          ref={inputRef}
          type="file"
          name={name}
          accept={accept}
          className="sr-only"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          onChange={handleChange}
        />
      </label>

      {(file || (currentUrl && !removed)) && (
        <div className="flex items-center gap-3 text-xs">
          <span className="truncate text-gray-500">
            {file ? file.name : "Imagen actual"}
          </span>
          <button
            type="button"
            onClick={() => {
              if (file) {
                resetFileInput();
              } else if (removeName) {
                setRemoved(true);
              }
            }}
            className="shrink-0 font-medium text-gray-400 hover:text-gray-600"
          >
            <FaTimes className="mr-1 inline h-3 w-3" />
            Quitar
          </button>
        </div>
      )}

      {removed && removeName && (
        <input type="hidden" name={removeName} value="true" />
      )}

      {error && (
        <p id={errorId} className="text-xs font-medium text-pink-meraki">
          {error}
        </p>
      )}
    </div>
  );
}
