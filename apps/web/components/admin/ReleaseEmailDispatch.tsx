"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { AdminReleaseEmailOverviewResponse } from "@meadtools/api-contract/contracts";
import { useFetchWithAuth } from "@/hooks/auth/useFetchWithAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Product = "web" | "mobile" | "chat" | "api";

export default function ReleaseEmailDispatch() {
  const { t } = useTranslation();
  const fetchWithAuth = useFetchWithAuth();
  const queryClient = useQueryClient();
  const [dateChoice, setDateChoice] = useState("");
  const [productChoice, setProductChoice] = useState<Product>("web");
  const [confirmation, setConfirmation] = useState("");
  const [result, setResult] = useState("");
  const queryKey = ["admin", "release-emails"];
  const overview = useQuery({
    queryKey,
    queryFn: () => fetchWithAuth<AdminReleaseEmailOverviewResponse>("/api/admin/release-emails"),
    retry: false,
  });
  const action = useMutation({
    mutationFn: async (kind: "prepare" | "send") => {
      if (!date || !product) throw new Error("Select a release and product.");
      return fetchWithAuth<AdminReleaseEmailOverviewResponse>("/api/admin/release-emails", {
        method: "POST",
        body: JSON.stringify({
          date,
          product,
          action: kind,
          confirmation: `${kind.toUpperCase()} ${date} ${product.toUpperCase()}`,
        }),
      });
    },
    onSuccess: (data, kind) => {
      queryClient.setQueryData(queryKey, data);
      setResult(kind === "send"
        ? t("admin.releaseEmails.batchResult", { sent: data.sent ?? 0, failed: data.failed ?? 0, skipped: data.skipped ?? 0 })
        : t("admin.releaseEmails.prepared"));
      setConfirmation("");
    },
  });

  const available = overview.data?.available ?? [];
  const date = available.some((entry) => entry.date === dateChoice)
    ? dateChoice : available[0]?.date ?? "";
  const products = available.find((entry) => entry.date === date)?.products ?? [];
  const product = products.includes(productChoice) ? productChoice : products[0];
  const counts = overview.data?.counts.filter(
    (row) => row.date === date && row.product === product,
  ) ?? [];
  const pending = counts.find((row) => row.status === "PENDING")?.count ?? 0;
  const expected = `SEND ${date} ${product?.toUpperCase() ?? ""}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("admin.releaseEmails.title")}</CardTitle>
        <CardDescription>{t("admin.releaseEmails.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {overview.isLoading && <p>{t("admin.releaseEmails.loading")}</p>}
        {overview.isError && <p role="alert" className="text-destructive">{t("admin.releaseEmails.loadError")}</p>}
        {available.length === 0 && !overview.isLoading && !overview.isError && (
          <p>{t("admin.releaseEmails.noReleases")}</p>
        )}
        {available.length > 0 && (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="release-email-date">{t("admin.releaseEmails.release")}</Label>
                <select id="release-email-date" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={date}
                  onChange={(event) => { setDateChoice(event.target.value); setConfirmation(""); setResult(""); }}>
                  {available.map((entry) => <option key={entry.date} value={entry.date}>{entry.date} — {entry.title}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="release-email-product">{t("admin.releaseEmails.product")}</Label>
                <select id="release-email-product" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={product}
                  onChange={(event) => { setProductChoice(event.target.value as Product); setConfirmation(""); setResult(""); }}>
                  {products.map((item) => <option key={item} value={item}>{t(`releaseNotes.products.${item}`)}</option>)}
                </select>
              </div>
            </div>
            <div className="space-y-1 text-sm">
              {(["PENDING", "SENDING", "SENT", "FAILED", "SKIPPED"] as const).map((status) => (
                <p key={status}>{t(`admin.releaseEmails.status.${status}`)}: {counts.find((row) => row.status === status)?.count ?? 0}</p>
              ))}
            </div>
            <Button type="button" variant="outline" disabled={action.isPending} onClick={() => action.mutate("prepare")}>{t("admin.releaseEmails.prepare")}</Button>
            <div className="space-y-2">
              <Label htmlFor="release-email-confirmation">{t("admin.releaseEmails.confirm", { expected })}</Label>
              <Input id="release-email-confirmation" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" />
              <Button type="button" disabled={action.isPending || pending === 0 || confirmation !== expected} onClick={() => action.mutate("send")}>{t("admin.releaseEmails.sendBatch")}</Button>
              <p className="text-sm text-muted-foreground">{t("admin.releaseEmails.sendHelp")}</p>
            </div>
          </>
        )}
        {result && <p role="status">{result}</p>}
        {action.isError && <p role="alert" className="text-destructive">{action.error instanceof Error ? action.error.message : t("admin.releaseEmails.actionError")}</p>}
      </CardContent>
    </Card>
  );
}
