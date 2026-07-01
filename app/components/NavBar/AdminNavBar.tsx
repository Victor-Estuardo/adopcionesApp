import { useLocation } from "@remix-run/react";
import { MdMenuOpen } from "react-icons/md";
import { ModuleSession } from "~/services/db/module.service";

interface AdminNavBarProps {
  modules: ModuleSession[];
  profile?: string;
  initials: string;
  onToggleMobile: () => void;
}

export default ({
  onToggleMobile,
  modules,
  initials,
  profile,
}: AdminNavBarProps) => {
  const { pathname } = useLocation();

  // Título derivado del módulo activo (busca coincidencia con la ruta actual)
  const activeModule = modules.find(
    (m) => m.nav_zone === "ADMIN_SIDEBAR" && pathname.startsWith(m.key),
  );

  return (
    <header className="h-20 bg-medium-turquoise-meraki">
      <div className="h-20 md:rounded-tl-[2rem] bg-white flex items-center justify-between px-4 md:px-8 gap-4">
        <button onClick={onToggleMobile} className="md:hidden">
          <MdMenuOpen className="w-6 h-6 rotate-180" />
        </button>
        <h1 className="hidden md:block text-lg md:text-xl font-bold text-gray-800">
          {activeModule?.name}
        </h1>
        <img
          src="/logo-meraki-bn.webp"
          alt="Logo"
          className="md:hidden max-h-10 cursor-pointer"
        />
        {profile ? (
          <img
            src={profile}
            alt="Perfil"
            className="w-9 h-9 md:w-12 md:h-12 rounded-full object-cover"
          />
        ) : (
          <div className="w-9 h-9 md:w-12 md:h-12 rounded-full bg-[#374151] flex items-center justify-center">
            <p className="text-sm text-white font-bold">{initials}</p>
          </div>
        )}
      </div>
    </header>
  );
};
