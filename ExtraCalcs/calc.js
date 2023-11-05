// rounding function allows b to be value for number of places
function round(a, b) {
  const result = Math.round(a * 10 ** b) / 10 ** b
  return result
}

// calculates abv
function abvCalc() {
  // gets value OG/FG value from form elements
  const OG = document.getElementById("OG").value;
  const FG = document.getElementById("fg").value;

  // actual ABV calculation
  const OE = (-668.962 + 1262.45 * OG - 776.43 * (OG ** 2) + 182.94 * (OG ** 3))
  const AE = (-668.962 + 1262.45 * FG - 776.43 * (FG ** 2) + 182.94 * (FG ** 3))
  const q = (.22 + .001 * OE)
  const RE = (q * OE + AE) / (1 + q)
  const ABW = (OE - RE) / (2.0665 - 0.010665 * OE)
  const ABV = (ABW * (FG / 0.794))

  // rounds ABV
  const roundedABV = round(ABV, 2)

  // check to see if ABV is a good value and returns error otherwise
  return (roundedABV > 0 && roundedABV < 25) ? roundedABV :
    alert("ERROR: Please enter a valid OG and FG");
}

// converts OG into brix 
function calcOgBrix() {
  const OG = document.getElementById("OG").value;
  const OGBrix = -668.962 + 1262.45 * (OG) - 776.43 * (OG ** 2) + 182.94 * (OG ** 3)
  return OGBrix
}

// converts FG into brix 
function calcFgBrix() {
  const fg = document.getElementById("fg").value;
  const fgBrix = -668.962 + 1262.45 * (fg) - 776.43 * (fg ** 2) + 182.94 * (fg ** 3)
  return fgBrix
}

// uses fg and ABV to calculate delle units, 
// rounds it to the nearest interger and adds "Delle Units" string
function calcDelle() {
  const delle = calcFgBrix() + 4.5 * (abvCalc())
  const roundedDelle = round(delle, 0)
  return roundedDelle + " Delle Units"
}

// takes input from calcOgBrix(), rounds it and displays it on the page
function runOGBrix() {
  const roundedOG = round(calcOgBrix(), 2)
  document.getElementById("OGBrix").innerHTML = roundedOG + " Brix";
}

// takes input from calcFgBrix(), rounds it and displays it on the page
function runFGBrix() {
  const roundedFG = round(calcFgBrix(), 2)
  document.getElementById("FGBrix").innerHTML = roundedFG + " Brix";
}

// displays abv when submit button is pressed.
function runABV() {
  if (abvCalc() != undefined) {
    document.getElementById("ABV").innerHTML = abvCalc() + "%ABV ";
    document.getElementById("delle").innerHTML = calcDelle();
  } else {
    document.getElementById("ABV").innerHTML = "ERROR: Not a valid ABV for Fermentation";
  }
}


