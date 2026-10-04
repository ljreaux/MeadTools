import prisma from "@/lib/prisma";
import type { ReleaseEmailUnsubscribeRequestBody } from "@meadtools/api-contract/contracts";

const updateByProduct = {
  web: { web_opted_in_at: null },
  mobile: { mobile_opted_in_at: null },
  chat: { chat_opted_in_at: null },
  api: { api_opted_in_at: null },
} as const;

export async function unsubscribeReleaseEmail({
  token,
  product,
}: ReleaseEmailUnsubscribeRequestBody): Promise<boolean> {
  const row = await prisma.release_email_preferences.findUnique({
    where: { unsubscribe_token: token },
    select: { user_id: true },
  });
  if (!row) return false;
  await prisma.release_email_preferences.update({
    where: { user_id: row.user_id },
    data: updateByProduct[product],
  });
  return true;
}
