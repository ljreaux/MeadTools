"use client";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput
} from "@/components/ui/input-group";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { Copy, CopyCheck } from "lucide-react";
import { useState } from "react";
import {
  useHydrometerInfo,
  useGenerateHydrometerToken
} from "@/hooks/reactQuery/useHydrometerInfo";
import { Separator } from "../ui/separator";

function TokenGen() {
  const { t } = useTranslation();
  const { toast } = useToast();

  // Fetch current hydrometer info (including existing token)
  const { data } = useHydrometerInfo();
  const hydrometerToken = data?.hydro_token ?? "";

  // Mutation to generate a new token
  const { mutateAsync: generateToken, isPending: tokenLoading } =
    useGenerateHydrometerToken();

  const [copied, setCopied] = useState(false);

  const handleCopyClick = async () => {
    if (!hydrometerToken) return;
    try {
      await navigator.clipboard.writeText(hydrometerToken);

      setCopied(true);
      toast({
        description: (
          <div className="flex items-center justify-center gap-2">
            <CopyCheck className="text-xl text-green-500" />
            {t("iSpindelDashboard.copyToken")}
          </div>
        )
      });

      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast({
        description: t(
          "iSpindelDashboard.copyError",
          "Failed to copy to clipboard."
        ),
        variant: "destructive"
      });
    }
  };

  const handleGenerateClick = async () => {
    if (tokenLoading) return;
    await generateToken();
    setCopied(false); // reset icon after generating new token
  };

  return (
    <InputGroup className="max-w-[500px] w-full h-12">
      <InputGroupAddon>
        <InputGroupButton
          type="button"
          onClick={handleGenerateClick}
          disabled={tokenLoading}
          className="w-full h-full"
        >
          {tokenLoading
            ? t("iSpindelDashboard.genToken.loading", "Generating...")
            : t("iSpindelDashboard.genToken")}
        </InputGroupButton>
        <Separator className="h-12" orientation="vertical" />
      </InputGroupAddon>

      <InputGroupInput
        readOnly
        value={hydrometerToken}
        placeholder={t(
          "iSpindelDashboard.placeholder.generateToken",
          "Please generate token"
        )}
        className="text-center"
      />

      <InputGroupAddon align="inline-end">
        <InputGroupButton
          type="button"
          onClick={handleCopyClick}
          disabled={!hydrometerToken}
          className="w-full h-full"
        >
          {copied ? (
            <CopyCheck className="h-4 w-4 text-green-500" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
          <span className="sr-only">
            {t("iSpindelDashboard.copyToken.sr", "Copy token to clipboard")}
          </span>
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  );
}

export default TokenGen;
