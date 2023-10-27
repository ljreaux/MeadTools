// sets value to correction factor
function correctionFactor() {
  let correctionFactor = document.getElementById("correction").value
  return correctionFactor
}

// rounding function allows b to be value for number of places
function round(a, b) {
  const result = Math.round(a * 10 ** b) / 10 ** b
  return result
}

// determines units from OG form feild
function determineCorUnits() {
  let select = document.getElementById("ogUnits")
  let selectedValue = select.value
  return selectedValue
}

// converts OG to brix
function ogBrix() {
  const OG = document.getElementById("correctOG").value;
  const OGBrix = -668.962 + 1262.45 * (OG) - 776.43 * (OG ** 2) + 182.94 * (OG ** 3)
  return OGBrix
}

// converts brix to SG for ABV calc
function cal(a) {
  const gravityReading = document.getElementById(a).value;

  const toSG = 1.00001 + 0.0038661 * gravityReading + (1.3488 * 10 ** -5) * (gravityReading) ** 2 + (4.3074 * 10 ** -8) * (gravityReading) ** 3

  return toSG
}

// gets FG in brix from form feild
function fgBrix() {
  document.getElementById("correctFG").value
}

// uses fg and ABV to find delle units
function delle() {
  const delle = fgBrix() + 4.5 * (ABV())
  const roundedDelle = round(delle, 0)
  return roundedDelle + " Delle Units"
}

// displays og as other unit and rounds
function runCorOGBrix() {
  let roundedOG = round(ogBrix(), 2)
  let brixtosg = round(cal("correctOG"), 3)

  // determines if value is sg or brix and displays as the converted value
  if (determineCorUnits() == "sg") {
    document.getElementById("displayCorOG").innerHTML = roundedOG + " Brix";
  } else { document.getElementById("displayCorOG").innerHTML = brixtosg; }
}

// displays FG brix as SG
function displaySG() {
  let roundedFG = round(cal("correctFG"), 3)
  document.getElementById("corSG").innerHTML = roundedFG
}

// calculates corrected FG
function refracCalc(ogBr, fgBr, corFac) {
  const correction = -0.002349 * (ogBr / corFac) + 0.006276 * (fgBr / corFac) + 1
  return correction
}

// run correction factor
function runCorrection() {
  let ogBr = document.getElementById("correctOG").value
  let fgBr = document.getElementById("correctFG").value
  let cf = correctionFactor()
  let calc

  // determines whether OG is in brix or sg and calculates appropriately
  if (determineCorUnits() == "brix") {
    calc = refracCalc(ogBr, fgBr, cf)
  } else { calc = refracCalc(ogBrix(), fgBr, cf) }

  // rounds numbers
  const roundedRefrac = round(calc, 3)
  return roundedRefrac
}

// calculates abv 
function ABV(OG, FG) {
  const OE = (-668.962 + 1262.45 * OG - 776.43 * (OG ** 2) + 182.94 * (OG ** 3))
  const AE = (-668.962 + 1262.45 * FG - 776.43 * (FG ** 2) + 182.94 * (FG ** 3))
  const q = (.22 + .001 * OE)
  const RE = (q * OE + AE) / (1 + q)

  const ABW = (OE - RE) / (2.0665 - 0.010665 * OE)
  const ABV = (ABW * (FG / 0.794))
  const roundedABV = round(ABV, 2)

  return roundedABV
}

// calculates delle units
function delleCor(a, b) {
  const result = a + 4.5 * (b)
  return Math.round(result)
}

// displays all data on screen
function displayCorrection() {

  // converts result from sg to brix then rounds
  const sg = runCorrection()
  const brix = -668.962 + 1262.45 * (sg) - 776.43 * (sg ** 2) + 182.94 * (sg ** 3)
  const roundedBrix = round(brix, 2)

  // determines sg units, and calculates abv
  let corABV
  if (determineCorUnits() == "brix") {
    corABV = ABV(cal("correctOG"), sg)
  } else { corABV = ABV(document.getElementById("correctOG").value, sg) }

  const delleUnits = delleCor(corABV, sg)

  // displays results on page
  document.getElementById("disCorrectFunc").innerHTML = (roundedBrix + " Brix, ") + sg
  document.getElementById("disCorrectABV").innerHTML = (corABV + "% ABV, ") + delleUnits + " Delle Units"
}