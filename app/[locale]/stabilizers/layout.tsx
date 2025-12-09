function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full flex justify-center items-center sm:pt-24 py-[6rem] relative">
      <div className="flex flex-col md:p-12 p-8 rounded-xl bg-background gap-4 w-11/12 max-w-[1000px]">
        {children}
      </div>
    </div>
  );
}

export default Layout;
