import { useEffect, useRef, useState } from "react";
import { FaFileExcel } from "react-icons/fa";
import { AiOutlineLoading3Quarters } from "react-icons/ai";
import { toast } from "sonner";

export type PresetRange = "7d" | "30d" | "90d" | "mes_actual" | "custom";

const PRESET_OPTIONS: { key: PresetRange; label: string }[] = [
  { key: "7d", label: "7 días" },
  { key: "30d", label: "30 días" },
  { key: "90d", label: "90 días" },
  { key: "mes_actual", label: "Este mes" },
];

interface StatsHeaderProps {
  title: string;
  preset: PresetRange;
  customFrom: string;
  customTo: string;
  onPresetChange: (preset: PresetRange) => void;
  onCustomDateChange: (key: "from" | "to", value: string) => void;
  activeTabId: string;
  activeTabLabel: string;
}

// Construye la URL de exportación reenviando el mismo rango de fecha que
// está activo en pantalla (preset o rango personalizado), para que la
// descarga refleje exactamente lo que se está viendo.
function buildExportUrl(
  seccion: string,
  preset: PresetRange,
  customFrom: string,
  customTo: string,
) {
  const params = new URLSearchParams();
  params.set("range", preset);
  if (preset === "custom") {
    if (customFrom) params.set("from", customFrom);
    if (customTo) params.set("to", customTo);
  }
  params.set("seccion", seccion);
  return `/estadisticas/exportar?${params.toString()}`;
}

// Lee el nombre de archivo sugerido por el servidor (Content-Disposition);
// si no viene, cae a un nombre genérico.
function getFilenameFromResponse(res: Response) {
  const disposition = res.headers.get("Content-Disposition") || "";
  const match = disposition.match(/filename="?([^"]+)"?/);
  return match?.[1] || "estadisticas.xlsx";
}

/**
 * Encabezado compartido del módulo de Estadísticas: filtro de rango de
 * fechas (mismo comportamiento para las 4 pestañas) + botón de exportar a
 * Excel, con un menú para elegir entre la pestaña activa o el reporte
 * consolidado.
 */
export default function StatsHeader({
  title,
  preset,
  customFrom,
  customTo,
  onPresetChange,
  onCustomDateChange,
  activeTabId,
  activeTabLabel,
}: StatsHeaderProps) {
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const exportButtonRef = useRef<HTMLButtonElement>(null);

  async function handleExport(seccion: string) {
    setExportMenuOpen(false);
    setIsExporting(true);

    try {
      const url = buildExportUrl(seccion, preset, customFrom, customTo);
      const res = await fetch(url);

      if (!res.ok) {
        let message = "Ocurrió un error al generar el archivo de Excel.";
        if ((res.headers.get("Content-Type") || "").includes("application/json")) {
          const data = await res.json().catch(() => null);
          if (data?.errorMsg) message = data.errorMsg;
        } else {
          const text = await res.text().catch(() => "");
          if (text) message = text;
        }
        toast.error(message);
        return;
      }

      const blob = await res.blob();
      const filename = getFilenameFromResponse(res);
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      toast.error("Ocurrió un error al generar el archivo de Excel.");
    } finally {
      setIsExporting(false);
    }
  }

  useEffect(() => {
    if (!exportMenuOpen) return;

    function handleClickOutside(e: MouseEvent) {
      if (
        exportMenuRef.current?.contains(e.target as Node) ||
        exportButtonRef.current?.contains(e.target as Node)
      ) {
        return;
      }
      setExportMenuOpen(false);
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setExportMenuOpen(false);
        exportButtonRef.current?.focus();
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [exportMenuOpen]);

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 md:justify-end">
      <h1 className="text-xl font-bold md:sr-only">{title}</h1>

      <div className="flex flex-wrap items-center gap-2">
        {PRESET_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            type="button"
            onClick={() => onPresetChange(opt.key)}
            aria-pressed={preset === opt.key}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              preset === opt.key
                ? "bg-[#52C9BB] text-white"
                : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            {opt.label}
          </button>
        ))}

        <div className="flex items-center gap-1.5 ml-1">
          <input
            type="date"
            defaultValue={customFrom}
            onChange={(e) => onCustomDateChange("from", e.target.value)}
            aria-label="Fecha de inicio del rango personalizado"
            className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm text-gray-600"
          />
          <span className="text-gray-400 text-sm">-</span>
          <input
            type="date"
            defaultValue={customTo}
            onChange={(e) => onCustomDateChange("to", e.target.value)}
            aria-label="Fecha de fin del rango personalizado"
            className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm text-gray-600"
          />
        </div>

        <div className="relative ml-1">
          <button
            ref={exportButtonRef}
            type="button"
            onClick={() => setExportMenuOpen((v) => !v)}
            disabled={isExporting}
            aria-haspopup="menu"
            aria-expanded={exportMenuOpen}
            aria-busy={isExporting}
            className="flex items-center gap-x-2 px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-200 text-gray-600 bg-white hover:bg-gray-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-meraki/40 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:bg-white"
          >
            {isExporting ? (
              <>
                <AiOutlineLoading3Quarters className="w-4 h-4 animate-spin" />
                Generando...
              </>
            ) : (
              <>
                <FaFileExcel className="w-4 h-4" />
                Descargar Excel
              </>
            )}
          </button>

          {exportMenuOpen && (
            <div
              ref={exportMenuRef}
              role="menu"
              aria-label="Opciones de descarga"
              className="absolute right-0 z-10 mt-2 w-56 rounded-lg border border-gray-200 bg-white shadow-lg py-1"
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => handleExport(activeTabId)}
                className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 focus-visible:outline-none focus-visible:bg-gray-50"
              >
                Pestaña activa
                <span className="block text-xs text-gray-400">
                  {activeTabLabel}
                </span>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => handleExport("todas")}
                className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 focus-visible:outline-none focus-visible:bg-gray-50"
              >
                Reporte consolidado
                <span className="block text-xs text-gray-400">
                  Las 4 pestañas
                </span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
