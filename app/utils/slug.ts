/**
 * Utilidades de slug para URLs públicas (p. ej. `/finales-felices/:slug`).
 */

/** Longitud máxima de un slug (= VarChar(180) de `story.slug`). */
export const SLUG_MAX_LENGTH = 180;

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Convierte un texto en slug: sin tildes (la ñ pasa a n), minúsculas, solo
 * `[a-z0-9-]`, sin guiones dobles ni en los extremos y con máximo
 * `SLUG_MAX_LENGTH` caracteres. Puede devolver `""` si el texto no tiene
 * ningún carácter utilizable; el llamador decide el valor por defecto.
 */
export function slugify(title: string): string {
  return title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // marcas diacríticas (á→a, ñ→n, ü→u)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX_LENGTH)
    .replace(/-+$/, "");
}

/**
 * Valida un slug recibido del cliente (parámetro de ruta o formulario) antes
 * de usarlo en una consulta.
 */
export function isValidSlug(slug: unknown): slug is string {
  return (
    typeof slug === "string" &&
    slug.length > 0 &&
    slug.length <= SLUG_MAX_LENGTH &&
    SLUG_PATTERN.test(slug)
  );
}
