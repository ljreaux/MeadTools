"use client";
import React from "react";
import { useAuth } from "../providers/AuthProvider";
import { useTranslation } from "react-i18next";
import { useRouter } from "next/navigation";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Button } from "../ui/button";
import { CircleUserIcon } from "lucide-react";

function AccountLinks() {
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  const router = useRouter();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" size="icon" className="p-2">
          <CircleUserIcon className="h-[1.2rem] w-[1.2rem] " />

          <span className="sr-only">Account Info</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="z-[2000]">
        {user ? (
          <>
            <DropdownMenuItem onClick={() => router.push("/account")}>
              <p className="text-center w-full"> {t("account.label")}</p>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => router.push("/account/hydrometer")}
            >
              <p className="text-center w-full">
                {t("iSpindelDashboard.manage")}
              </p>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                logout();
                router.push("/login");
              }}
            >
              <p className="text-center w-full"> {t("account.logout")}</p>
            </DropdownMenuItem>
          </>
        ) : (
          <DropdownMenuItem
            onClick={() => {
              router.push("/login");
            }}
          >
            {t("account.login")}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default AccountLinks;
