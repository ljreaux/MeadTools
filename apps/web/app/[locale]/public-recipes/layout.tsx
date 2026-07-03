function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full flex flex-col justify-center items-center py-[6rem] relative">
      {children}
    </div>
  );
}

export default Layout;
