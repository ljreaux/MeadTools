// rounding function allows b to be value for number of places
function round(a, b) {
  const result = Math.round(a * 10 ** b) / 10 ** b;
  return result;
}

const refracObj = {
  cf: 1,
  units: "brix",
};

const correctionFactorInput = document.getElementById("correction");
correctionFactorInput.addEventListener("change", correctionFactor);
// sets value to correction factor
function correctionFactor() {
  const correctionFactor = correctionFactorInput.value;
  refracObj.cf = Number(correctionFactor);
}

const unitOption = document.getElementById("ogUnits");
unitOption.addEventListener(
  "change",
  () => (refracObj.units = unitOption.value)
);

const originalGravityField = document.getElementById("correctOG");
originalGravityField.addEventListener("change", calcOG);
// converts OG to brix
function calcOG() {
  const OG = originalGravityField.value;
  const OGBrix = -668.962 + 1262.45 * OG - 776.43 * OG ** 2 + 182.94 * OG ** 3;
  const toSG =
    1.00001 +
    0.0038661 * OG +
    1.3488 * 10 ** -5 * OG ** 2 +
    4.3074 * 10 ** -8 * OG ** 3;

  if (refracObj.units == "brix") {
    refracObj.ogBr = Number(OG);
    refracObj.og = round(toSG, 3);
  } else {
    refracObj.ogBr = round(OGBrix, 2);
    refracObj.og = Number(OG);
  }
}

const finalGravityField = document.getElementById("correctFG");
finalGravityField.addEventListener("change", calc);

function calc() {
  const FG = finalGravityField.value;
  const toSG =
    1.00001 +
    0.0038661 * FG +
    1.3488 * 10 ** -5 * FG ** 2 +
    4.3074 * 10 ** -8 * FG ** 3;
  refracObj.measuredFGBrix = Number(FG);
  refracObj.measuredFG = round(toSG, 3);

  const ogBr = refracObj.ogBr;
  const fgBr = refracObj.measuredFGBrix;
  const corFac = refracObj.cf;

  const correctedFG = refracCalc(ogBr, fgBr, corFac);
  refracObj.correctedFG = round(correctedFG, 3);

  const finalGravity = refracObj.correctedFG;
  document.getElementById("corSG").innerHTML = refracObj.measuredFG;

  const abv = ABV(refracObj.og, finalGravity);
  refracObj.abv = abv;

  const FGBrix =
    -668.962 +
    1262.45 * finalGravity -
    776.43 * finalGravity ** 2 +
    182.94 * finalGravity ** 3;

  refracObj.correctedFGBrix = round(FGBrix, 2);
  const delleUnits = delle(FGBrix, abv);
  refracObj.delle = delleUnits;
}

// uses fg and ABV to find delle units
function delle(brix, abv) {
  let delle = brix + 4.5 * abv;
  delle = round(delle, 0);
  return delle;
}

// calculates corrected FG
function refracCalc(ogBr, fgBr, corFac) {
  const correction =
    -0.002349 * (ogBr / corFac) + 0.006276 * (fgBr / corFac) + 1;
  return correction;
}

// calculates abv
function ABV(OG, FG) {
  const OE = -668.962 + 1262.45 * OG - 776.43 * OG ** 2 + 182.94 * OG ** 3;
  const AE = -668.962 + 1262.45 * FG - 776.43 * FG ** 2 + 182.94 * FG ** 3;
  const q = 0.22 + 0.001 * OE;
  const RE = (q * OE + AE) / (1 + q);

  const ABW = (OE - RE) / (2.0665 - 0.010665 * OE);
  let ABV = ABW * (FG / 0.794);
  ABV = round(ABV, 2);

  return ABV;
}

const correctionSubmit = document.getElementById("runCorrection");
correctionSubmit.addEventListener("click", display);
// displays all data on screen
function display() {
  const { correctedFGBrix, correctedFG, abv, delle } = refracObj;
  // displays results on page

  if (correctedFGBrix && correctedFG && abv && delle) {
    document.getElementById("disCorrectFunc").innerHTML =
      correctedFGBrix + " Brix, " + correctedFG;
    document.getElementById("disCorrectABV").innerHTML =
      abv + "% ABV, " + delle + " Delle Units";
  } else {
    document.getElementById("disCorrectFunc").innerHTML =
      "Please Enter a Valid Input";
  }
}
