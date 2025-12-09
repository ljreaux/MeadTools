import Link from "next/link";
import initTranslations from "@/lib/i18n";
import { HydrometerData } from "@/components/ispindel/HydrometerData";
import { Trans } from "react-i18next/TransWithoutContext";
import chartData from "@/public/testChart.json"; // static import

async function HydrometerHome({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const { t } = await initTranslations(locale, ["default", "YeastTable"]);

  return (
    <div className="flex flex-col items-center justify-center gap-4 my-4 text-center">
      <p>{t("iSpindelDashboard.home.welcome")}</p>

      <p className="text-start w-full">
        <Trans
          t={t}
          i18nKey="iSpindelDashboard.home.subtitle"
          components={{
            a: (
              <Link
                href="/account/hydrometer/setup"
                className="underline font-bold"
              />
            )
          }}
        />
      </p>

      <p className="text-start">{t("iSpindelDashboard.home.features")}</p>

      <p>{t("sampleChartLabel")}</p>
      <HydrometerData chartData={chartData} tempUnits="F" />
    </div>
  );
}

export default HydrometerHome;
