"use client";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import type { FinishedMeadItem } from "@meadtools/api-contract/contracts";
import { useFinishedMeadHistory } from "@/hooks/reactQuery/useFinishedMeads";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export function FinishedMeadHistory({ item, onClose }: { item: FinishedMeadItem; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const query = useFinishedMeadHistory(item.id);
  const number = (value: number) => new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 3 }).format(value);
  return <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}><DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
    <DialogHeader><DialogTitle>{t("inventory.history")}</DialogTitle><DialogDescription>{item.name}</DialogDescription></DialogHeader>
    {query.isPending ? <p role="status">{t("inventory.loading")}</p> : query.isError ? <div role="alert"><p>{t("inventory.loadError")}</p><Button onClick={() => void query.refetch()}>{t("equipment.retry")}</Button></div> : query.data ? <>
      {query.data.adjustments.length ? <ol className="space-y-4">{query.data.adjustments.map((change) => <li key={change.id} className="space-y-1 border-b pb-4 last:border-0">
        <div className="flex flex-wrap justify-between gap-2 text-sm"><span className="font-medium">{t(`inventory.meads.kinds.${change.kind}`, t("inventory.stockChange"))}</span>
          <time dateTime={change.created_at} className="text-muted-foreground">{new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium", timeStyle: "short" }).format(new Date(change.created_at))}</time></div>
        <p>{t("inventory.meads.bottleDelta", { count: Math.abs(change.delta), amount: new Intl.NumberFormat(i18n.language, { signDisplay: "exceptZero" }).format(change.delta) })} · {number(change.size_liters * 1000)} mL</p>
        <p className="text-sm text-muted-foreground">{t("inventory.meads.balanceAfter", { count: change.balance_after })}</p>
        {change.source ? <p className="break-words text-sm">{change.source.removed ? <>{change.source.name} · {t("bottlingInventory.sourceRemoved")}</> : <Link className="underline underline-offset-4" href={`/account/brews/${change.source.brew_id}`}>{change.source.name}</Link>}</p> : null}
        {change.note && !change.source ? <p className="break-words text-sm">{change.note}</p> : null}
      </li>)}</ol> : <p>{t("inventory.noHistory")}</p>}
      {query.data.has_more ? <p className="text-sm text-muted-foreground">{t("inventory.recentHistory")}</p> : null}
    </> : null}
  </DialogContent></Dialog>;
}
