// determines volume units
function determineUnits() {
  let select = document.getElementById("units")
  let selectedValue = select.value
  return selectedValue
}

// rounding function allows b to be value for number of places
function round(a, b) {
  const result = Math.round(a * 10 ** b) / 10 ** b
  return result
}
function calcSulfite() {
  let kMetaUnits = determineUnits()
  const batchSize = document.getElementById("batchSize").value;
  const ppmDesired = document.getElementById("ppm").value;
  let ppmSulfite

  // evaluates given volume based on units
  if (kMetaUnits == "gal") { ppmSulfite = round(((batchSize * 3.785 * ppmDesired) / 570), 3) }
  else { ppmSulfite = round(((batchSize * ppmDesired) / 570), 3) }
  return ppmSulfite
}

// displays amount of sulfite
function displaySulfite() {
  let display = calcSulfite() + "g k-meta"
  document.getElementById("displayPPM").innerHTML = display
}

