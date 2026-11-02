import type { BatchDetails } from "../../components/extraCalcs/Trials";
import { benchTrial } from "@meadtools/core/extra-calculators";
import { parseNumber } from "./validateInput";

export function calculateAdjunctValues(
  volume: string,
  batchDetails: BatchDetails
) {
  return benchTrial(
    parseNumber(volume),
    parseNumber(batchDetails.stockSolutionConcentration),
    parseNumber(batchDetails.sampleSize),
    parseNumber(batchDetails.batchSize),
    batchDetails.units === "gallon" ? "gallon" : "liter"
  );
}
