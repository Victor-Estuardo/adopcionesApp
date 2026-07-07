import { NavLink, useNavigate } from "@remix-run/react";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { FaUserCircle } from "react-icons/fa";
import { MdMenuOpen } from "react-icons/md";
import { ModuleSession } from "~/services/db/module.service";

interface TopNavProps {
  modules?: ModuleSession[];
  isLoggedIn: boolean;
  profile: string;
  initials: string;
  administrative: boolean;
}

export default ({
  modules = [],
  isLoggedIn,
  initials,
  profile,
  administrative,
}: TopNavProps) => {
  // hooks...
  const navigate = useNavigate();

  // Modulos que irian en el top bar
  const topModules = useMemo(
    () => modules.filter((m) => m.nav_zone === "TOPBAR"),
    [modules],
  );

  // Bandera para vista de menu
  const [showMenu, setShowMenu] = useState(false);

  // Referencias
  const menuIconRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Cerrar menú si se hace click fuera del panel
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current &&
        menuIconRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        !menuIconRef.current.contains(event.target as Node)
      ) {
        setShowMenu(false);
      }
    };
    if (showMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    } else {
      document.removeEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showMenu]);

  // Devolvemos un objeto
  const IconProfile = () => {
    const route = administrative ? "/dashboard" : "/mi-cuenta";

    if (profile) {
      return (
        <NavLink to={route}>
          <img
            alt="Imagen de perfil"
            src={profile}
            className="w-9 h-9 md:w-12 md:h-12 rounded-full"
          />
        </NavLink>
      );
    }

    if (initials) {
      return (
        <NavLink to={route}>
          <div className="w-9 h-9 md:w-12 md:h-12 rounded-full bg-[#374151] flex justify-center items-center">
            <p className="text-base text-white font-bold">{initials}</p>
          </div>
        </NavLink>
      );
    }

    return (
      <NavLink to={route}>
        <FaUserCircle className="w-9 h-9 md:w-12 md:h-12" />
      </NavLink>
    );
  };

  return (
    <Fragment>
      <nav className="w-full h-20 bg-white">
        <div className="w-full h-full flex justify-between items-center px-3 md:px-6 gap-x-6 md:rounded-tl-[2rem] bg-white shadow-md">
          <div ref={menuIconRef} className="block md:hidden">
            <MdMenuOpen
              className={`w-6 h-6 cursor-pointer transform transition-transform duration-300 ${
                showMenu ? "" : "rotate-180"
              }`}
              onClick={() => setShowMenu((prev) => !prev)}
            />
          </div>
          <img
            src="/logo-meraki-bn.webp"
            alt="Logo"
            className="max-h-10 cursor-pointer"
            onClick={() => navigate("/")}
          />
          <div className="hidden md:flex gap-x-10 font-[700]">
            {topModules.map((route) => (
              <NavLink
                key={route.key}
                to={route.key}
                className={({ isActive }) =>
                  `hover:underline hover:underline-offset-8 ${
                    isActive ? "underline underline-offset-8" : ""
                  }`
                }
              >
                {route.name}
              </NavLink>
            ))}
          </div>
          {!isLoggedIn ? (
            <NavLink to={isLoggedIn ? "/mi-cuenta" : "iniciar-sesion"}>
              <FaUserCircle className="w-6 h-6 md:w-8 md:h-8" />
            </NavLink>
          ) : (
            <IconProfile />
          )}
        </div>
      </nav>
      <div
        className={`fixed bottom-0 left-0 ${
          showMenu ? "w-screen h-[calc(100dvh-5rem)]" : "w-0 h-0"
        } flex justify-start items-center bg-black/60 z-[99]`}
      >
        <div
          className={`${
            showMenu ? "-translate-x-0" : "-translate-x-full"
          } transform transition-transform duration-300 w-3/4 md:w-[300px] h-full bg-white flex flex-col`}
          ref={menuRef}
        >
          <div className="w-full flex flex-col space-y-4 mt-8 px-3">
            {topModules.map((route) => (
              <NavLink
                key={`movil_${route.key}`}
                to={route.key}
                className={({ isActive }) =>
                  `w-full px-3 py-2 rounded-3xl  ${
                    isActive ? "bg-gray-200" : ""
                  }`
                }
                onClick={() => setShowMenu(false)}
              >
                {route.name}
              </NavLink>
            ))}
          </div>
        </div>
      </div>
    </Fragment>
  );
};
