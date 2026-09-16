import { PresetRange } from "~/components/Stats/StatsHeader";

/**
 * Calcula el rango de fechas real a partir del preset o de fechas
 * personalizadas. Compartido entre la página de Estadísticas y la
 * exportación a Excel para que ambas apliquen exactamente el mismo rango.
 */
export function resolveDateRange(
  preset: PresetRange,
  customFrom?: string | null,
  customTo?: string | null,
) {
  const now = new Date();
  const to = new Date(now);
  to.setHours(23, 59, 59, 999);

  if (preset === "custom" && customFrom && customTo) {
    const from = new Date(customFrom);
    from.setHours(0, 0, 0, 0);
    const toCustom = new Date(customTo);
    toCustom.setHours(23, 59, 59, 999);
    return { from, to: toCustom };
  }

  if (preset === "mes_actual") {
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from, to };
  }

  const days = preset === "7d" ? 7 : preset === "90d" ? 90 : 30;
  const from = new Date(now);
  from.setDate(from.getDate() - days);
  from.setHours(0, 0, 0, 0);
  return { from, to };
}
