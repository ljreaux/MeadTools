import Header from "@/components/account/header";
import { ReactNode } from "react";
import { PagePanel } from "@/components/PagePanel";

function Layout({ children }: { children: ReactNode }) {
  return (
    <PagePanel className="w-11/12 max-w-[1200px] relative px-4 py-6 sm:px-12 sm:py-8">
      <Header />
      {children}
    </PagePanel>
  );
}

export default Layout;
