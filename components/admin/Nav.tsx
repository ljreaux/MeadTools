"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

const baseRoute = "/admin";

const navLinks = [
  { label: "Yeasts", to: `${baseRoute}/yeasts` },
  { label: "Ingredients", to: `${baseRoute}/ingredients` },
  { label: "Users", to: `${baseRoute}/users` },
  { label: "Recipes", to: `${baseRoute}/recipes` },
  { label: "Additives", to: `${baseRoute}/additives` },
];

export default function AdminNav() {
  const pathname = usePathname();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild className="absolute top-2 sm:left-4 left-1">
        <Button variant="ghost" size="icon">
          <Menu />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="grid p-4 gap-2">
        {navLinks.map(({ label, to }) => (
          <Link
            key={label}
            href={to}
            className={clsx(
              "px-2 py-1.5 rounded hover:bg-muted transition-colors",
              pathname.startsWith(to) && "font-semibold bg-muted"
            )}
          >
            {label}
          </Link>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
