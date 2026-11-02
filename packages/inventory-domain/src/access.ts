/** Consume the account adapter's resolved status; do not duplicate billing logic. */
export function resolveInventoryAccess(status: {
  activeUser: boolean;
  premiumEnabled: boolean;
}) {
  return {
    canRead: status.activeUser,
    canManage: status.activeUser && status.premiumEnabled,
    usageMode: status.activeUser && status.premiumEnabled
      ? "inventory_available" as const
      : "without_deduction" as const
  };
}
