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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import CopyableCodeBlock from "@/components/CodeBlock";
import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function Setup() {
  const { t } = useTranslation();
  const displayUrl =
    process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  const { hydrometerToken } = useISpindel();
  const { currentButton, otherButtons } = useOS();
  const [tempUnits, setTempUnits] = useState("F");

  const pillCloudUrl = `${displayUrl}/api/hydrometer/rapt-pill/cloud`;

  const pillPayload = `{
    "token": "${hydrometerToken ?? "Please generate a token"}",
    "name": @device_name,
    "gravity": @gravity,
    "temperature": @temperature,
    "temp_units": "${tempUnits}",
    "battery": @battery
  }`;

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
        <div>
          <h2 className="my-4 text-2xl text-center">{t("rapt.heading")}</h2>
          <Accordion
            type="single"
            defaultValue="bluetooth"
            collapsible
            className="w-full"
          >
            <AccordionItem value="bluetooth">
              <AccordionTrigger>Bluetooth</AccordionTrigger>
              <AccordionContent>
                <div className="flex flex-col items-center justify-center gap-6">
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
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="cloud">
              <AccordionTrigger>RAPT Cloud</AccordionTrigger>
              <AccordionContent>
                <div>
                  <p>
                    MeadTools has support for the RAPT Pill through the RAPT
                    Cloud Custom Web Hooks
                  </p>
                  <ol className="list-decimal list-inside space-y-2">
                    <li>
                      Go to Web Hooks under My Account in the{" "}
                      <a
                        href="https://app.rapt.io/integration/webhooks/list"
                        target="_blank"
                        className="underline"
                      >
                        RAPT Portal
                      </a>
                    </li>
                    <li>Click the Create New Web Hook button at the top.</li>
                    <li>
                      Name and Description are optional (but recommended)
                      values, copy the Cloud URL below and set the Method to
                      Post.
                    </li>
                    <li>
                      Set your temperature units to your preferred units, make
                      sure your token is generated and correctly displayed in
                      the block and copy the block below into payload tab.
                    </li>
                    <p className="font-extrabold">
                      IMPORTANT NOTE: You MUST have a unique (to you) device
                      name set for your device. This allows you to reuse this
                      webhook for all your RAPT pill devices.
                    </p>
                    <li>Add your device in the Devices tab.</li>
                  </ol>
                </div>
                <div className="grid gap-4 py-2">
                  <UrlCopyButton
                    buttonDetails={{
                      url: pillCloudUrl,
                      buttonText: "cloudUrl",
                    }}
                  />
                  <TokenGen />
                </div>
                <div className="grid gap-4">
                  <div className="w-full flex justify-between items-center px-2">
                    <h2 className="text-2xl">Payload</h2>
                    <label>
                      Temperature Units
                      <Select
                        name="deg"
                        onValueChange={setTempUnits}
                        value={tempUnits}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="F">{t("FAR")}</SelectItem>
                          <SelectItem value="C">{t("CEL")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </label>
                  </div>
                  <CopyableCodeBlock text={pillPayload}></CopyableCodeBlock>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
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
