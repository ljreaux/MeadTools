// determines volume units
function determineUnits() {
  const select = document.getElementById("units")
  const selectedValue = select.value
  return selectedValue
}

// rounding function allows b to be value for number of places
function round(a, b) {
  const result = Math.round(a * 10 ** b) / 10 ** b
  return result
}
function calcSulfite() {
  const kMetaUnits = determineUnits()
  const batchSize = document.getElementById("batchSize").value;
  const ppmDesired = document.getElementById("ppm").value;
  let ppmSulfite

  // evaluates given volume based on units
  return kMetaUnits == "gal" ?
    ppmSulfite = round(((batchSize * 3.785 * ppmDesired) / 570), 3) :
    ppmSulfite = round(((batchSize * ppmDesired) / 570), 3)
}

// displays amount of sulfite
function displaySulfite() {
  const display = calcSulfite() + "g k-meta"
  document.getElementById("displayPPM").innerHTML = display
}

