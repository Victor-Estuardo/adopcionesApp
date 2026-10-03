import { isRouteErrorResponse, Link, useRouteError } from "@remix-run/react";
import { STORY_CATEGORY_CONFIG } from "~/utils/story-helpers";

const LINK_CLASS =
  "inline-flex min-h-[44px] items-center rounded-full px-5 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F1D1A] focus-visible:ring-offset-2";

/**
 * ErrorBoundary de las rutas públicas de historias: 404 amable dentro del
 * layout público (en vez del aviso técnico del layout) y mensaje genérico
 * para otros errores (SEG-11).
 */
export function StoryRouteError() {
  const error = useRouteError();
  const isNotFound = isRouteErrorResponse(error) && error.status === 404;

  if (!isRouteErrorResponse(error)) {
    console.error(error);
  }

  return (
    <div className="h-full w-full overflow-y-auto bg-[#F4F2EC]">
      <div className="mx-auto flex max-w-xl flex-col items-center gap-4 px-4 py-16 text-center">
        <h1 className="text-2xl font-extrabold text-[#1F1D1A]">
          {isNotFound ? "No encontramos esta historia" : "Algo salió mal"}
        </h1>
        <p className="text-base text-[#6B665C]">
          {isNotFound
            ? "Puede que el enlace esté mal escrito o que la historia ya no esté disponible."
            : "Ocurrió un error inesperado. Por favor, intenta de nuevo en unos minutos."}
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link
            to={STORY_CATEGORY_CONFIG.Finales_felices.route}
            className={`${LINK_CLASS} bg-[#1F1D1A] text-white hover:bg-[#3A362E]`}
          >
            Ver {STORY_CATEGORY_CONFIG.Finales_felices.label}
          </Link>
          <Link
            to={STORY_CATEGORY_CONFIG.Camino_arcoiris.route}
            className={`${LINK_CLASS} border border-[#D6D1C4] bg-white text-[#1F1D1A] hover:bg-[#EDEAE3]`}
          >
            Ver {STORY_CATEGORY_CONFIG.Camino_arcoiris.label}
          </Link>
        </div>
      </div>
    </div>
  );
}
