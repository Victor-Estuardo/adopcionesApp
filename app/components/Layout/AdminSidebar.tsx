import { NavLink } from "@remix-run/react";
import { Fragment, useMemo } from "react";
import { IconType } from "react-icons";
import { BsClipboard2Heart } from "react-icons/bs";
import { FaPaw, FaUsers } from "react-icons/fa";
import { IoIosLogOut } from "react-icons/io";
import { LuClipboardList } from "react-icons/lu";
import { MdDashboard, MdMenuOpen } from "react-icons/md";
import { ModuleSession } from "~/services/db/module.service";

interface AdminSidebarProps {
  modules: ModuleSession[];
  collapsed: boolean;
  mobileOpen: boolean;
  onToggleCollapse: () => void;
  onCloseMobile: () => void;
}

export default ({
  modules,
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
}: AdminSidebarProps) => {
  // Modulos del dashboard
  const showModules = modules.filter((m) => m.nav_zone === "ADMIN_SIDEBAR");

  // Lista de iconos
  const icons: { [x: string]: IconType } = useMemo(
    () => ({
      MdDashboard: MdDashboard,
      FaPaw: FaPaw,
      BsClipboard2Heart: BsClipboard2Heart,
      LuClipboardList: LuClipboardList,
      FaUsers: FaUsers,
    }),
    [],
  );

  return (
    <Fragment>
      {/* Sidebar de escritorio */}
      <aside
        className={`hidden md:flex flex-col flex-shrink-0 transition-[width] duration-300 bg-medium-turquoise-meraki gap-y-8 ${
          collapsed ? "w-[70px] items-end" : "w-[264px] items-center"
        }`}
      >
        <div
          className={`h-20 w-full flex items-center ${
            collapsed ? "justify-center" : "justify-between px-3"
          }`}
        >
          {!collapsed && (
            <img
              src="/logo-meraki-bn.webp"
              alt="Logo"
              className="max-h-10 cursor-pointer"
            />
          )}
          <MdMenuOpen
            className={`w-8 h-8 ${
              collapsed ? "rotate-180" : ""
            } transition-all duration-300`}
            onClick={onToggleCollapse}
          />
        </div>
        {showModules.map((module) => {
          const Icon = icons[module.icon];

          return (
            <NavLink
              key={module.key}
              to={module.key}
              className={({ isActive }) =>
                `w-[90%] py-2 ${
                  !collapsed
                    ? "flex items-center gap-x-3 px-3 rounded-3xl"
                    : "px-2 rounded-l-3xl"
                } ${isActive ? "bg-white text-medium-turquoise-meraki" : ""}`
              }
            >
              <Icon className="w-8 h-8" />
              {!collapsed && <p>{module.name}</p>}
            </NavLink>
          );
        })}
        <NavLink
          to={"/logout"}
          className={`w-[90%] mt-auto py-2 border-t border-gray-100 ${
            !collapsed ? "flex items-center gap-x-3 px-3" : "px-2"
          }`}
        >
          <IoIosLogOut className="w-8 h-8" />
          {!collapsed && <p>Cerrar Sesión</p>}
        </NavLink>
      </aside>
      {/* Drawer móvil */}
      <div
        className={`fixed inset-0 z-[99] md:hidden ${
          mobileOpen ? "pointer-events-auto" : "pointer-events-none"
        }`}
      >
        <div
          className={`absolute inset-0 bg-black/60 transition-opacity ${
            mobileOpen ? "opacity-100" : "opacity-0"
          }`}
          onClick={onCloseMobile}
        />
        <div
          className={`absolute left-0 top-0 h-full w-3/4 max-w-[300px] bg-white flex flex-col transform transition-transform duration-300 rounded-r-3xl ${
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="h-20 flex items-center justify-between px-6">
            <img src="/logo-meraki-bn.webp" alt="Meraki" className="max-h-9" />
            <span onClick={onCloseMobile} className="text-gray-500">
              X
            </span>
          </div>
          <div className="w-full flex flex-col space-y-4 mt-8 px-3">
            {showModules.map((route) => {
              const Icon = icons[route.icon];
              return (
                <NavLink
                  key={`movil_${route.key}`}
                  to={route.key}
                  className={({ isActive }) =>
                    `w-full flex gap-x-3 px-3 py-2 rounded-3xl  ${
                      isActive ? "bg-medium-turquoise-meraki text-white" : ""
                    }`
                  }
                >
                  <Icon className="w-6 h-6" />
                  {route.name}
                </NavLink>
              );
            })}
          </div>
          <NavLink
            to={"/logout"}
            className="w-full mt-auto py-3 border-t border-gray-100 flex items-center gap-x-3 px-6"
          >
            <IoIosLogOut className="w-6 h-6" />
            <p>Cerrar Sesión</p>
          </NavLink>
        </div>
      </div>
    </Fragment>
  );
};
