"use client";

import { buttonVariants } from "@/components/ui/button";
import { Trans, useTranslation } from "react-i18next";
import { Copy, CopyCheck } from "lucide-react";
import TokenGen from "@/components/ispindel/TokenGen";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useOS } from "@/hooks/useOS";
import { cn } from "@/lib/utils";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from "@/components/ui/accordion";
import CopyableCodeBlock from "@/components/CodeBlock";
import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText
} from "@/components/ui/input-group";
import { useToast } from "@/hooks/use-toast";
import { useHydrometerInfo } from "@/hooks/useHydrometerInfo";

function Setup() {
  const { t } = useTranslation();
  const displayUrl =
    process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

  const { data } = useHydrometerInfo();
  const hydrometerToken = data?.hydro_token;
  const { currentButton, otherButtons } = useOS();
  const [tempUnits, setTempUnits] = useState("F");

  const pillCloudUrl = `${displayUrl}/api/hydrometer/rapt-pill/cloud`;

  const pillPayload = `{
    "token": "${hydrometerToken ?? "Please generate a token"}",
    "name": "@device_name",
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

      {/* iSpindel tab */}
      <TabsContent value="iSpindel">
        <div className="flex flex-col items-center justify-center gap-6">
          <h2 className="my-4 text-2xl">
            {t("iSpindelDashboard.setup.title")}
          </h2>
          <TokenGen />
          <p>{t("iSpindelDashboard.setup.info")}</p>

          <UrlCopyField
            buttonDetails={{
              url: displayUrl,
              buttonText: "iSpindelDashboard.buttonText.server"
            }}
          />

          <UrlCopyField
            buttonDetails={{
              url: "/api/ispindel",
              buttonText: "iSpindelDashboard.buttonText.path"
            }}
          />

          <p>{t("iSpindelDashboard.setup.serviceType")}</p>
        </div>
      </TabsContent>

      {/* Tilt tab */}
      <TabsContent value="tilt">
        <div className="flex flex-col items-center justify-center gap-6">
          <h2 className="my-4 text-2xl">
            {t("iSpindelDashboard.setup.tilt.title")}
          </h2>
          <TokenGen />
          {hydrometerToken && (
            <UrlCopyField
              buttonDetails={{
                url: `${displayUrl}/api/hydrometer/tilt?token=${hydrometerToken}`,
                buttonText: "cloudUrl"
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
                )
              }}
            />
          </p>
        </div>
      </TabsContent>

      {/* RAPT Pill tab */}
      <TabsContent value="pill">
        <div>
          <h2 className="my-4 text-2xl text-center">{t("rapt.heading")}</h2>
          <Accordion type="single" collapsible className="w-full">
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
                        )
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
                        )
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
                <div className="grid gap-4">
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
                        rel="noopener noreferrer"
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
                  <UrlCopyField
                    buttonDetails={{
                      url: pillCloudUrl,
                      buttonText: "cloudUrl"
                    }}
                  />
                  <TokenGen />
                </div>

                <div className="grid gap-4">
                  <div className="w-full flex justify-between items-center px-2">
                    <h2 className="text-2xl">Payload</h2>
                    <label className="flex items-center gap-2">
                      {t("rapt.tempUnitsLabel", "Temperature Units")}
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

                  <CopyableCodeBlock text={pillPayload} />
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

export const UrlCopyField = ({
  buttonDetails
}: {
  buttonDetails: { url: string; buttonText: string };
}) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const handleClick = async () => {
    try {
      await navigator.clipboard.writeText(buttonDetails.url);

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

  return (
    <InputGroup className="max-w-[500px] w-full">
      <InputGroupAddon>
        <InputGroupText>{t(buttonDetails.buttonText)}</InputGroupText>
      </InputGroupAddon>

      <InputGroupInput
        readOnly
        value={buttonDetails.url}
        placeholder={t(
          "iSpindelDashboard.placeholder.generateToken",
          "Please generate token"
        )}
        className="text-center"
      />

      <InputGroupAddon align="inline-end">
        <InputGroupButton
          type="button"
          onClick={handleClick}
          className="flex items-center justify-center"
          size="icon-xs"
        >
          {copied ? (
            <CopyCheck className="h-4 w-4 text-green-500" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
          <span className="sr-only">
            {t("iSpindelDashboard.copyUrl", "Copy URL to clipboard")}
          </span>
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  );
};
