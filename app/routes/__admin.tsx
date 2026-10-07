import { json, LoaderFunction } from "@remix-run/node";
import {
  useRouteError,
  useRouteLoaderData,
  Outlet,
  useLoaderData,
} from "@remix-run/react";
import { useEffect, useState } from "react";
import { RouteErrorPage } from "~/components/Alerts/ErrorPage";
import AdminLayout from "~/components/Layout/AdminLayout";
import { config } from "~/config";
import { ModuleSession } from "~/services/db/module.service";
import { getSession } from "~/services/sessions/sessions.service";

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
  const baseProfile = `https://res.cloudinary.com/${config.cloudinaryCloudName}/image/upload`;

  const initials =
    first_name?.charAt(0).toUpperCase() + last_name?.charAt(0).toUpperCase();

  return json({
    modules,
    initials,
    profile: profile ? `${baseProfile}/v${profileV}/${profile}` : undefined,
    isLoggedIn: !!session.get("dbUserId"),
  });
};

/*==============================| Error Boundary |==============================*/
export function ErrorBoundary() {
  const error = useRouteError();
  const loaderData = useRouteLoaderData("routes/__admin") as
    | { isLoggedIn?: boolean }
    | undefined;

  return (
    <RouteErrorPage error={error} isLoggedIn={!!loaderData?.isLoggedIn} />
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
    <AdminLayout
      modules={data.modules}
      initials={data.initials}
      profile={data.profile}
    >
      <Outlet />
    </AdminLayout>
  );
};
