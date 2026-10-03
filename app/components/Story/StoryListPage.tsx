import type { SerializeFrom } from "@remix-run/node";
import { useLocation, useNavigate, useNavigation } from "@remix-run/react";
import { useEffect, useRef } from "react";
import Pagination from "~/components/Pagination";
import { DataErrorState } from "~/components/State/DataStates";
import type { StoryListLoader } from "~/utils/story-routes.server";
import { StoryCard } from "./StoryCard";
import { StorySectionHeader } from "./StorySectionHeader";
import { StoryCardSkeleton, StoryEmptyState } from "./StoryStates";

const PAGE_BG = {
  Finales_felices: "bg-white",
  Camino_arcoiris: "bg-[#F4F2EC]",
} as const;

/**
 * Página de lista de una sección pública (RF-P01…P07): encabezado, primera
 * historia de la primera página destacada, cuadrícula 1/2/3 columnas y
 * paginación. Tiene su propio contenedor con scroll porque el `<main>` del
 * layout público es `overflow-hidden`.
 */
export function StoryListPage({ data }: { data: SerializeFrom<StoryListLoader> }) {
  const { category, items, page, totalPages, error, cloudName } = data;
  const navigate = useNavigate();
  const navigation = useNavigation();
  const location = useLocation();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Cambiando de página dentro de esta misma lista.
  const isPaging =
    navigation.state === "loading" &&
    navigation.location?.pathname === location.pathname;

  // El scroll vive en el contenedor, no en la ventana: volver arriba al
  // cambiar de página.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [page]);

  const featured = page === 1 ? items[0] : undefined;
  const grid = featured ? items.slice(1) : items;

  const goToPage = (next: number) =>
    navigate(next > 1 ? `?page=${next}` : location.pathname);

  return (
    <div ref={scrollRef} className={`h-full w-full overflow-y-auto ${PAGE_BG[category]}`}>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-6 sm:px-6 lg:py-10">
        <StorySectionHeader category={category} />

        {error ? (
          <DataErrorState message="No pudimos cargar las historias. Revisa tu conexión y vuelve a intentarlo." />
        ) : isPaging ? (
          <div role="status" className="flex flex-col gap-6">
            <span className="sr-only">Cargando historias…</span>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }, (_, i) => (
                <StoryCardSkeleton key={i} />
              ))}
            </div>
          </div>
        ) : items.length === 0 ? (
          <StoryEmptyState category={category} />
        ) : (
          <>
            {featured && (
              <StoryCard story={featured} cloudName={cloudName} variant="featured" />
            )}
            {grid.length > 0 && (
              <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {grid.map((story) => (
                  <li key={story.id}>
                    <StoryCard story={story} cloudName={cloudName} />
                  </li>
                ))}
              </ul>
            )}
            <Pagination currentPage={page} totalPages={totalPages} onChangePage={goToPage} />
          </>
        )}
      </div>
    </div>
  );
}
