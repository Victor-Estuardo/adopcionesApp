import { isRouteErrorResponse, useLocation } from "@remix-run/react";
import { useEffect } from "react";
import { NO_PERMISSION_MESSAGE } from "~/utils/common";

type ErrorAction = { label: string; href: string; primary?: boolean };

type ErrorPageProps = {
  title: string;
  description: string;
  actions?: ErrorAction[];
};

/**
 * Página de error a pantalla completa con la identidad del sitio. La usan los
 * `ErrorBoundary` de la raíz, del sitio público y del panel de administración.
 */
export function ErrorPage({ title, description, actions = [] }: ErrorPageProps) {
  // Los ErrorBoundary de layout no pueden usar `meta`: se pone el título aquí
  useEffect(() => {
    document.title = `${title} | Asociación Meraki`;
  }, [title]);

  return (
    <main
      role="alert"
      className="min-h-screen w-full flex flex-col items-center justify-center gap-y-6 bg-gray-50 px-6 py-10 text-center"
    >
      <a href="/" aria-label="Ir al inicio">
        <img src="/logo-meraki-bn.webp" alt="Asociación Meraki" className="h-12" />
      </a>
      <div className="flex max-w-md flex-col gap-y-2">
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        <p className="text-gray-600">{description}</p>
      </div>
      {actions.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-3">
          {actions.map((action) => (
            <a
              key={action.href + action.label}
              href={action.href}
              className={
                action.primary
                  ? "rounded-full bg-medium-turquoise-meraki px-5 py-2 text-white"
                  : "rounded-full border border-gray-300 bg-white px-5 py-2 text-gray-700 hover:bg-gray-100"
              }
            >
              {action.label}
            </a>
          ))}
        </div>
      )}
    </main>
  );
}

/**
 * Convierte el error de una ruta en una `ErrorPage` entendible:
 * - Sin permiso y sin sesión: invita a iniciar sesión y regresar a la página.
 * - Sin permiso con sesión: avisa que la cuenta no tiene acceso.
 * - Otro 404: muestra el mensaje de la ruta (ya está redactado para el usuario).
 * - Cualquier otro error: mensaje genérico (el detalle solo se ve en desarrollo).
 */
export function RouteErrorPage({
  error,
  isLoggedIn,
}: {
  error: unknown;
  isLoggedIn: boolean;
}) {
  const { pathname } = useLocation();

  if (isRouteErrorResponse(error)) {
    const message =
      typeof error.data === "string" ? error.data : error.data?.message;

    if (message === NO_PERMISSION_MESSAGE) {
      if (!isLoggedIn) {
        return (
          <ErrorPage
            title="Inicia sesión para continuar"
            description="Necesitas iniciar sesión para ver esta página."
            actions={[
              {
                label: "Iniciar sesión",
                href: `/iniciar-sesion?redirect=${encodeURIComponent(pathname)}`,
                primary: true,
              },
              { label: "Volver al inicio", href: "/" },
            ]}
          />
        );
      }

      return (
        <ErrorPage
          title="No tienes acceso a esta sección"
          description="Tu cuenta no tiene permiso para ver esta página."
          actions={[{ label: "Volver al inicio", href: "/", primary: true }]}
        />
      );
    }

    if (error.status === 404) {
      return (
        <ErrorPage
          title="No encontramos lo que buscas"
          description={
            message && message !== "Not Found"
              ? message
              : "La página que buscas no existe o fue movida."
          }
          actions={[{ label: "Volver al inicio", href: "/", primary: true }]}
        />
      );
    }
  }

  return (
    <ErrorPage
      title="Algo salió mal"
      description={
        process.env.NODE_ENV === "production"
          ? "Ocurrió un error inesperado. Por favor, intenta de nuevo."
          : String(error)
      }
      actions={[{ label: "Volver al inicio", href: "/", primary: true }]}
    />
  );
}
