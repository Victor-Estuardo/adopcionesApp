interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onChangePage: (page: number) => void;
}

export default function Pagination({
  currentPage,
  totalPages,
  onChangePage,
}: PaginationProps) {
  // Generar números de página a mostrar
  const getPageNumbers = (): (number | string)[] => {
    const delta = 2; // Páginas a mostrar antes y después de la actual
    const pages: (number | string)[] = [];
    const rangeStart = Math.max(2, currentPage - delta);
    const rangeEnd = Math.min(totalPages - 1, currentPage + delta);

    // Primera página
    pages.push(1);

    // Ellipsis inicial
    if (rangeStart > 2) {
      pages.push("...");
    }

    // Páginas del rango
    for (let i = rangeStart; i <= rangeEnd; i++) {
      pages.push(i);
    }

    // Ellipsis final
    if (rangeEnd < totalPages - 1) {
      pages.push("...");
    }

    // Última página
    if (totalPages > 1) {
      pages.push(totalPages);
    }

    return pages;
  };

  if (totalPages <= 1) return null;

  return (
    <nav
      className="flex items-center justify-center gap-y-1 gap-x-2"
      aria-label="Paginación"
    >
      {/* Botón Anterior */}
      {currentPage > 1 ? (
        <button
          onClick={() => onChangePage(currentPage - 1)}
          className="flex items-center justify-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:text-gray-900 transition-colors"
          aria-label="Página anterior"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          <span className="ml-1 hidden sm:inline">Anterior</span>
        </button>
      ) : (
        <span className="flex items-center justify-center px-3 py-2 text-sm font-medium text-gray-400 bg-gray-100 border border-gray-200 rounded-lg cursor-not-allowed">
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          <span className="ml-1 hidden sm:inline">Anterior</span>
        </span>
      )}

      {/* Números de página */}
      <div className="flex items-center gap-y-1 gap-x-2">
        {getPageNumbers().map((page, index) => {
          if (page === "...") {
            return (
              <span
                key={`ellipsis-${index}`}
                className="px-3 py-2 text-sm font-medium text-gray-700"
              >
                ...
              </span>
            );
          }

          const pageNumber = page as number;
          const isActive = pageNumber === currentPage;

          return (
            <button
              key={pageNumber}
              onClick={() => onChangePage(pageNumber)}
              className={`
                min-w-[40px] h-10 flex items-center justify-center px-3 py-2 text-sm font-medium rounded-lg transition-colors
                ${
                  isActive
                    ? "bg-blue-meraki text-white border border-blue-meraki"
                    : "text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 hover:text-gray-900"
                }
              `}
              aria-label={`Página ${pageNumber}`}
              aria-current={isActive ? "page" : undefined}
            >
              {pageNumber}
            </button>
          );
        })}
      </div>

      {/* Botón Siguiente */}
      {currentPage < totalPages ? (
        <button
          onClick={() => onChangePage(currentPage + 1)}
          className="flex items-center justify-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:text-gray-900 transition-colors"
          aria-label="Página siguiente"
        >
          <span className="mr-1 hidden sm:inline">Siguiente</span>
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </button>
      ) : (
        <span className="flex items-center justify-center px-3 py-2 text-sm font-medium text-gray-400 bg-gray-100 border border-gray-200 rounded-lg cursor-not-allowed">
          <span className="mr-1 hidden sm:inline">Siguiente</span>
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </span>
      )}
    </nav>
  );
}
