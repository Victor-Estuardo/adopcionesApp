import { LinksFunction } from "@remix-run/node";
import styles from "./styles/app.css";
import {
  isRouteErrorResponse,
  Links,
  LiveReload,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useRouteError,
} from "@remix-run/react";
import { Toaster } from "sonner";
import { ErrorPage } from "~/components/Alerts/ErrorPage";

export const links: LinksFunction = () => [{ rel: "stylesheet", href: styles }];

export default function App() {
  return (
    <html lang="es">
      <head>
        <meta charSet="utf-8" />
        <meta
          name="viewport"
          content="width=device-width,initial-scale=1 ,maximum-scale=1.0,interactive-widget=resizes-content"
        />
        <Meta />
        <Links />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Nunito:wght@200..1000&display=swap"
        />

        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Open+Sans:wght@300&display=swap"
        />
      </head>
      <body className="h-screen w-screen font-nunito">
        <Outlet />
        <Toaster position="top-center" richColors />
        <ScrollRestoration />
        <Scripts />
        <LiveReload />
      </body>
    </html>
  );
}

/*==============================| Error Boundary |==============================*/
// Errores que ninguna ruta atrapó (p. ej. una URL que no existe). Reemplaza el
// documento completo, por eso incluye su propio <html> y los estilos.
export function ErrorBoundary() {
  const error = useRouteError();
  const notFound = isRouteErrorResponse(error) && error.status === 404;

  return (
    <html lang="es">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <title>
          {notFound
            ? "Página no encontrada | Asociación Meraki"
            : "Error | Asociación Meraki"}
        </title>
        <Links />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Nunito:wght@200..1000&display=swap"
        />
      </head>
      <body className="font-nunito">
        {notFound ? (
          <ErrorPage
            title="Página no encontrada"
            description="La página que buscas no existe o fue movida."
            actions={[{ label: "Volver al inicio", href: "/", primary: true }]}
          />
        ) : (
          <ErrorPage
            title="Algo salió mal"
            description={
              process.env.NODE_ENV === "production"
                ? "Ocurrió un error inesperado. Por favor, intenta de nuevo."
                : String(error)
            }
            actions={[{ label: "Volver al inicio", href: "/", primary: true }]}
          />
        )}
        <Scripts />
      </body>
    </html>
  );
}
