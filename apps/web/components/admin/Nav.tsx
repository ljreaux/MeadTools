"use client";

import {
  Beer,
  FlaskConical,
  LayoutDashboard,
  Wrench,
  Menu,
  NotebookText,
  TestTube2,
  Users,
  Wheat
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const baseRoute = "/admin";

const navLinks = [
  { key: "overview", fallback: "Overview", to: baseRoute, icon: LayoutDashboard },
  { key: "brews", fallback: "Brews", to: `${baseRoute}/brews`, icon: Beer },
  { key: "recipes", fallback: "Recipes", to: `${baseRoute}/recipes`, icon: NotebookText },
  { key: "users", fallback: "Users", to: `${baseRoute}/users`, icon: Users },
  { key: "yeasts", fallback: "Yeasts", to: `${baseRoute}/yeasts`, icon: FlaskConical },
  { key: "ingredients", fallback: "Ingredients", to: `${baseRoute}/ingredients`, icon: Wheat },
  { key: "additives", fallback: "Additives", to: `${baseRoute}/additives`, icon: TestTube2 },
  { key: "maintenance", fallback: "Maintenance", to: `${baseRoute}/maintenance`, icon: Wrench }
];

export default function AdminNav() {
  const pathname = usePathname();
  const { t } = useTranslation();
  const links = navLinks.map((link) => ({ ...link, label: t(`admin.nav.${link.key}`, link.fallback) }));

  return (
    <>
      <nav className="hidden items-center gap-1 overflow-x-auto border-b pb-3 md:flex" aria-label={t("admin.title", "Admin")}>
        {links.map(({ key, ...link }) => <AdminNavLink key={key} {...link} pathname={pathname} />)}
      </nav>
      <div className="flex items-center justify-between border-b pb-3 md:hidden">
        <Link href="/admin" className="font-semibold">{t("admin.title", "Admin")}</Link>
        <Sheet>
          <SheetTrigger asChild><Button variant="outline" size="icon" title={t("menu", "Menu")}><Menu /></Button></SheetTrigger>
          <SheetContent side="left" className="w-[18rem]">
            <SheetHeader><SheetTitle>{t("admin.title", "Admin")}</SheetTitle></SheetHeader>
            <nav className="mt-6 grid gap-1">
              {links.map(({ key, ...link }) => (
                <SheetClose asChild key={key}><AdminNavLink {...link} pathname={pathname} /></SheetClose>
              ))}
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}

function AdminNavLink({ label, to, icon: Icon, pathname }: { label: string; to: string; icon: typeof Menu; pathname: string }) {
  const adminPath = pathname.slice(pathname.indexOf("/admin"));
  const active = to === baseRoute ? adminPath === baseRoute : adminPath.startsWith(to);
  return (
    <Link href={to} className={cn("flex min-h-9 items-center gap-2 whitespace-nowrap rounded-md px-3 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground", active && "bg-muted font-medium text-foreground")}>
      <Icon className="size-4" />{label}
    </Link>
  );
}
