import type { EquipmentItem } from "@meadtools/api-contract";
import { createEquipmentRequestBodySchema, updateEquipmentRequestBodySchema } from "@meadtools/api-contract/equipment";
import type { capacityUnitSchema } from "@meadtools/inventory-domain";

import { parseDecimalInput } from "../outbox/gravity-entry-form";

export type EquipmentDraft = {
  name: string;
  type: EquipmentItem["type"];
  capacity: string;
  unit: (typeof capacityUnitSchema.options)[number];
  notes: string;
  quantity: string;
};

export function buildEquipmentDetails(draft: EquipmentDraft, operationId: string) {
  const parsed = createEquipmentRequestBodySchema.safeParse({
    operation_id: operationId,
    quantity: parseDecimalInput(draft.quantity),
    equipment: {
      name: draft.name,
      type: draft.type,
      capacity: draft.type === "vessel" && draft.capacity.trim() ?
        { value: parseDecimalInput(draft.capacity), unit: draft.unit } : null,
      notes: draft.notes.trim() || null
    }
  });
  return parsed.success ? parsed.data : null;
}

export function buildEquipmentAssignment(
  item: Pick<EquipmentItem, "type" | "brew">,
  brewId: string | null,
  operationId: string
) {
  const previous = item.brew?.id ?? null;
  if (item.type !== "vessel" || previous === brewId) return null;
  const parsed = updateEquipmentRequestBodySchema.safeParse({
    action: "assign",
    operation_id: operationId,
    brew_id: brewId,
    expected_brew_id: previous,
    reassign: previous !== null && brewId !== null
  });
  return parsed.success && parsed.data.action === "assign" ? parsed.data : null;
}
