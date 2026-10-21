import { PagePanel } from "@/components/PagePanel";

export const CardWrapper = ({ children }: { children: React.ReactNode }) => {
  return (
    <PagePanel className="flex flex-col md:p-12 p-8 gap-4 w-11/12 max-w-[1200px]">
      <div className="flex flex-col gap-2 h-full w-full mx-auto">
        {children}
      </div>
    </PagePanel>
  );
};
