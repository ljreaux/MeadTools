"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import CreditWallet from "@/components/account/CreditWallet";
import Header from "@/components/account/header";
import RecipeChat from "@/components/chat/RecipeChat";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { qk } from "@/lib/db/queryKeys";

type ChatWorkspaceTab = "assistant" | "credits";

function selectedTab(value: string | null): ChatWorkspaceTab {
  return value === "credits" ? "credits" : "assistant";
}

/** One account surface for an entitled user's assistant and prompt wallet. */
export default function ChatWorkspace({
  paymentRestricted = false,
}: {
  paymentRestricted?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [tab, setTab] = useState<ChatWorkspaceTab>(() =>
    selectedTab(searchParams.get("tab")),
  );

  useEffect(() => {
    setTab(selectedTab(searchParams.get("tab")));
  }, [searchParams]);

  useEffect(() => {
    const checkoutResult = searchParams.get("creditCheckout");
    if (checkoutResult !== "success" && checkoutResult !== "cancelled") return;

    toast({
      description:
        checkoutResult === "success"
          ? t("credits.checkoutComplete")
          : t("credits.checkoutCancelled"),
    });
    void queryClient.invalidateQueries({ queryKey: qk.creditAccount });
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete("creditCheckout");
    router.replace(`${pathname}?${nextParams.toString()}`);
  }, [pathname, queryClient, router, searchParams, t, toast]);

  function onTabChange(value: string) {
    const nextTab = selectedTab(value);
    setTab(nextTab);
    router.replace(
      nextTab === "assistant" ? pathname : `${pathname}?tab=credits`,
    );
  }

  return (
    <div className="relative w-11/12 max-w-[1200px] rounded-xl bg-background px-4 py-6 sm:px-12 sm:py-8">
      <Header />
      {paymentRestricted ? (
        <div className="mt-10 space-y-6">
          <Card className="border-destructive/40 bg-destructive/5">
            <CardHeader>
              <CardTitle>{t("chatbotTest.paymentReviewTitle")}</CardTitle>
              <CardDescription>
                {t("chatbotTest.paymentReviewDescription")}
              </CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {t("chatbotTest.paymentReviewSupport")}
            </CardContent>
          </Card>
          <CreditWallet embedded paymentRestricted />
        </div>
      ) : (
        <Tabs onValueChange={onTabChange} value={tab}>
          <TabsList className="mb-6 mt-10">
            <TabsTrigger value="assistant">Recipe assistant</TabsTrigger>
            <TabsTrigger value="credits">Prompt credits</TabsTrigger>
          </TabsList>
          <TabsContent value="assistant">
            <RecipeChat embedded />
          </TabsContent>
          <TabsContent value="credits">
            <CreditWallet embedded />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
