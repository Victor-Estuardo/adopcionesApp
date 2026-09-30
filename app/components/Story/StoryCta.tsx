import type { story_category } from "@prisma/client";
import { Link } from "@remix-run/react";
import { LuArrowRight } from "react-icons/lu";
import { STORY_CATEGORY_CONFIG } from "~/utils/story-helpers";

interface StoryCtaProps {
  category: story_category;
  /** Nivel del título según la jerarquía de la página. */
  headingLevel?: 2 | 3;
}

const COPY: Record<story_category, { heading: string; text: string; bg: string }> = {
  Finales_felices: {
    heading: "Hay más finales felices esperando empezar",
    text: "Conoce a las mascotas que todavía buscan un hogar. Quizá la próxima historia sea la tuya.",
    bg: "bg-peach-meraki",
  },
  Camino_arcoiris: {
    heading: "Su memoria nos impulsa a seguir",
    text: "Tu donación ayuda a cuidar a quienes siguen en el albergue mientras encuentran un hogar.",
    bg: "bg-[#F4F2EC]",
  },
};

/**
 * Bloque de llamada a la acción al final del detalle: Finales felices →
 * mascotas disponibles (`/`); Camino al arcoíris → donaciones (`/donacion`).
 * Se usa un `Link` con aspecto de botón: `PrimaryButton` es un `<button>`
 * con texto blanco sobre turquesa, que no llega a 4.5:1.
 */
export function StoryCta({ category, headingLevel = 2 }: StoryCtaProps) {
  const cfg = STORY_CATEGORY_CONFIG[category];
  const copy = COPY[category];
  const Heading = headingLevel === 2 ? "h2" : "h3";

  return (
    <section
      className={`flex flex-col items-start gap-3 rounded-2xl border border-[#EAE6DC] p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8 ${copy.bg}`}
    >
      <div className="flex max-w-xl flex-col gap-1">
        <Heading className="text-lg font-bold text-[#1F1D1A] sm:text-xl">
          {copy.heading}
        </Heading>
        <p className="text-sm text-[#57534E] sm:text-base">{copy.text}</p>
      </div>
      <Link
        to={cfg.ctaRoute}
        className={`inline-flex min-h-[44px] flex-shrink-0 items-center gap-2 rounded-full px-5 text-sm font-semibold transition motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F1D1A] focus-visible:ring-offset-2 sm:text-base ${cfg.classes.ctaButton}`}
      >
        {cfg.ctaText}
        <LuArrowRight className="h-4 w-4" aria-hidden />
      </Link>
    </section>
  );
}
