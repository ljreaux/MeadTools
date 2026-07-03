import { BatchDetails } from "../../components/extraCalcs/Trials";
import { parseNumber } from "./validateInput";

function calculateAdjunctAmount(
  volume: number,
  stockSolutionConcentration: number
) {
  return Math.round(volume * stockSolutionConcentration * 10 ** 6) / 10 ** 8;
}

function calculateAdjunctConcentration(
  adjunctAmount: number,
  totalVolume: number
) {
  return Math.round((adjunctAmount / totalVolume) * 10 ** 6) / 10 ** 6;
}

function scaleAdjunctConcentration(
  adjunctConcentration: number,
  units: string
) {
  return units === "gallon"
    ? Math.round(adjunctConcentration * 37850000) / 10 ** 4
    : Math.round(adjunctConcentration * 10 ** 4) / 10;
}

function calculateScaledBatch(scaledAdjunct: number, batchSize: number) {
  return Math.round(scaledAdjunct * batchSize * 10 ** 4) / 10 ** 4;
}

export function calculateAdjunctValues(
  volume: string,
  batchDetails: BatchDetails
) {
  const { stockSolutionConcentration, sampleSize, units, batchSize } =
    batchDetails;

  const adjunctAmount = calculateAdjunctAmount(
    parseNumber(volume),
    parseNumber(stockSolutionConcentration)
  );
  const adjunctConcentration = calculateAdjunctConcentration(
    adjunctAmount,
    parseNumber(sampleSize) + parseNumber(volume)
  );
  const scaledAdjunct = scaleAdjunctConcentration(adjunctConcentration, units);
  const scaledBatch = calculateScaledBatch(
    scaledAdjunct,
    parseNumber(batchSize)
  );

  return {
    adjunctAmount,
    adjunctConcentration: adjunctConcentration * 10 ** 6,
    scaledAdjunct,
    scaledBatch,
  };
}
