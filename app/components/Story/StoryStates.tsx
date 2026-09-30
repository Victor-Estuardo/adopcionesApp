import type { story_category } from "@prisma/client";
import { Link } from "@remix-run/react";
import { STORY_CATEGORY_CONFIG } from "~/utils/story-helpers";

const LINK_CLASS =
  "inline-flex min-h-[44px] items-center rounded-full px-5 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F1D1A] focus-visible:ring-offset-2";

/**
 * Estado vacío de una sección pública (RF-P07): mensaje amable y enlaces a la
 * otra sección y a las mascotas disponibles.
 */
export function StoryEmptyState({ category }: { category: story_category }) {
  const other: story_category =
    category === "Finales_felices" ? "Camino_arcoiris" : "Finales_felices";
  const otherCfg = STORY_CATEGORY_CONFIG[other];

  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-[#D6D1C4] bg-white px-6 py-14 text-center">
      <h2 className="text-lg font-bold text-[#1F1D1A]">
        Aún no hay historias publicadas
      </h2>
      <p className="max-w-md text-sm text-[#6B665C]">
        {category === "Finales_felices"
          ? "Pronto compartiremos aquí los finales felices de nuestras adopciones."
          : "Pronto compartiremos aquí historias en memoria de quienes pasaron por el albergue."}
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <Link to="/" className={`${LINK_CLASS} bg-[#1F1D1A] text-white hover:bg-[#3A362E]`}>
          Ver mascotas disponibles
        </Link>
        <Link
          to={otherCfg.route}
          className={`${LINK_CLASS} border border-[#D6D1C4] bg-white text-[#1F1D1A] hover:bg-[#F4F2EC]`}
        >
          Ir a {otherCfg.label}
        </Link>
      </div>
    </div>
  );
}

/**
 * Esqueleto de tarjeta para estados de carga. Es decorativo (`aria-hidden`):
 * el contenedor que lo usa debe anunciar la carga (p. ej. `role="status"`
 * con texto "Cargando historias…" oculto visualmente).
 */
export function StoryCardSkeleton({
  variant = "grid",
}: {
  variant?: "featured" | "grid";
}) {
  const featured = variant === "featured";
  return (
    <div
      aria-hidden
      className={`flex animate-pulse flex-col overflow-hidden rounded-2xl border border-[#EAE6DC] bg-white motion-reduce:animate-none ${
        featured ? "md:flex-row" : ""
      }`}
    >
      <div
        className={`aspect-[16/10] w-full bg-[#EDEAE3] ${
          featured ? "md:aspect-auto md:min-h-[320px] md:w-3/5" : ""
        }`}
      />
      <div className={`flex flex-1 flex-col gap-3 p-4 ${featured ? "md:p-8" : ""}`}>
        <div className="h-5 w-24 rounded-full bg-[#EDEAE3]" />
        <div className="h-5 w-4/5 rounded bg-[#EDEAE3]" />
        <div className="h-4 w-full rounded bg-[#F4F2EC]" />
        <div className="h-4 w-2/3 rounded bg-[#F4F2EC]" />
        <div className="mt-2 h-3 w-28 rounded bg-[#F4F2EC]" />
      </div>
    </div>
  );
}
