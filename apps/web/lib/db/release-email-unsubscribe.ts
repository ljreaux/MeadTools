import prisma from "@/lib/prisma";
import type { ReleaseEmailUnsubscribeRequestBody } from "@meadtools/api-contract/contracts";
import { userIdFromProductUpdateToken } from "@/lib/release-email-token";

export async function unsubscribeReleaseEmail({
  token,
}: ReleaseEmailUnsubscribeRequestBody): Promise<boolean> {
  const userId = userIdFromProductUpdateToken(token);
  if (!userId) return false;
  const result = await prisma.users.updateMany({
    where: { id: userId },
    data: { product_updates_opt_in: false },
  });
  return result.count > 0;
}
