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
import { useHydrometerInfo } from "@/hooks/reactQuery/useHydrometerInfo";

function Setup() {
  const { t } = useTranslation();
  const displayUrl =
    process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

  const { data } = useHydrometerInfo();
  const hydrometerToken = data?.hydro_token;

  const { currentButton, otherButtons } = useOS();
  const [tempUnits, setTempUnits] = useState("F");

  // NEW: control tab so title can reflect selection
  const [tab, setTab] = useState<"iSpindel" | "tilt" | "pill">("iSpindel");

  const tabLabel =
    tab === "iSpindel" ? "iSpindel" : tab === "tilt" ? "Tilt" : "RAPT Pill";

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
    <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
      <div className="w-full space-y-6">
        {/* Title (ONLY centered thing) */}
        <div className="text-center">
          <h2 className="text-2xl font-semibold leading-tight">
            {t("iSpindelDashboard.tabs.label", { tabLabel })}
          </h2>
        </div>

        {/* TabsList under title, NOT centered */}
        <TabsList>
          <TabsTrigger value="iSpindel">
            {t("iSpindelDashboard.tabs.iSpindel")}
          </TabsTrigger>
          <TabsTrigger value="tilt">
            {t("iSpindelDashboard.tabs.tilt")}
          </TabsTrigger>
          <TabsTrigger value="pill">
            {t("iSpindelDashboard.tabs.pill")}
          </TabsTrigger>
        </TabsList>

        {/* iSpindel tab */}
        <TabsContent value="iSpindel" className="mt-0">
          <div className="space-y-6">
            <TokenGen />

            <p className="text-sm">{t("iSpindelDashboard.setup.info")}</p>

            <div className="space-y-3">
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
            </div>

            <p className="text-sm ">
              {t("iSpindelDashboard.setup.serviceType")}
            </p>
          </div>
        </TabsContent>

        {/* Tilt tab */}
        <TabsContent value="tilt" className="mt-0">
          <div className="space-y-6">
            <TokenGen />

            <div className="space-y-2">
              <p className="text-sm ">{t("tilt.instructions.text")}</p>
              <div className="py-4">
                <UrlCopyField
                  buttonDetails={{
                    url: `${displayUrl}/api/hydrometer/tilt?token=${hydrometerToken}`,
                    buttonText: "cloudUrl"
                  }}
                />
              </div>
              <p className="text-sm">{t("tilt.instructions.note")}</p>

              <p className="text-sm">
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
          </div>
        </TabsContent>

        {/* RAPT Pill tab */}
        <TabsContent value="pill" className="mt-0">
          <div className="space-y-6">
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="bluetooth">
                <AccordionTrigger>{t("rapt.tabs.bt")}</AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-6">
                    <p className="text-sm ">{t("rapt.description")}</p>

                    <p className="text-sm">
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

                    <p className="text-sm">
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
                          "inline-flex items-center gap-1"
                        )}
                      >
                        {currentButton.logo} {t("download")} {currentButton.os}
                      </a>
                    )}

                    <div className="flex flex-wrap gap-2">
                      {otherButtons.map((button) => (
                        <a
                          key={button.key}
                          href={button.href}
                          className={cn(
                            buttonVariants({ variant: "ghost" }),
                            "inline-flex items-center gap-1"
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
                <AccordionTrigger>{t("rapt.tabs.cloud")}</AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-6">
                    <div className="space-y-3">
                      <p className="text-sm">{t("rapt.cloud.description")}</p>

                      <ol className="list-decimal list-inside space-y-2 text-sm">
                        <li>
                          <Trans
                            i18nKey="rapt.cloud.steps.step1"
                            components={{
                              a: (
                                <a
                                  href="https://app.rapt.io/integration/webhooks/list"
                                  target="_blank"
                                  className="underline"
                                  rel="noopener noreferrer"
                                />
                              )
                            }}
                          />
                        </li>

                        <li>{t("rapt.cloud.steps.step2")}</li>

                        <li>{t("rapt.cloud.steps.step3")}</li>

                        <li>{t("rapt.cloud.steps.step4")}</li>

                        <p className="font-extrabold">
                          {t("rapt.cloud.importantNote")}
                        </p>

                        <li>{t("rapt.cloud.steps.step5")}</li>
                      </ol>
                    </div>

                    <div className="space-y-3">
                      <UrlCopyField
                        buttonDetails={{
                          url: pillCloudUrl,
                          buttonText: "cloudUrl"
                        }}
                      />
                      <TokenGen />
                    </div>

                    <div className="space-y-3">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <h3 className="text-lg font-medium">
                          {t("rapt.cloud.payloadTitle")}
                        </h3>

                        <label className="flex items-center gap-2 text-sm">
                          {t("rapt.tempUnitsLabel")}
                          <Select
                            name="deg"
                            onValueChange={setTempUnits}
                            value={tempUnits}
                          >
                            <SelectTrigger className="w-[120px]">
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
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </TabsContent>
      </div>
    </Tabs>
  );
}

export default Setup;

const UrlCopyField = ({
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
        description: t("iSpindelDashboard.copyError"),
        variant: "destructive"
      });
    }
  };

  return (
    <InputGroup className="max-w-[500px] w-full h-12">
      <InputGroupAddon>
        <InputGroupText>{t(buttonDetails.buttonText)}</InputGroupText>
      </InputGroupAddon>

      <InputGroupInput
        readOnly
        value={buttonDetails.url}
        placeholder={t("iSpindelDashboard.placeholder.generateToken")}
        className="text-center"
      />

      <InputGroupAddon align="inline-end">
        <InputGroupButton
          type="button"
          onClick={handleClick}
          className="w-full h-full"
        >
          {copied ? (
            <CopyCheck className="h-4 w-4 text-green-500" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
          <span className="sr-only">{t("iSpindelDashboard.copyUrl")}</span>
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  );
};
