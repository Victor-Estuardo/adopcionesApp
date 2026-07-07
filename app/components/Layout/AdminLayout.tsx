import { useState } from "react";
import { ModuleSession } from "~/services/db/module.service";
import AdminSidebar from "./AdminSidebar";
import AdminNavBar from "../NavBar/AdminNavBar";

interface AdminLayoutProps {
  modules: ModuleSession[];
  initials: string;
  profile?: string;
  children: React.ReactNode;
}

export default ({ modules, initials, profile, children }: AdminLayoutProps) => {
  const [collapsed, setCollapsed] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="w-screen h-screen flex">
      <AdminSidebar
        modules={modules}
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onToggleCollapse={() => setCollapsed((prev) => !prev)}
        onCloseMobile={() => setMobileOpen(false)}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <AdminNavBar
          initials={initials}
          profile={profile}
          onToggleMobile={() => setMobileOpen(true)}
          modules={modules}
        />
        <main className="flex-1 border-t border-gray-100 overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  );
};
