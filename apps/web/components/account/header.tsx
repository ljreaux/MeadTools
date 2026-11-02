"use client";
import { usePathname } from "next/navigation";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "../ui/button";
import Link from "next/link";
import {
  Beer,
  Droplets,
  LogOut,
  Settings,
  NotebookPen,
  MessageCircle,
  Crown,
  Plug,
  Wrench,
  Package,
  ChevronDown,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLogout } from "@/hooks/reactQuery/useLogout";
import { useAccountInfo } from "@/hooks/reactQuery/useAccountInfo";
import Loading from "../loading";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useEffect, useState } from "react";
import { useUpdatePublicUsername } from "@/hooks/reactQuery/useUpdatePublicUsername";
import { useUpdateShowGoogleAvatar } from "@/hooks/reactQuery/useUpdateShowGoogleAvatar";
import { DesignThemeSwitcher } from "../ui/design-theme-switcher";
import LanguageSwitcher from "../ui/language-switcher";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "../ui/input-group";
import { Switch } from "../ui/switch";
import { useChatAccess } from "@/hooks/reactQuery/useChatAccess";
import { ReleaseEmailPreferences } from "./ReleaseEmailPreferences";

function Header() {
  const { t, i18n } = useTranslation();
  const pathname = usePathname();
  const { logout } = useLogout();
  const { data, isLoading, isError, error } = useAccountInfo();
  const { data: chatAccess } = useChatAccess();
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
  const brewingLinks = [
    { href: "/account", label: t("savedRecipes"), icon: NotebookPen },
    { href: "/account/brews", label: t("brews.title"), icon: Beer },
    { href: "/account/inventory", label: t("inventory.title", "Inventory"), icon: Package },
    { href: "/account/equipment", label: t("equipment.title"), icon: Wrench },
    { href: "/account/hydrometer", label: t("iSpindelDashboard.label"), icon: Droplets },
  ];
  const accountLinks = [
    ...(chatAccess?.chatEnabled || chatAccess?.paymentRestricted
      ? [{ href: "/account/chat", label: t("chatbotPopup.open"), icon: MessageCircle }] : []),
    { href: "/account/premium", label: t("premium.title"), icon: Crown },
    { href: "/integrations/mcp", label: t("account.navigation.mcp", "MCP setup"), icon: Plug },
  ];
  const locale = i18n.resolvedLanguage || "en";
  const prefix = locale === "en" ? "" : `/${locale}`;
  const currentPath = pathname?.replace(new RegExp(`^/${locale}(?=/|$)`), "") || "/";
  const active = [...brewingLinks, ...accountLinks]
    .sort((left, right) => right.href.length - left.href.length)
    .find((link) => currentPath === link.href || (link.href !== "/account" && currentPath.startsWith(`${link.href}/`)));

  return (
    <nav aria-label={t("account.navigation.label", "Account navigation")} className="relative mb-4 flex w-full min-w-0 items-center justify-end gap-2 sm:absolute sm:right-4 sm:top-4 sm:mb-0 sm:w-auto">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="max-w-[min(70vw,20rem)] gap-2" aria-label={t("account.navigation.label", "Account navigation")}>
            <span className="truncate">{active?.label ?? t("account.label")}</span><ChevronDown aria-hidden className="h-4 w-4 shrink-0" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72 max-w-[calc(100vw-2rem)]">
          {[{ label: t("account.navigation.brewing", "Brewing"), links: brewingLinks }, { label: t("account.navigation.tools", "Account & tools"), links: accountLinks }].map((group, index) => (
            <DropdownMenuGroup key={group.label}>
              {index ? <DropdownMenuSeparator /> : null}
              <DropdownMenuLabel>{group.label}</DropdownMenuLabel>
              {group.links.map(({ href, label, icon: Icon }) => <DropdownMenuItem key={href} asChild className={active?.href === href ? "bg-accent font-medium" : undefined}>
                <Link href={`${prefix}${href}`} aria-current={active?.href === href ? "page" : undefined}><Icon aria-hidden /><span>{label}</span></Link>
              </DropdownMenuItem>)}
            </DropdownMenuGroup>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={logout}><LogOut aria-hidden /><span>{t("logout", "Log Out")}</span></DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <SettingsDialog
        username={user.public_username}
        isGoogleUser={user.isGoogleUser}
        showGoogleAvatar={user.show_google_avatar}
      />
    </nav>
  );
}

export default Header;

const SettingsDialog = ({
  username: public_username,
  isGoogleUser,
  showGoogleAvatar,
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
    undefined,
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
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("account.accountSettings")}
        >
          <Settings />
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("account.accountSettings")}</DialogTitle>
        </DialogHeader>

        <div className="w-full grid gap-4">
          <label className="w-full flex gap-4 items-center p-1">
            {t("accountPage.theme.title")}
            <DesignThemeSwitcher />
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
          <ReleaseEmailPreferences />
        </div>
      </DialogContent>
    </Dialog>
  );
};
