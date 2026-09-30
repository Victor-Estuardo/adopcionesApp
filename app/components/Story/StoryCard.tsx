import type { story_category } from "@prisma/client";
import { Link } from "@remix-run/react";
import { LuHeart } from "react-icons/lu";
import { storyImageUrl } from "~/utils/image";
import { formatStoryDate, STORY_CATEGORY_CONFIG } from "~/utils/story-helpers";

/** Datos mínimos de una tarjeta (lo que devuelve `listPublishedStoriesDb`, serializado). */
export type StoryCardData = {
  title: string;
  slug: string;
  category: story_category;
  excerpt: string;
  /** ISO string (serializado desde el loader) o `null`. */
  published_at: string | null;
  cover: { path: string; alt_text: string | null } | null;
};

interface StoryCardProps {
  story: StoryCardData;
  /** Cloud name de Cloudinary (viene del loader). */
  cloudName: string;
  /** `featured`: ancho completo, imagen grande y prioridad de carga. */
  variant?: "featured" | "grid";
  /** Nivel del título según la jerarquía de la página (h2 en listas, h3 en "Más historias"). */
  headingLevel?: 2 | 3;
}

/** Etiqueta de categoría (con ícono solo en Finales felices). */
export function StoryCategoryBadge({ category }: { category: story_category }) {
  const cfg = STORY_CATEGORY_CONFIG[category];
  return (
    <span
      className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${cfg.classes.badge}`}
    >
      {category === "Finales_felices" && (
        <LuHeart
          className={`h-3.5 w-3.5 fill-current ${cfg.classes.badgeIcon}`}
          aria-hidden
        />
      )}
      {cfg.badgeLabel}
    </span>
  );
}

/**
 * Tarjeta de historia. Toda la tarjeta es UN solo enlace al detalle (sin
 * enlaces anidados). El tono depende de la categoría:
 * - Finales felices: elevación leve y zoom mínimo de la portada al pasar el cursor.
 * - Camino al arcoíris: solo cambio sutil de sombra y línea arcoíris superior.
 * Todas las animaciones se desactivan con `prefers-reduced-motion`.
 */
export function StoryCard({
  story,
  cloudName,
  variant = "grid",
  headingLevel = 2,
}: StoryCardProps) {
  const cfg = STORY_CATEGORY_CONFIG[story.category];
  const featured = variant === "featured";
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const href = `${cfg.route}/${story.slug}`;
  const cover = story.cover
    ? storyImageUrl(cloudName, story.cover.path, featured ? "storyCover" : "storyCard")
    : null;
  // Atributo HTML en minúscula: React 18 no reconoce `fetchPriority`.
  const priority = featured
    ? ({ fetchpriority: "high", loading: "eager" } as const)
    : ({ loading: "lazy" } as const);

  return (
    <article className="h-full">
      <Link
        to={href}
        prefetch="intent"
        className={`group flex h-full flex-col overflow-hidden rounded-2xl border border-[#EAE6DC] bg-white shadow-sm motion-reduce:transform-none motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F1D1A] focus-visible:ring-offset-2 ${
          cfg.classes.card
        } ${featured ? "md:flex-row" : ""}`}
      >
        {cfg.classes.accentLine && (
          <div
            className={`${cfg.classes.accentLine} flex-shrink-0 ${
              featured ? "md:hidden" : ""
            }`}
            aria-hidden
          />
        )}

        <div
          className={`relative aspect-[16/10] w-full flex-shrink-0 overflow-hidden bg-[#F4F2EC] ${
            featured ? "md:aspect-auto md:min-h-[320px] md:w-3/5" : ""
          }`}
        >
          {cover ? (
            <img
              src={cover}
              alt={story.cover?.alt_text || story.title}
              width={featured ? 1600 : 640}
              height={featured ? 900 : 400}
              decoding="async"
              {...priority}
              className={`h-full w-full object-cover motion-reduce:transform-none motion-reduce:transition-none ${cfg.classes.cardImage}`}
            />
          ) : (
            <div
              className="flex h-full w-full items-center justify-center text-sm text-[#6B665C]"
              aria-hidden
            >
              Sin foto
            </div>
          )}
          {featured && cfg.classes.accentLine && (
            <div
              className={`${cfg.classes.accentLine} absolute left-0 top-0 hidden md:block`}
              aria-hidden
            />
          )}
        </div>

        <div
          className={`flex flex-1 flex-col gap-2 p-4 ${
            featured ? "md:justify-center md:gap-3 md:p-8" : ""
          }`}
        >
          <StoryCategoryBadge category={story.category} />
          <Heading
            className={`line-clamp-2 font-bold text-[#1F1D1A] ${
              featured ? "text-xl md:text-2xl" : "text-lg"
            }`}
          >
            {story.title}
          </Heading>
          {story.excerpt && (
            <p
              className={`line-clamp-3 text-[#6B665C] ${
                featured ? "text-base" : "text-sm"
              }`}
            >
              {story.excerpt}
            </p>
          )}
          {story.published_at && (
            <time
              dateTime={story.published_at}
              className="mt-auto pt-1 text-xs font-medium text-[#6B665C]"
            >
              {formatStoryDate(story.published_at)}
            </time>
          )}
        </div>
      </Link>
    </article>
  );
}
