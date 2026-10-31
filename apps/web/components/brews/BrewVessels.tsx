"use client";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { useBrewInventory } from "./BrewInventoryProvider";
import { useBrewContainerChoice } from "./BrewContainerFields";
import { usePatchAccountBrewMetadata } from "@/hooks/reactQuery/useAccountBrews";
import type { BrewStage } from "@meadtools/brew-domain";
import { reportBrewInventoryError } from "@/lib/brews/inventoryUiError";
import { LoadingButton } from "@/components/ui/LoadingButton";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export function BrewVessels({
  brewId,
  completed,
  stage,
}: {
  brewId: string;
  completed: boolean;
  stage: BrewStage;
}) {
  const inventory = useBrewInventory();
  const containers = useBrewContainerChoice(!completed);
  const mutation = usePatchAccountBrewMetadata();
  const client = useQueryClient();
  const { t, i18n } = useTranslation();
  if (!inventory?.canManage) return null;
  async function save() {
    const change = containers.change();
    if (!change) return;
    try {
      await mutation.mutateAsync({
        brewId,
        input: { stage, containers: change },
      });
      containers.reset();
      await Promise.all([
        client.invalidateQueries({ queryKey: ["account", "equipment"] }),
        client.invalidateQueries({ queryKey: ["account", "brew-inventory"] }),
      ]);
    } catch (error) {
      reportBrewInventoryError(error, t);
    }
  }
  return (
    <section className="space-y-3">
      {!completed ? containers.field : null}
      {containers.changePending && !completed ? (
        <LoadingButton
          loading={mutation.isPending}
          disabled={!containers.valid}
          onClick={() => void save()}
        >
          {t("brewInventory.saveContainers")}
        </LoadingButton>
      ) : null}
      <Accordion type="single" collapsible>
        <AccordionItem value="containers">
          <AccordionTrigger className="text-sm">
            {t("brewInventory.vesselHistory")}
          </AccordionTrigger>
          <AccordionContent>
            <Link
              className="mb-3 inline-block text-sm underline underline-offset-4"
              href="/account/equipment"
            >
              {t("brewInventory.manageEquipment")}
            </Link>
            <ol className="space-y-2">
              {inventory.events.map((event) => (
                <li key={event.id} className="border-b pb-2 text-sm">
                  <p>
                    {t(`brewInventory.vesselEvents.${event.action}`, {
                      name: event.equipment_name,
                      quantity: event.quantity,
                    })}
                  </p>
                  <time
                    className="text-xs text-muted-foreground"
                    dateTime={event.created_at}
                  >
                    {new Intl.DateTimeFormat(i18n.language, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(new Date(event.created_at))}
                  </time>
                </li>
              ))}
            </ol>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </section>
  );
}
