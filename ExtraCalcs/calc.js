const brixObj = { fg: -1.04 };
const ABVobj = { fg: 0.996 };

const OGtoBrix = document.querySelector("#OG");
OGtoBrix.addEventListener("change", calcOgBrix);

const FGtoBrix = document.querySelector("#fg");
FGtoBrix.addEventListener("change", calcFgBrix);

const ABVSubmit = document.querySelector("#submitABV");
ABVSubmit.addEventListener("click", runABV);
// rounding function allows b to be value for number of places
function round(a, b) {
  const result = Math.round(a * 10 ** b) / 10 ** b;
  return result;
}

// calculates abv
function abvCalc() {
  // gets value OG/F.sgvalue from form elements
  const OG = ABVobj.og;
  const FG = ABVobj.fg;

  // actual ABV calculation
  const OE = -668.962 + 1262.45 * OG - 776.43 * OG ** 2 + 182.94 * OG ** 3;
  const AE = -668.962 + 1262.45 * FG - 776.43 * FG ** 2 + 182.94 * FG ** 3;
  const q = 0.22 + 0.001 * OE;
  const RE = (q * OE + AE) / (1 + q);
  const ABW = (OE - RE) / (2.0665 - 0.010665 * OE);
  let ABV = ABW * (FG / 0.794);

  ABVobj.oe = OE;
  ABVobj.ae = AE;
  ABVobj.q = q;
  ABVobj.re = RE;
  ABVobj.abw = ABW;
  // rounds ABV
  ABV = round(ABV, 2);
  ABVobj.abv = ABV;

  // check to see if ABV is a good value and returns error otherwise
  return ABV > 0 && ABV < 25
    ? ABV
    : alert("ERROR: Please enter a valid OG and FG");
}

// converts OG into brix
function calcOgBrix() {
  ABVobj.og = OGtoBrix.value;
  const OG = ABVobj.og;
  let OGBrix = -668.962 + 1262.45 * OG - 776.43 * OG ** 2 + 182.94 * OG ** 3;
  OGBrix = round(OGBrix, 2);
  document.getElementById("OGBrix").innerHTML = OGBrix + " Brix";
  brixObj.og = Number(OGBrix);
}

// converts FG into brix
function calcFgBrix() {
  ABVobj.fg = FGtoBrix.value;
  const FG = ABVobj.fg;
  let FGBrix = -668.962 + 1262.45 * FG - 776.43 * FG ** 2 + 182.94 * FG ** 3;
  FGBrix = round(FGBrix, 2);
  document.getElementById("FGBrix").innerHTML = FGBrix + " Brix";
  brixObj.fg = Number(FGBrix);
}

// uses fg and ABV to calculate delle units,
// rounds it to the nearest interger and adds "Delle Units" string
function calcDelle() {
  let delle = brixObj.fg + 4.5 * ABVobj.abv;
  delle = round(delle, 0);
  ABVobj.delle = delle;
}

// takes input from calcFgBrix(), rounds it and displays it on the page
function runFGBrix() {
  const roundedFG = round(calcFgBrix(), 2);
  document.getElementById("FGBrix").innerHTML = roundedFG + " Brix";
}

// displays abv when submit button is pressed.
function runABV() {
  const ABV = document.getElementById("ABV");
  const delle = document.getElementById("delle");
  abvCalc();
  calcDelle();
  if (ABVobj.abv < 25) {
    ABV.textContent = `${ABVobj.abv}% ABV`;
    delle.textContent = `${ABVobj.delle} Delle Units`;
  } else {
    ABV.textContent = "ERROR: Not a valid ABV for Fermentation";
    delle.textContent = "";
  }
}
