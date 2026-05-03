"use client";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider
} from "@/components/ui/tooltip";
import { Button } from "../ui/button";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Droplets, LogOut, Settings, NotebookPen } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLogout } from "@/hooks/reactQuery/useLogout";
import { useAccountInfo } from "@/hooks/reactQuery/useAccountInfo";
import Loading from "../loading";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { useEffect, useState } from "react";
import { useUpdatePublicUsername } from "@/hooks/reactQuery/useUpdatePublicUsername";
import { useUpdateShowGoogleAvatar } from "@/hooks/reactQuery/useUpdateShowGoogleAvatar";
import { ModeToggle } from "../ui/mode-toggle";
import LanguageSwitcher from "../ui/language-switcher";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "../ui/select";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput
} from "../ui/input-group";
import { Switch } from "../ui/switch";

function Header() {
  const { t } = useTranslation();
  const pathname = usePathname();
  const { logout } = useLogout();
  const { data, isLoading, isError, error } = useAccountInfo();
  if (isLoading || !data) return <Loading />;

  if (isError) {
    console.error("Error loading account info:", error);
    return (
      <div className="p-12 py-8 rounded-xl bg-background w-11/12 max-w-[1000px]">
        <p className="text-destructive text-center">{t("accountPage.error")}</p>
      </div>
    );
  }
  const { user } = data;
  return (
    <div className="absolute right-4 top-4 flex items-center sm:gap-1">
      <SettingsDialog
        username={user.public_username}
        isGoogleUser={user.isGoogleUser}
        showGoogleAvatar={user.show_google_avatar}
      />

      {/*
      Brew Tracker / Saved Recipes
      Hidden for now while the account brews UI is not ready for main.
      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button asChild variant="ghost" size="icon">
              <Link
                href={isBrewsPath ? "/account" : "/account/brews"}
                aria-label={isBrewsPath ? t("savedRecipes") : t("brews.title")}
              >
                {isBrewsPath ? (
                  <NotebookPen className="h-5 w-5" />
                ) : (
                  <Beer className="h-5 w-5" />
                )}
              </Link>
            </Button>
          </TooltipTrigger>

          <TooltipContent>
            {isBrewsPath ? t("savedRecipes") : t("brews.title")}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      */}

      {/* Hydrometer Dashboard / Saved Recipes */}
      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button asChild variant="ghost" size="icon">
              <Link
                href={
                  pathname?.includes("hydrometer")
                    ? "/account"
                    : "/account/hydrometer"
                }
                aria-label={
                  pathname?.includes("hydrometer")
                    ? t("savedRecipes")
                    : t("iSpindelDashboard.label")
                }
              >
                {pathname?.includes("hydrometer") ? (
                  <NotebookPen className="h-5 w-5" />
                ) : (
                  <Droplets className="h-5 w-5" />
                )}
              </Link>
            </Button>
          </TooltipTrigger>

          <TooltipContent>
            {pathname?.includes("hydrometer")
              ? t("savedRecipes")
              : t("iSpindelDashboard.label")}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* Logout */}
      <Button onClick={logout} variant="ghost" size="icon">
        <span className="sr-only">{t("logout", "Log Out")}</span>
        <LogOut className="h-5 w-5" />
      </Button>
    </div>
  );
}
export default Header;

const SettingsDialog = ({
  username: public_username,
  isGoogleUser,
  showGoogleAvatar
}: {
  username: string | null;
  isGoogleUser: boolean;
  showGoogleAvatar: boolean;
}) => {
  const [username, setUsername] = useState(public_username || "");
  const updateUsernameMutation = useUpdatePublicUsername();

  const updateShowGoogleAvatarMutation = useUpdateShowGoogleAvatar();
  const [localShowGoogleAvatar, setLocalShowGoogleAvatar] =
    useState(showGoogleAvatar);

  const [preferredUnits, setPreferredUnits] = useState<string | undefined>(
    undefined
  );

  useEffect(() => {
    const units = localStorage.getItem("units");
    if (units) {
      setPreferredUnits(units);
    }
  }, []);

  useEffect(() => {
    if (preferredUnits) localStorage.setItem("units", preferredUnits);
  }, [preferredUnits]);

  // keep the local toggle in sync if data refreshes
  useEffect(() => {
    setLocalShowGoogleAvatar(showGoogleAvatar);
  }, [showGoogleAvatar]);

  const { t } = useTranslation();

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost">
          <Settings />
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("account.accountSettings")}</DialogTitle>
        </DialogHeader>

        <div className="w-full grid gap-4">
          <label className="w-full flex gap-4 items-center p-1">
            {t("accountPage.theme.title")}
            <ModeToggle />
          </label>

          <label className="w-full p-1">
            {t("accountPage.language.title")}
            <LanguageSwitcher />
          </label>

          <label className="w-full p-1">
            {t("accountPage.units.title")}
            <Select
              value={preferredUnits}
              onValueChange={(val) => setPreferredUnits(val)}
            >
              <SelectTrigger className="full">
                <SelectValue placeholder={t("accountPage.units.placeholder")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="US">{t("accountPage.units.us")}</SelectItem>
                <SelectItem value="METRIC">
                  {t("accountPage.units.metric")}
                </SelectItem>
              </SelectContent>
            </Select>
          </label>

          {/* Public username */}
          <div className="grid gap-2">
            <label className="text-sm font-medium">
              {t("account.updateUsername")}
            </label>

            <InputGroup>
              <InputGroupInput
                type="text"
                placeholder={t("publicUsername.placeholder")}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    updateUsernameMutation.mutate(username);
                  }
                }}
              />

              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  variant="secondary"
                  title={t("SUBMIT")}
                  onClick={() => updateUsernameMutation.mutate(username)}
                  disabled={
                    updateUsernameMutation.isPending ||
                    username.trim().length === 0
                  }
                >
                  {t("SUBMIT")}
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
          </div>

          {/* ✅ Google avatar switch BELOW username, only for Google users */}
          {isGoogleUser ? (
            <div className="grid gap-1 p-1">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">
                  {t("accountPage.googleAvatar.title")}
                </label>

                <Switch
                  checked={localShowGoogleAvatar}
                  disabled={updateShowGoogleAvatarMutation.isPending}
                  onCheckedChange={(checked) => {
                    setLocalShowGoogleAvatar(checked);
                    updateShowGoogleAvatarMutation.mutate(checked);
                  }}
                  aria-label={t("accountPage.googleAvatar.label")}
                />
              </div>

              <p className="text-sm text-muted-foreground">
                {t("accountPage.googleAvatar.description")}
              </p>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
};
