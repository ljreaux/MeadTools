"use client";
import { useTranslation } from "react-i18next";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";
import Link from "next/link";
const Nav = () => {
  const { t } = useTranslation();
  const baseRoute = "/account/hydrometer";
  const navLinks = [
    {
      name: "iSpindelDashboard.nav.home",
      to: baseRoute,
    },
    {
      name: "iSpindelDashboard.nav.device",
      to: baseRoute + "/devices",
    },
    {
      name: "iSpindelDashboard.nav.brews",
      to: baseRoute + "/brews",
    },
    {
      name: "iSpindelDashboard.nav.setup",
      to: baseRoute + "/setup",
    },
  ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild className="absolute top-2 sm:left-4 left-1">
        <Button variant={"ghost"}>
          <Menu />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="grid p-6 space-y-2">
        {navLinks.map((navLink) => (
          <Link href={navLink.to} key={navLink.name}>
            {t(navLink.name)}
          </Link>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default Nav;
