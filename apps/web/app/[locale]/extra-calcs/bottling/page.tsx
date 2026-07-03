"use client";

import {
  BottlingCalculator,
  useBottlingRows
} from "@/components/extraCalcs/BottlingCalculator";

export default function Bottling() {
  const bottling = useBottlingRows();

  return <BottlingCalculator state={bottling} showTitle />;
}
