const num = 8.345

// rounding function allows b to be value for number of places
function round(a, b) {
  const result = Math.round(a * 10 ** b) / 10 ** b
  return result
}

// determines units from OG form feild
function determineWeightUnits(a) {
  let select = document.getElementById(a)
  let selectedValue = select.value
  return selectedValue
}

// converts brix to SG for ABV calc
function ingredientSG(a) {
  const gravityReading = document.getElementById(a).innerHTML;

  const toSG = 1.00001 + 0.0038661 * gravityReading + (1.3488 * 10 ** -5) * (gravityReading) ** 2 + (4.3074 * 10 ** -8) * (gravityReading) ** 3

  return toSG
}

// displays ingredient volume
function calcGal(a, w, b) {
  let gravityReading = document.getElementById(w);
  let gr = gravityReading.value

  if(determineWeightUnits("mtUnits")=== "lbs"){
    gr = gr
  } else {
    gr = Number(gr)*2.20462
  }

  let SG = ingredientSG(a)
  let answer = gr / num / SG
  

  if(determineWeightUnits("volUnits")=== "gal"){
    answer= answer
  } else {answer= Number(answer)*3.78541}

  const roundedvol = round(answer, 4)
  document.getElementById(b).innerHTML = roundedvol;
  return roundedvol
}

// fills in total volume
function addVolume() {
  const t1 = document.getElementById("totalVol").innerHTML;
  const t2 = document.getElementById("totalVol2").innerHTML;
  const t3 = document.getElementById("waterVol").value;
  const total = Number(t1) + Number(t2) + Number(t3)

  if(determineWeightUnits("volUnits")=== "gal"){
  document.getElementById("addedVol").innerHTML = round(total, 4) + " gal"
  } else {document.getElementById("addedVol").innerHTML = round(total, 4) + " liters"}
  return total
}

// final calc for blend
function blend(numerator, denominator) {
  const answer = numerator / denominator
  return answer
}

// blending equation
function blending() {
  let t1 = ingredientSG("inputForJuice")
  let t2 = ingredientSG("ingredientBrix")
  let t3 = ingredientSG("ingredientBrix2")

  let vol1 = document.getElementById("waterVol").value
  let vol2 = document.getElementById("totalVol").innerHTML
  let vol3 = document.getElementById("totalVol2").innerHTML

  t1 = Number(t1)
  t2 = Number(t2)
  t3 = Number(t3)
  vol1 = Number(vol1)
  vol2 = Number(vol2)
  vol3 = Number(vol3)

  let numerator = (t1 * vol1) + (t2 * vol2) + (t3 * vol3)
  let denominator = vol1 + vol2 + vol3
  return blend(numerator, denominator)
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

function runMTABV() {
  let OG= blending()

  const FG = document.getElementById("estFG").value
  const ABV = MeadToolsABV(OG, FG)

  document.getElementById("estABV").innerHTML = ABV + "%"
  document.getElementById("estOG").innerHTML = round(OG, 3)
  return ABV
}

// calculates delle units
function delleUnits(a, b) {
  const result = a + 4.5 * (b)
  return Math.round(result)
}

function displayDelle() {
  const ABVstring = runMTABV()
  const FGstring = document.getElementById("estFG").value
  const ABV = Number(ABVstring)
  const FG = Number(FGstring)
  const DU = delleUnits(FG, ABV)
  document.getElementById("estDelle").innerHTML = DU
}

function displayStuff() {
  displayDelle()
  addVolume()
}