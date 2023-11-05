// determines units from OG form feild
function determineTempUnits() {
  const select = document.getElementById("tempUnits")
  const selectedValue = select.value
  return selectedValue
}

// rounding function allows b to be value for number of places
function round(a, b) {
  const result = Math.round(a * 10 ** b) / 10 ** b
  return result
}

// sets up temp correction
function temperatureCorrection(r, t, c) {
  const tempCorrect = r * ((1.00130346 - (0.000134722124 * t) + (0.00000204052596 * t ** 2) - (0.00000000232820948 * t ** 3)) / (1.00130346 - (0.000134722124 * c) + (0.00000204052596 * c ** 2) - (0.00000000232820948 * c ** 3)))
  return tempCorrect
}

// runs temp correct function
function runTempCorrection() {
  // establishes units and SG
  const units = determineTempUnits()
  const SG = document.getElementById("hydroSG").value;
  let result

  // current temp in C and F
  const currentTemp = document.getElementById("currentTemp").value;
  const convertedCurrentTemp = (currentTemp * (9 / 5)) + 32

  // calibration temp in C and F
  const calTemp = document.getElementById("calibrationTemp").value;
  const convertedCalTemp = (calTemp * (9 / 5)) + 32

  // runs temp correction based off correct 
  units == "°F" ? result = temperatureCorrection(SG, currentTemp, calTemp) :
  result = temperatureCorrection(SG, convertedCurrentTemp, convertedCalTemp)

  // rounds and returns result
  result = round(result, 3)
  return result
}

// generic funtion to turn SG to brix
function convertToBrix(a) {
  const OG = a
  const OGBrix = -668.962 + 1262.45 * (OG) - 776.43 * (OG ** 2) + 182.94 * (OG ** 3)
  return OGBrix
}

// displays OG as brix
function displaySGBrix() {
  const a = document.getElementById("hydroSG").value
  const ogBrix = convertToBrix(a)
  const roundedBrix = round(ogBrix, 2) + " Brix"
  document.getElementById("disHydroSG").innerHTML = roundedBrix
}

// displays temp units next to calibration temp
function displayTempUnits() {
  const tempUnits = determineTempUnits()
  document.getElementById("displayTempUnits").innerHTML = tempUnits
}

// displays temp correction
function disTempCorrection() {
  const result = runTempCorrection()
  const brix = round(convertToBrix(result), 2) + " Brix"
  const display = result + ", " + brix
  document.getElementById("disTempCorrection").innerHTML = display
}