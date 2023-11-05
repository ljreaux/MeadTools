// determines gravity units from dropdown menu
function determineGravityUnits() {
  const select = document.getElementById("gravityUnits")
  const selectedValue = select.value
  return selectedValue
}

// rounding function allows b to be value for number of places
function round(a, b) {
  const result = Math.round(a * 10 ** b) / 10 ** b
  return result
}

// converts brix to sg and vice versa
function calConvert() {
  // sets variables for gravity units and gets value from form element
  const gravityUnits = determineGravityUnits()
  const gravityReading = document.getElementById("gravityReading").value;

  // establishes equations for converting brix to sg or sg to brix
  const toBrix = -668.962 + 1262.45 * gravityReading - 776.43 * (gravityReading ** 2) + 182.94 * (gravityReading ** 3)
  const toSG = 1.00001 + 0.0038661 * gravityReading + (1.3488 * 10 ** -5) * (gravityReading ** 2) + (4.3074 * 10 ** -8) * (gravityReading ** 3)

  // determines which equation to use and returns correct value
  return (gravityUnits === "brix") ? toSG : toBrix
}

// displays correct value
function displayConvert() {
  const gravityUnits = determineGravityUnits()
  let display

  // sets value of display, rounds to the correct number of places, 
  // and adds a string to display units
  gravityUnits === "brix" ? display = round(calConvert(), 3) : 
  display = round(calConvert(), 2) + " Brix"
  
  // displays value on screen
  document.getElementById("disConvertFunc").innerHTML = display
}