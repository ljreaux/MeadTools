"use client";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { Input } from "@/components/ui/input";

import { Button, buttonVariants } from "@/components/ui/button";
import { Trans, useTranslation } from "react-i18next";
import { toast } from "@/hooks/use-toast";
import { CircleCheck, Clipboard } from "lucide-react";
import TokenGen from "@/components/ispindel/TokenGen";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useISpindel } from "@/components/providers/ISpindelProvider";
import { useOS } from "@/hooks/useOS";
import { cn } from "@/lib/utils";

function Setup() {
  const { t } = useTranslation();
  const displayUrl =
    process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  const { hydrometerToken } = useISpindel();
  const { currentButton, otherButtons } = useOS();

  return (
    <Tabs defaultValue="iSpindel">
      <div className="flex items-center justify-center py-4">
        <TabsList>
          <TabsTrigger value="iSpindel">iSpindel</TabsTrigger>
          <TabsTrigger value="tilt">Tilt</TabsTrigger>
          <TabsTrigger value="pill">RAPT Pill</TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="iSpindel">
        <div className="flex flex-col items-center justify-center gap-6">
          <h2 className="my-4 text-2xl">
            {t("iSpindelDashboard.setup.title")}
          </h2>
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
      </TabsContent>
      <TabsContent value="tilt">
        <div className="flex flex-col items-center justify-center gap-6">
          <h2 className="my-4 text-2xl">
            {t("iSpindelDashboard.setup.tilt.title")}
          </h2>
          <TokenGen />
          {hydrometerToken && (
            <UrlCopyButton
              buttonDetails={{
                url: `${displayUrl}/api/hydrometer/tilt?token=${hydrometerToken}`,
                buttonText: "cloudUrl",
              }}
            />
          )}
          <p>{t("tilt.instructions.text")}</p>
          <p>{t("tilt.instructions.note")}</p>
          <p className="text-start w-full">
            <Trans
              i18nKey="tilt.instructions.recommendation"
              components={{
                a: (
                  <a
                    href="https://tilthydrometer.com/products/tilt-pi-v2-buster-feb20-raspberry-pi-sd-card-image-download"
                    className="font-bold underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    TiltPi
                  </a>
                ),
              }}
            />
          </p>
        </div>
      </TabsContent>
      <TabsContent value="pill">
        <div className="flex flex-col items-center justify-center gap-6">
          <h2 className="my-4 text-2xl">{t("rapt.heading")}</h2>

          <p>{t("rapt.description")}</p>

          <p className="text-start w-full">
            {t("rapt.warning")}{" "}
            <Trans
              i18nKey="rapt.macos_note"
              components={{
                a: (
                  <a
                    href="https://support.apple.com/guide/mac-help/open-a-mac-app-from-an-unknown-developer-mh40616/mac"
                    className="font-bold underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  />
                ),
              }}
            />
          </p>

          <p>
            <Trans
              i18nKey="rapt.credits"
              components={{
                a: (
                  <a
                    href="https://github.com/TravisEvashkevich/RaptPill-To-MeadTools"
                    className="font-bold underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  />
                ),
              }}
            />
          </p>
          {currentButton && (
            <a
              href={currentButton.href}
              className={cn(
                buttonVariants({ variant: "secondary" }),
                "flex items-center justify-center gap-1"
              )}
            >
              {currentButton.logo} {t("download")} {currentButton.os}
            </a>
          )}
          <div className="flex flex-wrap items-center justify-center my-4">
            {otherButtons.map((button) => (
              <a
                key={button.key}
                href={button.href}
                className={cn(
                  buttonVariants({ variant: "ghost" }),
                  "flex items-center justify-center gap-1"
                )}
              >
                {button.logo} {t("download")} {button.os}
              </a>
            ))}
          </div>
        </div>
      </TabsContent>
    </Tabs>
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
