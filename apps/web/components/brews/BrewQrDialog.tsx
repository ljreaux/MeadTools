"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Download, QrCode } from "lucide-react";
import { saveAs } from "file-saver";
import { useTranslation } from "react-i18next";
import type { BrewQrResult } from "@meadtools/brew-domain/qr";
import { generateBrewQr } from "@/lib/brews/generateBrewQr";
import { useAuthToken } from "@/hooks/auth/useAuthToken";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export function BrewQrDialog({ brewId }: { brewId: string }) {
  const { t } = useTranslation();
  const token = useAuthToken();
  const [result, setResult] = useState<BrewQrResult | null>(null);
  const [pending, startTransition] = useTransition();

  function generate(download = false) {
    startTransition(async () => {
      try {
        const next = await generateBrewQr(brewId, token);
        setResult(next);
        if (download && "svg" in next) {
          saveAs(new Blob([next.svg], { type: "image/svg+xml;charset=utf-8" }), next.filename);
        }
      } catch {
        setResult({ error: "failed" });
      }
    });
  }

  return (
    <Dialog onOpenChange={(open) => { if (open) { setResult(null); generate(); } }}>
      <DialogTrigger asChild>
        <Button type="button" variant="secondary" size="sm">
          <QrCode aria-hidden className="h-4 w-4" />{t("brews.qr.action")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("brews.qr.title")}</DialogTitle>
          <DialogDescription>{t("brews.qr.description")}</DialogDescription>
        </DialogHeader>
        {result && "svg" in result ? (
          <div className="space-y-3">
            {/* Generated SVG contains only QR geometry and fixed colors. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(result.svg)}`} alt={t("brews.qr.previewAlt")} width={256} height={256} className="mx-auto h-auto w-64 max-w-full" />
            <p className="break-all text-center text-xs text-muted-foreground">{result.url}</p>
            <p className="text-sm text-muted-foreground">{t("brews.qr.printHint")}</p>
          </div>
        ) : result && "error" in result ? (
          <div role="status" className="space-y-3">
            <p>{t(`brews.qr.${result.error}`)}</p>
            {result.error === "premiumRequired" ? <Button asChild><Link href="/account/premium">{t("premium.title")}</Link></Button> : null}
          </div>
        ) : <p role="status">{t("brews.qr.generating")}</p>}
        <DialogFooter>
          <LoadingButton loading={pending} loadingText={t("brews.qr.generating")} onClick={() => generate(true)} disabled={result !== null && "error" in result && result.error !== "failed"}>
            <Download aria-hidden className="h-4 w-4" />{t("brews.qr.download")}
          </LoadingButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
