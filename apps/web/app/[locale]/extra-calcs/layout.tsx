import ExtraCalcsSideBar from "@/components/extraCalcs/Sidebar";
import { PagePanel } from "@/components/PagePanel";

function ExtraCalcsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full flex justify-center items-center sm:pt-24 py-[6rem] relative">
      <ExtraCalcsCard>{children}</ExtraCalcsCard>
    </div>
  );
}

export default ExtraCalcsLayout;

const ExtraCalcsCard = ({ children }: { children: React.ReactNode }) => (
  <PagePanel className="flex flex-col md:p-12 p-8 gap-4 w-11/12 max-w-[1200px]">
    <ExtraCalcsSideBar />
    {children}
  </PagePanel>
);
