"use client";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { Input } from "@/components/ui/input";

import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { toast } from "@/hooks/use-toast";
import { CircleCheck, Clipboard } from "lucide-react";
import TokenGen from "@/components/ispindel/TokenGen";

function Setup() {
  const { t } = useTranslation();
  const displayUrl =
    process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

  return (
    <div className="flex flex-col items-center justify-center gap-6">
      <h2 className="my-4 text-2xl">{t("iSpindelDashboard.setup.title")}</h2>
      <TokenGen />
      <p>{t("iSpindelDashboard.setup.info")}</p>
      <UrlCopyButton
        buttonDetails={{
          url: displayUrl,
          buttonText: "iSpindelDashboard.buttonText.server",
        }}
      />
      <UrlCopyButton
        buttonDetails={{
          url: "/api/ispindel",
          buttonText: "iSpindelDashboard.buttonText.path",
        }}
      />
      <p>{t("iSpindelDashboard.setup.serviceType")}</p>
    </div>
  );
}

export default Setup;

const UrlCopyButton = ({
  buttonDetails,
}: {
  buttonDetails: { url: string; buttonText: string };
}) => {
  const { t } = useTranslation();

  const handleClick = async () => {
    navigator.clipboard.writeText(buttonDetails.url);
    toast({
      description: (
        <div className="flex items-center justify-center gap-2">
          <CircleCheck className="text-xl text-green-500" />
          {t("iSpindelDashboard.copyToken")}
        </div>
      ),
    });
  };

  return (
    <div className="flex gap-0 flex-nowrap max-w-[500px] w-full">
      <LoadingButton
        disabled
        className="rounded-r-none h-10" // Ensures consistent height
        variant={"secondary"}
        loading={false}
      >
        {t(buttonDetails.buttonText)}
      </LoadingButton>
      <Input
        readOnly
        disabled
        value={buttonDetails.url}
        placeholder="Please Generate Token"
        className="text-center border-collapse rounded-none border-x-0 h-10" // Matches button height
      />
      <Button
        value={"copy to clipboard"}
        className="rounded-l-none h-10" // Matches button height
        onClick={handleClick}
      >
        <Clipboard />
      </Button>
    </div>
  );
};
