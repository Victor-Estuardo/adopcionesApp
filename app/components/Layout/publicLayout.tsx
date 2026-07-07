import { ModuleSession } from "~/services/db/module.service";
import TopNav from "../NavBar/top";

interface MainLayoutProps {
  modules: ModuleSession[];
  initials: string;
  profile: string;
  isLoggenIn?: boolean;
  children: React.ReactNode;
  administrative?: boolean;
}

export default ({
  modules,
  children,
  initials = "",
  profile = "",
  isLoggenIn = false,
  administrative = false,
}: MainLayoutProps) => {
  return (
    <>
      <TopNav
        modules={modules}
        isLoggedIn={isLoggenIn}
        profile={profile}
        initials={initials}
        administrative={administrative}
      />
      <main className="w-screen h-[calc(100dvh-5rem)] overflow-hidden">
        {children}
      </main>
    </>
  );
};
