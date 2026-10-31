"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/auth/useAuth";
import { useCreateAccountBrew } from "@/hooks/reactQuery/useAccountBrews";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";

export function CreateBrewButton({
  recipeId,
  recipeName,
  dirty = false,
  saveRecipe
}: {
  recipeId: number;
  recipeName: string;
  dirty?: boolean;
  saveRecipe?: () => Promise<unknown>;
}) {
  const { t } = useTranslation();
  const { isLoggedIn } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const createBrew = useCreateAccountBrew();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(recipeName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const submit = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setSaving(true);
    setError(null);
    try {
      if (dirty) {
        if (!saveRecipe) throw new Error(t("brews.create.saveFirst"));
        await saveRecipe();
      }
      const brew = await createBrew.mutateAsync({
        recipe_id: recipeId,
        name: name.trim() || recipeName
      });
      setOpen(false);
      router.push(`/account/brews/${brew.id}`);
    } catch (cause) {
      setError(
        cause instanceof Error && cause.message
          ? cause.message
          : t("brews.create.failed")
      );
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && setOpen(next)}>
      <DialogTrigger asChild>
        <Button type="button" onClick={() => { setName(recipeName); setError(null); }}>
          {t("brews.create.action")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("brews.create.title")}</DialogTitle>
        </DialogHeader>
        {isLoggedIn ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {t("brews.newBrew.confirmHelp", { recipeName })}
            </p>
            {dirty ? (
              <p className="text-sm text-amber-700 dark:text-amber-300">
                {t("brews.create.saveFirst")}
              </p>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor={`brew-name-${recipeId}`}>{t("name")}</Label>
              <Input
                id={`brew-name-${recipeId}`}
                value={name}
                onChange={(event) => setName(event.target.value)}
                disabled={saving}
              />
            </div>
            {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
          </div>
        ) : (
          <p className="text-sm">
            <Link className="underline" href={`/login?next=${encodeURIComponent(pathname)}`}>
              {t("brews.create.loginRequired")}
            </Link>
          </p>
        )}
        <DialogFooter>
          <Button variant="secondary" onClick={() => setOpen(false)} disabled={saving}>
            {t("cancel")}
          </Button>
          {isLoggedIn ? (
            <Button onClick={() => void submit()} disabled={saving}>
              {saving
                ? t("creating")
                : dirty
                  ? t("brews.create.saveAndCreate")
                  : t("brews.create.action")}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
