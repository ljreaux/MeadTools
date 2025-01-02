import ExtraCalcsSideBar from "@/components/extraCalcs/Sidebar";

function ExtraCalcsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full flex justify-center items-center sm:pt-24 pt-[6rem] relative">
      <ExtraCalcsCard>{children}</ExtraCalcsCard>
    </div>
  );
}

export default ExtraCalcsLayout;

const ExtraCalcsCard = ({ children }: { children: React.ReactNode }) => (
  <div className="flex flex-col md:p-12 p-8 rounded-xl bg-background gap-4 w-11/12 max-w-[1000px]">
    <ExtraCalcsSideBar />
    {children}
  </div>
);
