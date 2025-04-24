"use client";

import { HydrometerData } from "@/components/ispindel/HydrometerData";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Trans, useTranslation } from "react-i18next";

function Devices() {
  const { t } = useTranslation();
  const [chartData, setChartData] = useState(null);

  useEffect(() => {
    const fetchChartData = async () => {
      const res = await fetch("/testChart.json");
      const data = await res.json();
      setChartData(data);
    };
    fetchChartData();
  }, []);

  return (
    <div className="flex flex-col items-center justify-center gap-4 my-4 text-center">
      <p>{t("iSpindelDashboard.home.welcome")}</p>
      <p className="text-start w-full">
        <Trans
          i18nKey="iSpindelDashboard.home.subtitle"
          components={{
            a: (
              <Link
                href={"/account/hydrometer/setup"}
                className="underline font-bold"
              >
                The setup page
              </Link>
            ),
          }}
        />
      </p>
      <p className="text-start">{t("iSpindelDashboard.home.features")}</p>
      <p>{t("sampleChartLabel")}</p>
      {chartData && <HydrometerData chartData={chartData} tempUnits={"F"} />}
    </div>
  );
}

export default Devices;
