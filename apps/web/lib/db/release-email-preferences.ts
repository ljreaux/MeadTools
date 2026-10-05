import prisma from "@/lib/prisma";
import type { ReleaseEmailPreferencesUpdateBody } from "@meadtools/api-contract/contracts";

export async function getReleaseEmailPreferences(userId: number) {
  const user = await prisma.users.findUniqueOrThrow({
    where: { id: userId },
    select: { product_updates_opt_in: true },
  });
  return {
    optedIn: user.product_updates_opt_in === true,
    prompted: user.product_updates_opt_in !== null,
  };
}

export async function setReleaseEmailPreferences(
  userId: number,
  requested: ReleaseEmailPreferencesUpdateBody,
) {
  const user = await prisma.users.update({
    where: { id: userId },
    data: { product_updates_opt_in: requested.optedIn },
    select: { product_updates_opt_in: true },
  });
  return { optedIn: user.product_updates_opt_in === true, prompted: true };
}
