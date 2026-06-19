import { json, LoaderFunction, redirect } from "@remix-run/node";
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
  const url = new URL(request.url);

  // Datos de la sesión
  const modules: ModuleSession[] = session.get("modules");
  const first_name = session.get("first_name") || "";
  const last_name = session.get("last_name") || "";
  const profile = session.get("profile");
  const profileV = session.get("profile_v");
  const baseProfile = `https://res.cloudinary.com/${config.cloudinaryCloudName}/image/upload`;

  if (!modules) {
    // Si es una visita publica se lista solo los modulos publicos
    const publicModuleListRes = await listModulesForSessionDb({
      is_active: true,
      nav_audience: { in: ["ALL"] },
    });

    if (publicModuleListRes.success) {
      session.set("modules", publicModuleListRes.data);

      return redirect(url.pathname, {
        headers: {
          "Set-Cookie": await commitSession(session),
        },
      });
    }
  }

  // Creamos las iniciales del usuario
  const initials =
    first_name?.charAt(0).toUpperCase() + last_name?.charAt(0).toUpperCase();

  return json({
    modules,
    initials,
    profile: profile ? `${baseProfile}/v${profileV}/${profile}` : undefined,
    isLoggenIn: !!session.get("dbUserId"),
  });
};

/*==============================| Error Boundary |==============================*/
export function ErrorBoundary() {
  const route = useLocation().pathname;
  const error = useRouteError();

  //Esto es lo que usualmente va hacia `CatchBoundary`
  if (isRouteErrorResponse(error)) {
    return (
      <ErrorBoundaryAlert
        title={`CatchBoundary - ${error.status} - app/routes${route}`}
        description={error.data.message}
      />
    );
  }

  return (
    <ErrorBoundaryAlert
      title={`Error - app/routes${route}`}
      description={error?.toString() ?? ""}
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
    >
      <Outlet />
    </PublicLayout>
  );
};
