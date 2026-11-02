/** Units have independent occupancy and optional labels; a group is presented as a quantity. */
export function groupEquipment<
  T extends {
    id: string;
    group_id: string;
    label: string | null;
    brew: { id: string } | null;
  },
>(items: readonly T[]) {
  const groups = new Map<string, T[]>();
  for (const item of items)
    groups.set(item.group_id, [...(groups.get(item.group_id) ?? []), item]);
  return Array.from(groups, ([id, units]) => ({
    id,
    item: units[0],
    units,
    total: units.length,
    available: units.filter((unit) => !unit.brew).length,
  }));
}
