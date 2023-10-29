const num = 8.345

// rounding function allows b to be value for number of places
function round(a, b) {
  const result = Math.round(a * 10 ** b) / 10 ** b
  return result
}

// converts brix to SG for ABV calc
function ingredientSG(a) {
  const gravityReading = document.getElementById(a).innerHTML;

  const toSG = 1.00001 + 0.0038661 * gravityReading + (1.3488 * 10 ** -5) * (gravityReading) ** 2 + (4.3074 * 10 ** -8) * (gravityReading) ** 3

  return toSG
}

function calcGal(a, w, b) {
  const gravityReading = document.getElementById(w);
  let gr = gravityReading.value
  let SG = ingredientSG(a)
  let answer = gr / num / SG
  const roundedvol = round(answer, 4)
  document.getElementById(b).innerHTML = roundedvol;
  return roundedvol
}

function addVolume() {
  const t1 = document.getElementById("totalVol").innerHTML;
  const t2 = document.getElementById("totalVol2").innerHTML;
  const total = Number(t1) + Number(t2)
  document.getElementById("addedVol").innerHTML = round(total, 4) + " gal"
  return total
}

// blending equation
function blending(a, b, c, d) {
  const blendedValue = ((a * c) + (b * d)) / (c + d)
  return blendedValue
}

function blendSG() {
  const value1 = ingredientSG("ingredientBrix")
  const value2 = ingredientSG("ingredientBrix2")

  const volume1 = document.getElementById("totalVol").innerHTML
  const volume2 = document.getElementById("totalVol2").innerHTML

  const val1 = Number(value1)
  const val2 = Number(value2)
  const vol1 = Number(volume1)
  const vol2 = Number(volume2)

  // blending equation
  const blendedValue = blending(val1, val2, vol1, vol2)

  // rounds answers 
  const roundedBlend = round(blendedValue, 3)
  
  // displays value to screen
  document.getElementById("estOG").innerHTML = roundedBlend
  return (roundedBlend)
}

// calculates abv 
function MeadToolsABV(OG, FG) {
  const OE = (-668.962 + 1262.45 * OG - 776.43 * (OG ** 2) + 182.94 * (OG ** 3))
  const AE = (-668.962 + 1262.45 * FG - 776.43 * (FG ** 2) + 182.94 * (FG ** 3))
  const q = (.22 + .001 * OE)
  const RE = (q * OE + AE) / (1 + q)

  const ABW = (OE - RE) / (2.0665 - 0.010665 * OE)
  const ABV = (ABW * (FG / 0.794))
  const roundedABV = round(ABV, 2)

  return roundedABV
}

function runMTABV(){
  const OG = blendSG()
  const FG = document.getElementById("estFG").value
  const ABV = MeadToolsABV(OG, FG)
  document.getElementById("estABV").innerHTML = ABV + "%"
  return ABV
}

// calculates delle units
function delleUnits(a, b) {
  const result = a + 4.5 * (b)
  return Math.round(result)
}

function displayDelle(){
  const ABVstring = runMTABV()
  const FGstring = document.getElementById("estFG").value
  const ABV = Number(ABVstring)
  const FG = Number (FGstring)
  const DU = delleUnits(FG, ABV)
  document.getElementById("estDelle").innerHTML = DU 
}

function displayStuff(){
  displayDelle()
  addVolume()
}