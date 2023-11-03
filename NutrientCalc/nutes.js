
// rounding function allows b to be value for number of places
function round(a, b) {
  const result = Math.round(a * 10 ** b) / 10 ** b
  return result
}

// converts OG to brix
function ogBrix() {
  const OG = document.getElementById("sgMeasurement").value;
  const OGBrix = -668.962 + 1262.45 * (OG) - 776.43 * (OG ** 2) + 182.94 * (OG ** 3)
  let roundedBrix = round(OGBrix, 2)
  document.getElementById("nuteOG").innerHTML= roundedBrix + " Brix"
  return OGBrix
}

function calcGpl() {
  const ogSg = document.getElementById("sgMeasurement").value;
  const sugar = ogBrix()*ogSg*10
 return round(sugar, 4) 
}

function calcPPM(){
  let multiplier
  let nitroRequirement = document.getElementById("nitrogenRequirement").innerHTML
  if (nitroRequirement=="Low"){
    multiplier=.75
  } else if (nitroRequirement=="Medium"){
    multiplier= .9
  } else if (nitroRequirement=="High"){
    multiplier=1.25
  } else {multiplier=1.8}

  let targetYan= calcGpl()*multiplier
  let offsetPPM = document.getElementById("offsetYan").value
  targetYan= targetYan- offsetPPM
  const roundedYan= round(targetYan, 0)

  document.getElementById("targetYan").innerHTML = roundedYan+ " PPM"
  return roundedYan
}