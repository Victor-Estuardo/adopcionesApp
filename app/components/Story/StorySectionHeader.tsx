import type { story_category } from "@prisma/client";
import { LuHeart } from "react-icons/lu";
import { STORY_CATEGORY_CONFIG } from "~/utils/story-helpers";

interface StorySectionHeaderProps {
  category: story_category;
}

/**
 * Encabezado de la sección pública: título `h1` (único en la página), línea
 * de propósito y adorno decorativo por categoría (`aria-hidden`):
 * corazones en Finales felices, línea arcoíris en Camino al arcoíris.
 */
export function StorySectionHeader({ category }: StorySectionHeaderProps) {
  const cfg = STORY_CATEGORY_CONFIG[category];

  return (
    <header
      className={`relative overflow-hidden rounded-2xl border border-[#EAE6DC] ${cfg.classes.headerBg}`}
    >
      {cfg.classes.accentLine && (
        <div className={cfg.classes.accentLine} aria-hidden />
      )}

      {category === "Finales_felices" && (
        <div
          className="pointer-events-none absolute -right-2 -top-2 flex gap-2 opacity-80 sm:right-6 sm:top-4"
          aria-hidden
        >
          <LuHeart className="h-10 w-10 rotate-12 fill-current text-pink-meraki sm:h-14 sm:w-14" />
          <LuHeart className="mt-6 h-6 w-6 -rotate-12 fill-current text-medium-turquoise-meraki sm:h-8 sm:w-8" />
        </div>
      )}

      <div className="relative flex flex-col gap-2 px-5 py-8 sm:px-8 sm:py-10">
        <h1 className="max-w-[80%] break-words text-2xl font-extrabold text-[#1F1D1A] sm:text-3xl">
          {cfg.sectionTitle}
        </h1>
        <p className="max-w-2xl text-base text-[#6B665C]">
          {cfg.sectionDescription}
        </p>
      </div>
    </header>
  );
}
