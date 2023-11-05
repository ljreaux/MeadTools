// sets value to correction factor
function correctionFactor() {
  const correctionFactor = document.getElementById("correction").value
  return correctionFactor
}

// rounding function allows b to be value for number of places
function round(a, b) {
  const result = Math.round(a * 10 ** b) / 10 ** b
  return result
}

// determines units from OG form feild
function determineCorUnits() {
  const select = document.getElementById("ogUnits")
  const selectedValue = select.value
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
  let delle = fgBrix() + 4.5 * (ABV())
  delle = round(delle, 0)
  return delle + " Delle Units"
}

// displays og as other unit and rounds
function runCorOGBrix() {
  const roundedOG = round(ogBrix(), 2)
  const brixtosg = round(cal("correctOG"), 3)

  // determines if value is sg or brix and displays as the converted value
  determineCorUnits() == "sg" ?
    document.getElementById("displayCorOG").innerHTML = roundedOG + " Brix" :
    document.getElementById("displayCorOG").innerHTML = brixtosg;
}

// displays FG brix as SG
function displaySG() {
  const roundedFG = round(cal("correctFG"), 3)
  document.getElementById("corSG").innerHTML = roundedFG
}

// calculates corrected FG
function refracCalc(ogBr, fgBr, corFac) {
  const correction = -0.002349 * (ogBr / corFac) + 0.006276 * (fgBr / corFac) + 1
  return correction
}

// run correction factor
function runCorrection() {
  const ogBr = document.getElementById("correctOG").value
  const fgBr = document.getElementById("correctFG").value
  const cf = correctionFactor()
  let calc

  // determines whether OG is in brix or sg and calculates appropriately
  determineCorUnits() == "brix" ? calc = refracCalc(ogBr, fgBr, cf) : 
  calc = refracCalc(ogBrix(), fgBr, cf)

  // rounds numbers
  calc = round(calc, 3)
  return calc
}

// calculates abv 
function ABV(OG, FG) {
  const OE = (-668.962 + 1262.45 * OG - 776.43 * (OG ** 2) + 182.94 * (OG ** 3))
  const AE = (-668.962 + 1262.45 * FG - 776.43 * (FG ** 2) + 182.94 * (FG ** 3))
  const q = (.22 + .001 * OE)
  const RE = (q * OE + AE) / (1 + q)

  const ABW = (OE - RE) / (2.0665 - 0.010665 * OE)
  let ABV = (ABW * (FG / 0.794))
  ABV = round(ABV, 2)

  return ABV
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
  let brix = -668.962 + 1262.45 * (sg) - 776.43 * (sg ** 2) + 182.94 * (sg ** 3)
  brix = round(brix, 2)

  // determines sg units, and calculates abv
  let corABV
  determineCorUnits() == "brix" ? corABV = ABV(cal("correctOG"), sg):
  corABV = ABV(document.getElementById("correctOG").value, sg);

  const delleUnits = delleCor(corABV, sg)

  // displays results on page
  document.getElementById("disCorrectFunc").innerHTML = (brix + " Brix, ") + sg
  document.getElementById("disCorrectABV").innerHTML = (corABV + "% ABV, ") + delleUnits + " Delle Units"
}