import { json, LoaderFunction } from "@remix-run/node";
import {
  NavLink,
  Outlet,
  useLoaderData,
  useLocation,
  useNavigate,
  useRouteLoaderData,
} from "@remix-run/react";
import { BsClipboard2Heart } from "react-icons/bs";
import { LuUser, LuLogOut, LuHeart } from "react-icons/lu";
import { ModuleSession } from "~/services/db/module.service";
import { getSession } from "~/services/sessions/sessions.service";
import { IconType } from "react-icons";

export const meta = () => {
  return [{ title: "Mi cuenta | Asociación Meraki" }];
};

/*==============================| Loader Function |==============================*/
export const loader: LoaderFunction = async ({ request }) => {
  const cookie = request.headers.get("Cookie");
  const session = await getSession(cookie);

  // Obtenemos el nombre del usuario
  const username = [session.get("first_name"), session.get("last_name")].join(
    " ",
  );

  return json({
    username,
  });
};

const ModuleIcons: { [x: string]: IconType } = {
  LuUser: LuUser,
  BsClipboard2Heart: BsClipboard2Heart,
  LuHeart: LuHeart,
};

/*==============================| Component |==============================*/
export default function () {
  //Hooks..
  const routeData = useRouteLoaderData("routes/__public");
  const { username } = useLoaderData<{
    username: string;
  }>();
  const location = useLocation();
  const navigate = useNavigate();

  // Datos del usuario
  const initials = routeData?.initials || "";

  // Modulos a mostrar
  const modules = routeData.modules.filter(
    (module: ModuleSession) =>
      module.nav_zone === "ACCOUNT" && module.key !== "/mi-cuenta",
  );

  // En móvil: si estamos en una sub-ruta, ocultamos el sidebar y solo mostramos el Outlet
  const isIndex =
    location.pathname === "/mi-cuenta" || location.pathname === "/mi-cuenta/";

  return (
    <>
      <div className="hidden w-full h-full p-5 md:flex overflow-y-auto">
        {/* Desktop: sidebar fijo + panel derecho */}
        {Sidebar(username, initials, modules)}
        <Outlet />
      </div>
      <div className="md:hidden w-full h-full p-5 flex flex-col gap-y-5 overflow-y-auto">
        {/* Móvil: menú O sub-ruta, nunca los dos */}
        {isIndex ? (
          Sidebar(username, initials, modules)
        ) : (
          <>
            <div className="shrink-0 flex items-center gap-2 px-4 py-3 border-b bg-white">
              <button
                onClick={() => navigate(-1)}
                className="flex items-center gap-1 text-sm text-gray-600"
              >
                ‹ Regresar
              </button>
            </div>
            <Outlet />
          </>
        )}
      </div>
    </>
  );
}

function Sidebar(username: string, initials: string, modules: ModuleSession[]) {
  return (
    <aside className="shrink-0 w-full md:w-[350px] h-full md:border-r-2 md:border-gray-200 overflow-y-auto">
      {/* Usuario */}
      <div className="flex gap-x-4 py-4 border-b md:border-b-0 border-gray-200">
        <div className="w-16 h-16 rounded-full bg-[#374151] flex justify-center items-center">
          <p className="text-xl text-white font-bold">{initials}</p>
        </div>
        <div>
          <p>Hola</p>
          <strong className="capitalize">{username}</strong>
          <p>Bienvenido a tu cuenta</p>
        </div>
      </div>

      {/* Links */}
      <nav className="divide-y md:divide-y-0">
        {modules.map(({ key, name, icon }) => {
          const Icon = ModuleIcons[icon];
          return (
            <NavLink
              key={key}
              to={key}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-5 rounded-md transition-colors
              ${
                isActive
                  ? "bg-medium-turquoise-meraki/40 text-blue-meraki font-bold border-l-2 border-blue-meraki"
                  : "text-gray-600 hover:bg-gray-100"
              }`
              }
            >
              <Icon size={16} />
              {name}
              <span className="md:hidden flex-grow text-end text-gray-400">
                ›
              </span>
            </NavLink>
          );
        })}

        <NavLink
          to={"/logout"}
          className="w-full flex items-center gap-3 px-3 py-5 text-gray-600 hover:bg-gray-100 rounded-md pt-4"
        >
          <LuLogOut size={16} />
          Cerrar sesión
        </NavLink>
      </nav>
    </aside>
  );
}
