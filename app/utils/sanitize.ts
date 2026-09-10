/**
 * Utilidades para validar/sanitizar parámetros de entrada antes de pasarlos a
 * la capa de datos, incluso en endpoints de solo lectura.
 */

/**
 * Convierte un valor arbitrario en un entero acotado a [min, max].
 * Devuelve `undefined` si el valor no es un número usable (así la query
 * simplemente no aplica límite en vez de fallar con basura).
 */
export function sanitizeLimit(
  value: unknown,
  { min = 1, max = 100 }: { min?: number; max?: number } = {},
): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;

  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return undefined;

  const int = Math.trunc(parsed);
  if (int < min) return min;
  if (int > max) return max;
  return int;
}

// Caracteres de control C0 + DEL: no deberían aparecer en texto de un
// formulario y suelen ser señal de un payload manipulado.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = new RegExp("[\u0000-\u001F\u007F]+", "g");

/**
 * Normaliza texto libre que llega de un formulario: quita caracteres de
 * control, colapsa espacios en blanco y recorta a `maxLength`. Devuelve `""`
 * si no queda nada útil. Úsese siempre antes de persistir texto que luego
 * pueda mostrarse (p. ej. el nombre del donante en el listado público).
 */
export function sanitizeText(value: unknown, maxLength = 500): string {
  if (typeof value !== "string") return "";
  const collapsed = value.replace(CONTROL_CHARS, " ").replace(/\s+/g, " ").trim();
  return collapsed.slice(0, maxLength);
}

/**
 * Sanitiza y valida un correo. Devuelve el correo en minúsculas si tiene una
 * forma válida y razonable, o `null` en caso contrario.
 */
export function sanitizeEmail(value: unknown): string | null {
  const text = sanitizeText(value, 100).toLowerCase();
  if (!text) return null;
  // Validación deliberadamente conservadora: algo@algo.tld sin espacios.
  const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(text);
  return isValid ? text : null;
}

/**
 * Sanitiza un teléfono: conserva dígitos y los separadores habituales
 * (`+ - ( ) espacio`). Devuelve `null` si no queda al menos un dígito o si
 * excede `maxLength`.
 */
export function sanitizePhone(value: unknown, maxLength = 25): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value
    .replace(/[^\d+()\-\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const digitCount = (cleaned.match(/\d/g) ?? []).length;
  if (digitCount < 6 || cleaned.length > maxLength) return null;
  return cleaned;
}

/**
 * Sanitiza y valida un sitio web. Acepta con o sin esquema
 * (`empresa.com`, `www.empresa.com`, `https://empresa.com/ruta`) y siempre
 * devuelve la forma normalizada con `https://`, o `null` si no tiene forma de
 * dominio válido o excede `maxLength` (150 = el VarChar de `patrocinador`).
 */
export function sanitizeWebsite(
  value: unknown,
  maxLength = 150,
): string | null {
  const text = sanitizeText(value, maxLength + 10).toLowerCase().replace(/\s/g, "");
  if (!text) return null;

  const withoutScheme = text.replace(/^https?:\/\//, "").replace(/^\/+/, "");
  // host válido: etiquetas separadas por punto + TLD de 2+ letras, ruta opcional.
  const isValid = /^([a-z0-9](-?[a-z0-9])*\.)+[a-z]{2,}(:\d{2,5})?(\/\S*)?$/.test(
    withoutScheme,
  );
  if (!isValid) return null;

  const normalized = `https://${withoutScheme}`;
  return normalized.length > maxLength ? null : normalized;
}

/**
 * Convierte un valor arbitrario en un monto positivo con 2 decimales,
 * devuelto como string para pasarlo tal cual a una columna `Decimal` sin
 * arrastrar errores de coma flotante. Devuelve `null` si no es un número
 * positivo usable o si supera `max`.
 */
export function sanitizeAmount(
  value: unknown,
  { max = 9_999_999.99 }: { max?: number } = {},
): string | null {
  if (value === undefined || value === null || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > max) return null;
  return parsed.toFixed(2);
}
