"use client";

import { useId } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";
import type {
  InventoryCostLine,
  InventoryCostSummary,
  PublicCostSummary,
} from "@meadtools/api-contract/contracts";
import { VOLUME_TO_L } from "@meadtools/core/recipe";
import { matchesCostExclusion } from "@meadtools/inventory-domain";
import { useBrewCosts, useCostExclusions, useRecipeCosts } from "@/hooks/reactQuery/useInventoryCosts";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export function useMoney() {
  const { i18n } = useTranslation();
  const language = i18n.resolvedLanguage ?? i18n.language;
  return {
    money: (amount: number, currency: string) =>
      new Intl.NumberFormat(language, { style: "currency", currency }).format(amount),
    /** Unit costs keep extra digits so per-gram prices stay meaningful. */
    unitMoney: (amount: number, currency: string) =>
      new Intl.NumberFormat(language, {
        style: "currency",
        currency,
        maximumFractionDigits: Math.max(
          4,
          new Intl.NumberFormat(language, { style: "currency", currency }).resolvedOptions()
            .maximumFractionDigits ?? 2,
        ),
      }).format(amount),
    number: (value: number) =>
      new Intl.NumberFormat(language, { maximumFractionDigits: 3 }).format(value),
  };
}

type Summary = InventoryCostSummary | PublicCostSummary;

function Totals({ summary }: { summary: Summary }) {
  const { t } = useTranslation();
  const { money, number } = useMoney();
  const currency = summary.totals.length === 1 ? summary.totals[0].currency : null;
  const perGallon = summary.per_liter === null ? null : summary.per_liter * VOLUME_TO_L.gal;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        {summary.totals.length ? (
          summary.totals.map((total) => (
            <p key={total.currency} className="text-2xl font-semibold tabular-nums">
              {money(total.amount, total.currency)}
            </p>
          ))
        ) : (
          <p className="text-lg font-medium text-muted-foreground">{t("inventoryCosts.noTotal")}</p>
        )}
        <span className="text-sm text-muted-foreground">
          {t(summary.basis === "recipe_estimate" ? "inventoryCosts.basis.recipe_estimate" : "inventoryCosts.basis.recorded_usage")}
        </span>
      </div>
      <p className={summary.complete ? "flex items-center gap-2 text-sm" : "flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400"}>
        {summary.complete ? <CheckCircle2 aria-hidden className="h-4 w-4 shrink-0" /> : <AlertTriangle aria-hidden className="h-4 w-4 shrink-0" />}
        {t(summary.complete
          // Complete with no total means every line was left out by choice.
          ? summary.totals.length ? "inventoryCosts.complete" : "inventoryCosts.allExcluded"
          : summary.mixed_currencies ? "inventoryCosts.mixedCurrencies" : "inventoryCosts.incomplete")}
      </p>
      {currency && summary.per_liter !== null && summary.volume_liters !== null ? (
        <p className="text-sm text-muted-foreground">
          {t("inventoryCosts.perVolume", {
            perLiter: money(summary.per_liter, currency),
            perGallon: money(perGallon!, currency),
            liters: number(summary.volume_liters),
          })}
        </p>
      ) : null}
      {"per_bottle" in summary && summary.per_bottle && currency ? (
        <div className="space-y-1 text-sm">
          <p className="font-medium">{t("inventoryCosts.perBottleTitle")}</p>
          <ul className="space-y-1 text-muted-foreground">
            {summary.per_bottle.map((row) => (
              <li key={row.size_liters}>
                {t("inventoryCosts.perBottle", {
                  size: number(row.size_liters * 1000),
                  count: row.count,
                  amount: money(row.amount, currency),
                })}
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">{t("inventoryCosts.perBottleHelp")}</p>
        </div>
      ) : null}
    </div>
  );
}

type ExclusionControls = ReturnType<typeof useCostExclusions>;
/** Recorded brew lines only: count or stop counting one use in this brew. */
type UseControls = { toggle: (key: string, excluded: boolean) => void; busy: boolean };

/** Packaging names describe a size, not an ingredient; never exclude them everywhere. */
const isPackagingLine = (line: InventoryCostLine) => line.kind === "PACKAGING";

const linkClass = "h-auto self-start px-0 py-0.5 text-xs underline-offset-4 hover:underline sm:self-end";

function LineRow({ line, exclusions, uses }: { line: InventoryCostLine; exclusions: ExclusionControls | null; uses: UseControls | null }) {
  const { t } = useTranslation();
  const { money, unitMoney, number } = useMoney();
  const busy = (exclusions?.mutation.isPending ?? false) || (uses?.busy ?? false);
  // Re-including needs the stored ingredient choice that matched this line.
  const matching = line.exclusion === "ingredient"
    ? exclusions?.query.data?.exclusions.find((exclusion) =>
        matchesCostExclusion(
          { name: line.name, catalogReference: line.catalog_reference },
          [{ name: exclusion.name, catalogReference: exclusion.catalog_reference }],
        ))
    : undefined;
  return (
    <li className="flex flex-col gap-1 border-b border-border/60 py-3 last:border-0 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <div className="min-w-0 space-y-1">
        <p className="break-words font-medium">{line.name}</p>
        <p className="text-sm text-muted-foreground">
          {line.quantity ? `${number(line.quantity.value)} ${t(`inventory.units.${line.quantity.unit}`)}` : t("inventoryCosts.noAmount")}
          {line.stock_name && line.stock_name !== line.name ? ` · ${t("inventoryCosts.fromStock", { name: line.stock_name })}` : ""}
        </p>
        {line.status === "priced" && line.unit_cost !== null && line.currency && line.unit ? (
          <p className="text-xs text-muted-foreground">
            {line.unit === "units"
              ? t("inventoryCosts.unitCostEach", { cost: unitMoney(line.unit_cost, line.currency) })
              : t("inventoryCosts.unitCost", { cost: unitMoney(line.unit_cost, line.currency), unit: t(`inventory.units.${line.unit}`) })}
          </p>
        ) : null}
        {line.shortage ? (
          <p className="text-xs text-amber-700 dark:text-amber-400">
            {t("inventoryCosts.shortage", { amount: number(line.shortage.value), unit: t(`inventory.units.${line.shortage.unit}`) })}
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 flex-col gap-1 text-sm sm:items-end sm:text-right">
        {line.status === "priced" && line.cost !== null && line.currency ? (
          <span className="font-medium tabular-nums">{money(line.cost, line.currency)}</span>
        ) : line.status === "excluded" ? (
          <span className="text-muted-foreground">{t(line.exclusion === "use" ? "inventoryCosts.status.excludedUse" : "inventoryCosts.status.excluded")}</span>
        ) : (
          <span className="text-amber-700 dark:text-amber-400">{t(`inventoryCosts.status.${line.status}`)}</span>
        )}
        {uses && line.status !== "excluded" ? (
          // This brew only, e.g. reused bottles; other brews keep their cost.
          <Button variant="ghost" size="sm" className={linkClass} disabled={busy}
            aria-label={t("inventoryCosts.excludeUseNamed", { name: line.name })}
            onClick={() => uses.toggle(line.key, true)}>
            {t("inventoryCosts.excludeUse")}
          </Button>
        ) : null}
        {uses && line.exclusion === "use" ? (
          <Button variant="ghost" size="sm" className={linkClass} disabled={busy}
            aria-label={t("inventoryCosts.includeUseNamed", { name: line.name })}
            onClick={() => uses.toggle(line.key, false)}>
            {t("inventoryCosts.includeUse")}
          </Button>
        ) : null}
        {exclusions && line.status !== "excluded" && !isPackagingLine(line) ? (
          // Everywhere, by ingredient (e.g. tap water); never by stock item.
          <Button variant="ghost" size="sm" className={linkClass} disabled={busy}
            aria-label={t("inventoryCosts.excludeNamed", { name: line.name })}
            onClick={() => exclusions.mutation.mutate({ action: "exclude", name: line.name, catalog_reference: line.catalog_reference })}>
            {t("inventoryCosts.exclude")}
          </Button>
        ) : null}
        {exclusions && matching ? (
          <Button variant="ghost" size="sm" className={linkClass} disabled={busy}
            aria-label={t("inventoryCosts.includeNamed", { name: line.name })}
            onClick={() => exclusions.mutation.mutate({ action: "include", id: matching.id })}>
            {t("inventoryCosts.include")}
          </Button>
        ) : null}
      </div>
    </li>
  );
}

export function CostSummaryView({ summary, empty, canManage = false, uses = null }: { summary: InventoryCostSummary; empty: string; canManage?: boolean; uses?: UseControls | null }) {
  const { t } = useTranslation();
  const controls = useCostExclusions(canManage);
  const exclusions = canManage ? controls : null;
  const missing = Object.entries(summary.missing).filter(([, count]) => count > 0);
  if (!summary.lines.length) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <div className="space-y-4">
      <Totals summary={summary} />
      {missing.length || summary.short_lines ? (
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          {missing.map(([status, count]) => (
            <li key={status}>{t(`inventoryCosts.missing.${status}`, { count })}</li>
          ))}
          {summary.short_lines ? <li>{t("inventoryCosts.missing.short", { count: summary.short_lines })}</li> : null}
        </ul>
      ) : null}
      {summary.excluded_lines ? (
        <p className="text-sm text-muted-foreground">{t("inventoryCosts.excludedCount", { count: summary.excluded_lines })}</p>
      ) : null}
      {summary.lines.length ? (
        <ul aria-label={t("inventoryCosts.linesLabel")}>{summary.lines.map((line) => <LineRow key={line.key} line={line} exclusions={exclusions} uses={canManage || line.exclusion === "use" ? uses : null} />)}</ul>
      ) : (
        <p className="text-sm text-muted-foreground">{empty}</p>
      )}
      {exclusions?.mutation.isError ? (
        <p role="alert" className="text-sm text-destructive">{errorText(t, exclusions.mutation.error)}</p>
      ) : null}
      {missing.length ? (
        <p className="text-sm text-muted-foreground">
          {t(canManage ? "inventoryCosts.fixHelpExclude" : "inventoryCosts.fixHelp")}{" "}
          <Link className="underline underline-offset-4" href="/account/inventory">{t("inventoryCosts.openInventory")}</Link>
        </p>
      ) : null}
    </div>
  );
}

function ShareToggle({ checked, disabled, onChange, help }: { checked: boolean; disabled: boolean; onChange: (value: boolean) => void; help: string }) {
  const { t } = useTranslation();
  const id = useId();
  return (
    <div className="flex items-start gap-3 rounded-md border p-3">
      <Switch id={id} checked={checked} disabled={disabled} onCheckedChange={onChange} />
      <div className="space-y-1">
        <Label htmlFor={id}>{t("inventoryCosts.share")}</Label>
        <p className="text-xs text-muted-foreground">{help}</p>
      </div>
    </div>
  );
}

function errorText(t: ReturnType<typeof useTranslation>["t"], error: unknown) {
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "FAILED";
  return t(`inventory.errors.${code}`, t("inventory.saveError"));
}

export function BrewCostPanel({ brewId, brewPublic }: { brewId: string; brewPublic: boolean }) {
  const { t } = useTranslation();
  const { query, mutation } = useBrewCosts(brewId);
  if (query.isPending) return <Skeleton className="h-32 w-full" />;
  if (query.isError || !query.data)
    return (
      <div role="alert" className="space-y-2 text-sm">
        <p>{t("inventoryCosts.loadError")}</p>
        <Button variant="outline" size="sm" onClick={() => void query.refetch()}>{t("equipment.retry")}</Button>
      </div>
    );
  const data = query.data;
  return (
    <div className="space-y-4">
      <Tabs defaultValue="recorded">
        <TabsList aria-label={t("inventoryCosts.brewTitle")}>
          <TabsTrigger value="recorded">{t("inventoryCosts.recorded")}</TabsTrigger>
          <TabsTrigger value="planned" disabled={!data.planned}>{t("inventoryCosts.planned")}</TabsTrigger>
        </TabsList>
        <TabsContent value="recorded" className="space-y-4">
          <p className="text-sm text-muted-foreground">{t("inventoryCosts.recordedHelp")}</p>
          <CostSummaryView summary={data.recorded} empty={t("inventoryCosts.noRecordedUses")} canManage={data.can_manage}
            uses={{ busy: mutation.isPending, toggle: (key, excluded) => mutation.mutate({ action: "exclude_use", key, excluded }) }} />
        </TabsContent>
        {data.planned ? (
          <TabsContent value="planned" className="space-y-4">
            <p className="text-sm text-muted-foreground">{t("inventoryCosts.plannedHelp")}</p>
            <CostSummaryView summary={data.planned} empty={t("inventoryCosts.noRecipeLines")} canManage={data.can_manage} />
          </TabsContent>
        ) : null}
      </Tabs>
      {data.can_manage ? (
        <div className="space-y-3">
          {data.recorded.lines.length ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm"><RefreshCw aria-hidden className="mr-2 h-4 w-4" />{t("inventoryCosts.recalculate")}</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t("inventoryCosts.recalculateTitle")}</AlertDialogTitle>
                  <AlertDialogDescription>{t("inventoryCosts.recalculateDescription")}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={mutation.isPending}>{t("equipment.cancel")}</AlertDialogCancel>
                  <AlertDialogAction asChild>
                    <LoadingButton loading={mutation.isPending} loadingText={t("equipment.saving")} onClick={() => mutation.mutate({ action: "recalculate" })}>
                      {t("inventoryCosts.recalculate")}
                    </LoadingButton>
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : null}
          <ShareToggle
            checked={data.share_cost_summary}
            disabled={mutation.isPending}
            onChange={(value) => mutation.mutate({ action: "share", share_cost_summary: value })}
            help={t(brewPublic ? "inventoryCosts.shareBrewHelp" : "inventoryCosts.sharePrivateHelp")}
          />
        </div>
      ) : data.share_cost_summary ? (
        <ShareToggle checked disabled={mutation.isPending} onChange={(value) => mutation.mutate({ action: "share", share_cost_summary: value })} help={t("inventoryCosts.premiumShareOff")} />
      ) : (
        <p className="text-sm text-muted-foreground">{t("inventoryCosts.premiumHelp")}</p>
      )}
      {mutation.isError ? <p role="alert" className="text-sm text-destructive">{errorText(t, mutation.error)}</p> : null}
    </div>
  );
}

export function RecipeCostEstimate({ recipeId, recipePublic, dirty }: { recipeId: number; recipePublic: boolean; dirty: boolean }) {
  const { t } = useTranslation();
  const { query, mutation } = useRecipeCosts(recipeId);
  if (query.isPending) return <Skeleton className="h-32 w-full" />;
  if (query.isError || !query.data)
    return (
      <div role="alert" className="space-y-2 text-sm">
        <p>{t("inventoryCosts.loadError")}</p>
        <Button variant="outline" size="sm" onClick={() => void query.refetch()}>{t("equipment.retry")}</Button>
      </div>
    );
  const data = query.data;
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t("inventoryCosts.recipeHelp")}</p>
      {dirty ? <p className="text-sm text-amber-700 dark:text-amber-400">{t("inventoryCosts.savedOnly")}</p> : null}
      <CostSummaryView summary={data.estimate} empty={t("inventoryCosts.noRecipeLines")} canManage={data.can_manage} />
      <Button variant="outline" size="sm" onClick={() => void query.refetch()} disabled={query.isFetching}>
        <RefreshCw aria-hidden className="mr-2 h-4 w-4" />{t("inventoryCosts.refresh")}
      </Button>
      {data.can_manage || data.share_cost_summary ? (
        <ShareToggle
          checked={data.share_cost_summary}
          disabled={mutation.isPending || (!data.can_manage && !data.share_cost_summary)}
          onChange={(value) => mutation.mutate(value)}
          help={t(recipePublic ? "inventoryCosts.shareRecipeHelp" : "inventoryCosts.sharePrivateHelp")}
        />
      ) : (
        <p className="text-sm text-muted-foreground">{t("inventoryCosts.premiumHelp")}</p>
      )}
      {mutation.isError ? <p role="alert" className="text-sm text-destructive">{errorText(t, mutation.error)}</p> : null}
    </div>
  );
}

/** Public, opt-in totals only. Renders nothing unless the owner shared a summary. */
export function PublicCostSummaryView({ summary }: { summary: PublicCostSummary | null | undefined }) {
  const { t } = useTranslation();
  if (!summary) return null;
  return (
    <section className="space-y-3 rounded-lg border border-border/70 bg-background/40 p-4">
      <h2 className="text-sm font-semibold">{t("inventoryCosts.publicTitle")}</h2>
      <Totals summary={summary} />
      <p className="text-xs text-muted-foreground">{t("inventoryCosts.publicHelp")}</p>
    </section>
  );
}
