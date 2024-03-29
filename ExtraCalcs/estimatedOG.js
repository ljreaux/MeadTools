// rounding function allows b to be value for number of places
function round(a, b) {
  const result = Math.round(a * 10 ** b) / 10 ** b
  return result
}

// calculates ABV
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

// uses fg and ABV to find delle units
function delle(fgBrix, abv) {
  let delle = fgBrix + 4.5 * abv
  delle = round(delle, 0)
  return delle + " Delle Units"
}

// converts OG to brix
function readingtoBrix(a) {
  const OG = document.getElementById(a).value;
  const OGBrix = -668.962 + 1262.45 * (OG) - 776.43 * (OG ** 2) + 182.94 * (OG ** 3)
  return OGBrix
}

// displays brix on the screen
function displayBrix() {
  document.getElementById("fgInBrix").innerHTML = round(readingtoBrix("hydroFG"), 2) + " Brix"
}

// calculates estimated OG
function estimatedOG(fgh, fgr) {
  return -1.728 * (fgh) + 0.01085 * (fgr) + 2.728
}

// takes input and runs estimated OG calc
function runOGCalc() {
  let fgh = document.getElementById("hydroFG").value
  let fgr = document.getElementById("refracFG").value
  fgh = Number(fgh)
  fgr = Number(fgr)

  let OG = estimatedOG(fgh, fgr)
  OG = round(OG, 3)

  // displays estimated OG on screen
  document.getElementById("estOG").innerHTML = OG

  // converts estimated OG to Brix
  let OGBrix = -668.962 + 1262.45 * (OG) - 776.43 * (OG ** 2) + 182.94 * (OG ** 3)
  OGBrix = round(OGBrix, 2)

  // displays Brix on screen
  document.getElementById("estOGBrix").innerHTML = OGBrix + " Brix"

  // calculates and displays ABV
  const estABV = ABV(OG, fgh)
  document.getElementById("estABV").innerHTML = estABV + "% ABV"

  // calculates DU and displays to the screen
  let fgInBrix = readingtoBrix("hydroFG")
  fgInBrix = round(fgInBrix, 2)
  const delleUnits = delle(fgInBrix, estABV)

  document.getElementById("estDelle").innerHTML = delleUnits
}
