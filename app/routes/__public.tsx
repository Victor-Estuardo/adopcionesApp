import { json, LoaderFunction } from "@remix-run/node";
import {
  useRouteError,
  isRouteErrorResponse,
  useLocation,
  Outlet,
  useLoaderData,
} from "@remix-run/react";
import { useEffect, useState } from "react";
import { ErrorBoundaryAlert } from "~/components/Alerts/ErrorBoundaryAlert";
import PublicLayout from "~/components/Layout/publicLayout";
import { config } from "~/config";
import {
  listModulesForSessionDb,
  ModuleSession,
} from "~/services/db/module.service";
import {
  commitSession,
  getSession,
} from "~/services/sessions/sessions.service";

/*==============================| Loader Function |==============================*/
export const loader: LoaderFunction = async ({ request }) => {
  // Datos de navegación
  const cookie = request.headers.get("Cookie");
  const session = await getSession(cookie);

  // Datos de la sesión
  const modules: ModuleSession[] = session.get("modules");
  const first_name = session.get("first_name") || "";
  const last_name = session.get("last_name") || "";
  const profile = session.get("profile");
  const profileV = session.get("profile_v");
  const baseCloud = `https://res.cloudinary.com/${config.cloudinaryCloudName}/image/upload`;

  // Creamos las iniciales del usuario
  const initials =
    first_name?.charAt(0).toUpperCase() + last_name?.charAt(0).toUpperCase();

  if (!modules) {
    // Si es una visita publica se lista solo los modulos publicos
    const publicModuleListRes = await listModulesForSessionDb({
      is_active: true,
      nav_audience: { in: ["ALL"] },
    });

    if (publicModuleListRes.success) {
      session.set("modules", publicModuleListRes.data);

      return json(
        {
          modules,
          initials,
          profile: profile ? `${baseCloud}/v${profileV}/${profile}` : undefined,
          isLoggenIn: !!session.get("dbUserId"),
        },
        {
          headers: {
            "Set-Cookie": await commitSession(session),
          },
        },
      );
    }
  }

  return json({
    modules,
    initials,
    profile: profile ? `${baseCloud}/v${profileV}/${profile}` : undefined,
    isLoggenIn: !!session.get("dbUserId"),
    administrative: session.get("administrative") === true,
  });
};

/*==============================| Error Boundary |==============================*/
export function ErrorBoundary() {
  const route = useLocation().pathname;
  const error = useRouteError();

  //Esto es lo que usualmente va hacia `CatchBoundary`
  if (isRouteErrorResponse(error)) {
    // Si el error.data es string se usa caso contrario se busca message
    const errorMsg =
      typeof error.data === "string" ? error.data : error.data.message;

    return (
      <ErrorBoundaryAlert
        title={`CatchBoundary - ${error.status} - ${route}`}
        description={errorMsg}
      />
    );
  }

  return (
    <ErrorBoundaryAlert
      title={`Error - ${route}`}
      description={
        process.env.NODE_ENV === "production"
          ? "Ocurrió un error inesperado. Por favor, intenta de nuevo."
          : error?.toString() ?? ""
      }
    />
  );
}

export default () => {
  // Hooks...
  const data = useLoaderData();

  // Bandera para saber cuando este listo el componente
  const [isDomLoaded, setIsDomLoaded] = useState(false);

  /*------------------------------ESCUCHAS------------------------------*/
  useEffect(() => {
    setIsDomLoaded(true);
  }, []);

  if (!isDomLoaded) return <main></main>;

  return (
    <PublicLayout
      modules={data.modules}
      initials={data.initials}
      profile={data.profile}
      isLoggenIn={data.isLoggenIn}
      administrative={data.administrative}
    >
      <Outlet />
    </PublicLayout>
  );
};
