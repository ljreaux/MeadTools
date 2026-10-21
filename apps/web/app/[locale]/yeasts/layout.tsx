import { PagePanel } from "@/components/PagePanel";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full flex justify-center items-center sm:py-24 py-[6rem] relative">
      <PagePanel className="flex flex-col md:p-12 p-8 gap-4 w-11/12 max-w-[1000px]">
        {children}
      </PagePanel>
    </div>
  );
}
