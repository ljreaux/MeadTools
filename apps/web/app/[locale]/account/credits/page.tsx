import { redirect } from "next/navigation";

export default function CreditWalletPage() {
  redirect("/account/chat?tab=credits");
}
