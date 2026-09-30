import type { story_category, story_status } from "@prisma/client";

// Configuración de presentación de las historias. Las clases de Tailwind van
// COMPLETAS (sin concatenar) para que el escáner de `app/**` las incluya.
// Contrastes verificados (texto normal, WCAG AA ≥ 4.5:1):
//   #1F1D1A / peach-meraki 14.8 · #9B2C46 / peach-meraki 6.5 ·
//   #6B665C / peach-meraki 5.0 · #1F1D1A / #F4F2EC 15.0 · #6B665C / #F4F2EC 5.1 ·
//   #57534E / #EDEAE3 6.4 · #1F1D1A / medium-turquoise-meraki 8.4
// pink-meraki y medium-turquoise-meraki NO sirven como color de texto sobre
// blanco: solo fondos con texto oscuro, bordes o íconos decorativos.

// Límites de longitud (= VarChar de la BD). Viven aquí y no en el servicio
// para poder usarlos también en el cliente (contadores del formulario).
export const STORY_TITLE_MAX = 150;
export const STORY_SUMMARY_MAX = 300;
export const STORY_BODY_MAX = 10000;
export const STORY_ALT_MAX = 150;

export const STORY_CATEGORY_CONFIG: Record<
  story_category,
  {
    /** Nombre de la sección / categoría. */
    label: string;
    /** Ruta pública de la lista; el detalle es `${route}/${slug}`. */
    route: "/finales-felices" | "/camino-al-arcoiris";
    sectionTitle: string;
    sectionDescription: string;
    /** Texto de la etiqueta que acompaña cada tarjeta. */
    badgeLabel: string;
    ctaText: string;
    ctaRoute: string;
    classes: {
      /** Fondo del bloque de encabezado de la sección. */
      headerBg: string;
      /** Etiqueta de categoría (fondo + texto con contraste). */
      badge: string;
      /** Ícono decorativo de la etiqueta (aria-hidden). */
      badgeIcon: string;
      /** Tarjeta: sombra/elevación al pasar el cursor. */
      card: string;
      /** Imagen de portada dentro de la tarjeta (`group` en la tarjeta). */
      cardImage: string;
      /** Línea decorativa de 4 px (aria-hidden); `null` si no aplica. */
      accentLine: string | null;
      /** Botón de llamada a la acción. */
      ctaButton: string;
    };
  }
> = {
  Finales_felices: {
    label: "Finales felices",
    route: "/finales-felices",
    sectionTitle: "Finales felices",
    sectionDescription:
      "Adopciones, rescates y segundas oportunidades que terminaron en un hogar lleno de cariño.",
    badgeLabel: "Final feliz",
    ctaText: "Conocer mascotas disponibles",
    ctaRoute: "/",
    classes: {
      headerBg: "bg-peach-meraki",
      badge: "bg-peach-meraki text-[#9B2C46]",
      badgeIcon: "text-pink-meraki",
      card: "transition duration-200 hover:shadow-md motion-safe:hover:-translate-y-0.5",
      cardImage:
        "transition-transform duration-300 motion-safe:group-hover:scale-[1.03]",
      accentLine: null,
      ctaButton:
        "bg-medium-turquoise-meraki text-[#1F1D1A] hover:brightness-95",
    },
  },
  Camino_arcoiris: {
    label: "Camino al arcoíris",
    route: "/camino-al-arcoiris",
    sectionTitle: "Camino al arcoíris",
    sectionDescription:
      "En memoria de quienes no llegaron a encontrar un hogar. Sus historias nos recuerdan por qué seguimos.",
    badgeLabel: "En memoria",
    ctaText: "Apoyar con una donación",
    ctaRoute: "/donacion",
    classes: {
      headerBg: "bg-[#F4F2EC]",
      badge: "bg-[#EDEAE3] text-[#57534E]",
      badgeIcon: "text-[#8C877A]",
      card: "transition-shadow duration-200 hover:shadow-md",
      cardImage: "",
      accentLine:
        "h-1 w-full bg-[linear-gradient(to_right,#F2768C,#FCEDED,#52C9BB,#4674EA)]",
      ctaButton: "bg-[#1F1D1A] text-white hover:bg-[#3A3732]",
    },
  },
};

/** Busca la categoría a partir de su ruta pública. */
export function getStoryCategoryByRoute(
  route: string,
): story_category | undefined {
  return (Object.keys(STORY_CATEGORY_CONFIG) as story_category[]).find(
    (category) => STORY_CATEGORY_CONFIG[category].route === route,
  );
}

// Insignias de estado (admin): texto + color, nunca solo color.
export const STORY_STATUS_CONFIG: Record<
  story_status,
  { label: string; color: string; bg: string; dot: string }
> = {
  Borrador: {
    label: "Borrador",
    color: "text-[#57534E]",
    bg: "bg-[#EDEAE3]",
    dot: "bg-[#8C877A]",
  },
  Publicada: {
    label: "Publicada",
    color: "text-[#1F7A4D]",
    bg: "bg-[#E4F5EC]",
    dot: "bg-[#2FA36B]",
  },
  Archivada: {
    label: "Archivada",
    color: "text-[#6B665C]",
    bg: "bg-[#F0EDE5]",
    dot: "bg-[#A6A092]",
  },
};

export const STORY_CATEGORY_OPTIONS: { value: story_category; label: string }[] =
  (Object.keys(STORY_CATEGORY_CONFIG) as story_category[]).map((value) => ({
    value,
    label: STORY_CATEGORY_CONFIG[value].label,
  }));

export const STORY_STATUS_OPTIONS: { value: story_status; label: string }[] = (
  Object.keys(STORY_STATUS_CONFIG) as story_status[]
).map((value) => ({ value, label: STORY_STATUS_CONFIG[value].label }));

/**
 * Extracto para tarjetas: el `summary` si existe; si no, los primeros `max`
 * caracteres del cuerpo cortados en límite de palabra y terminados en "…".
 */
export function getStoryExcerpt(
  summary: string | null | undefined,
  body: string | null | undefined,
  max = 160,
): string {
  const trimmedSummary = summary?.trim();
  if (trimmedSummary) return trimmedSummary;

  const text = (body ?? "").replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;

  const cut = text.slice(0, max + 1);
  const lastSpace = cut.lastIndexOf(" ");
  // Si no hay espacio razonable (una palabra enorme), se corta a secas.
  const base = lastSpace > max * 0.5 ? cut.slice(0, lastSpace) : text.slice(0, max);
  return `${base.replace(/[\s.,;:!?¡¿-]+$/, "")}…`;
}

/**
 * Fecha en español de Guatemala: "29 de septiembre de 2026". Acepta `Date` o
 * string ISO (lo que llega serializado desde un loader). Devuelve `""` si la
 * fecha no es válida.
 *
 * `dateOnly`: para columnas `@db.Date` (p. ej. `event_date`), que Prisma
 * entrega a medianoche UTC; se formatean en UTC para no mostrar el día
 * anterior. Las marcas de tiempo (`published_at`) se formatean en hora de
 * Guatemala, igual en servidor y cliente (evita desajustes de hidratación).
 */
export function formatStoryDate(
  date: Date | string | null | undefined,
  { dateOnly = false }: { dateOnly?: boolean } = {},
): string {
  if (!date) return "";
  const parsed = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleDateString("es-GT", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: dateOnly ? "UTC" : "America/Guatemala",
  });
}
