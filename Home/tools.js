// conversion factor to determine volume
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

// returns the brix to sg of each ingredient
function liquidIngredientSG(a) {
  let gravityReading = document.getElementById(a).value;

  let toSG = 1.00001 + 0.0038661 * gravityReading + (1.3488 * 10 ** -5) * (gravityReading) ** 2 + (4.3074 * 10 ** -8) * (gravityReading) ** 3

  if (document.getElementById("juiceUnits").value == "SG") {
    toSG = gravityReading
  }
  return toSG
}

// displays ingredient volume
function calcGal(a, w, b) {
  let gravityReading = document.getElementById(w);
  let gr = gravityReading.value

  if (determineWeightUnits("mtUnits") !== "lbs") {
    gr = Number(gr) * 2.20462
  }

  let SG = ingredientSG(a)
  let answer = gr / num / SG


  if (determineWeightUnits("volUnits") !== "gal") {
    answer = Number(answer) * 3.78541
  }

  answer = round(answer, 4)
  document.getElementById(b).innerHTML = answer;
  return answer
}

// fills in total volume
function addVolume() {
  const t1 = document.getElementById("totalVol").innerHTML;
  const t2 = document.getElementById("totalVol2").innerHTML;
  const t3 = document.getElementById("waterVol").value;
  const t4 = document.getElementById("juiceVol").value
  const total = Number(t1) + Number(t2) + Number(t3) + Number(t4)

  determineWeightUnits("volUnits") === "gal" ?
    document.getElementById("addedVol").innerHTML = round(total, 4) + " gal"
    : document.getElementById("addedVol").innerHTML = round(total, 4) + " liters"
  return total
}

// final calc for blend
function blend(numerator, denominator) {
  const answer = numerator / denominator
  return answer
}

// blending equation; wil probably refactor to a loop at some point
function blending() {
  let t1 = ingredientSG("water")
  let t2 = ingredientSG("ingredientBrix")
  let t3 = ingredientSG("ingredientBrix2")
  let t4 = liquidIngredientSG("inputForJuice")

  let vol1 = document.getElementById("waterVol").value
  let vol2 = document.getElementById("totalVol").innerHTML
  let vol3 = document.getElementById("totalVol2").innerHTML
  let vol4 = document.getElementById("juiceVol").value

  t1 = Number(t1)
  t2 = Number(t2)
  t3 = Number(t3)
  vol1 = Number(vol1)
  vol2 = Number(vol2)
  vol3 = Number(vol3)
  vol4 = Number(vol4)

  let numerator = (t1 * vol1) + (t2 * vol2) + (t3 * vol3) + (t4 * vol4)
  let denominator = vol1 + vol2 + vol3 + vol4
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

// runs ABV
function runMTABV() {
  let OG = blending()

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

// k-sorb (((-abv*25+400)/.75)/.75)*vol in liters
function kSorb() {
  const abv = runMTABV()
  let volume = addVolume()
  let stabilizers = document.getElementById("stabilizers").value
  if (determineWeightUnits("volUnits") === "gal") {
    volume = volume * 3.785411784
  }
  let kSorb = ((-abv * 25 + 400) / (.75 * 1000)) * volume
  kSorb = round(kSorb, 2)
  kSorb < 0 ? kSorb = "No k-sorb needed."
    : kSorb = kSorb + "g"

  stabilizers == "No" ? document.getElementById("kSorb").innerHTML = ""
    : document.getElementById("kSorb").innerHTML = kSorb

  return kSorb
}

// calculates amount of k-meta needed; would like to refactor if statement to be a simple equation at some point
function kMeta() {
  const takepH = document.getElementById("pHReading").value
  let pH = document.getElementById("pH").value
  pH = round(pH, 1)
  let ppm = 50
  let stabilizers = document.getElementById("stabilizers").value
  let volume = addVolume()
  if (determineWeightUnits("volUnits") === "gal") {
    volume = volume * 3.785411784
  }
  if (takepH == "No") {
    ppm = 50
  } else if (pH < 2.9) {
    ppm = 11
  } else if (pH == 3) {
    ppm = 13
  } else if (pH == 3.1) {
    ppm = 16
  } else if (pH == 3.2) {
    ppm = 21
  } else if (pH == 3.3) {
    ppm = 26
  } else if (pH == 3.4) {
    ppm = 32
  } else if (pH == 3.5) {
    ppm = 39
  } else if (pH == 3.6) {
    ppm = 49
  } else if (pH == 3.7) {
    ppm = 63
  } else if (pH == 3.7) {
    ppm = 63
  } else if (pH == 3.8) {
    ppm = 98
  } else if (pH > 3.9) {
    ppm = 123
  }

  let kMeta = volume * ppm / (1000 * .57)
  kMeta = round(kMeta, 2)
  kMeta < 0 ? kMeta = "No k-meta needed."
    : kMeta = kMeta + "g"

  stabilizers == "No" ? document.getElementById("kMeta").innerHTML = ""
    : document.getElementById("kMeta").innerHTML = kMeta

  return kMeta
}

// changes from brix to SG automatically
function changeJuiceUnits() {
  const juiceUnits = document.getElementById("juiceUnits").value
  let value
  let gravityReading = document.getElementById("inputForJuice").value
  if (juiceUnits == "SG") {
    value = 1.00001 + 0.0038661 * gravityReading + (1.3488 * 10 ** -5) * (gravityReading) ** 2 + (4.3074 * 10 ** -8) * (gravityReading) ** 3
    value = round(value, 3)
  } else {
    value = -668.962 + 1262.45 * gravityReading - 776.43 * gravityReading ** 2 + 182.94 * gravityReading ** 3
    value = round(value, 2)
  }

  document.getElementById("inputForJuice").value = value
}