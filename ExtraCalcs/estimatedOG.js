const dataObj = {};

const fgh = document.querySelector("#hydroFG");

fgh.addEventListener("change", updateDataObj);
function updateDataObj() {
  dataObj.fgh = Number(fgh.value);
  dataObj.fgr = Number(fgr.value);
  dataObj.fgbr = readingtoBrix(dataObj.fgh);
  dataObj.og = estimatedOG(dataObj.fgh, dataObj.fgr);
  dataObj.ogbr = readingtoBrix(dataObj.og);
  dataObj.abv = ABV(dataObj.og, dataObj.fgh);
  dataObj.delle = delle(dataObj.fgbr, dataObj.abv);

  function displayBrix() {
    document.querySelector("#fgInBrix").innerHTML = dataObj.fgbr + " Brix";
  }
  displayBrix();
}

const fgr = document.querySelector("#refracFG");
fgr.addEventListener("change", updateDataObj);

const submitButton = document.querySelector("#estOGSubmit");
submitButton.addEventListener("click", displayCalc);

// rounding function allows b to be value for number of places
function round(a, b) {
  const result = Math.round(a * 10 ** b) / 10 ** b;
  return result;
}

// calculates ABV
function ABV(OG, FG) {
  const OE = -668.962 + 1262.45 * OG - 776.43 * OG ** 2 + 182.94 * OG ** 3;
  const AE = -668.962 + 1262.45 * FG - 776.43 * FG ** 2 + 182.94 * FG ** 3;
  const q = 0.22 + 0.001 * OE;
  const RE = (q * OE + AE) / (1 + q);

  const ABW = (OE - RE) / (2.0665 - 0.010665 * OE);
  let ABV = ABW * (FG / 0.794);
  ABV = round(ABV, 2);

  return ABV;
}

// uses fg and ABV to find delle units
function delle(fgBrix, abv) {
  let delle = fgBrix + 4.5 * abv;
  delle = round(delle, 0);
  return delle;
}

// converts OG to brix
function readingtoBrix(OG) {
  const OGBrix = -668.962 + 1262.45 * OG - 776.43 * OG ** 2 + 182.94 * OG ** 3;
  return round(OGBrix, 2);
}

// calculates estimated OG
function estimatedOG(fgh, fgr) {
  return round(-1.728 * fgh + 0.01085 * fgr + 2.728, 3);
}

// takes input and runs estimated OG calc
function displayCalc() {
  if (dataObj.abv) {
    // displays estimated OG on screen
    document.getElementById("estOG").innerHTML = dataObj.og;

    // displays Brix on screen
    document.getElementById("estOGBrix").innerHTML = dataObj.ogbr + " Brix";

    // calculates and displays ABV
    const estABV = dataObj.abv;
    document.getElementById("estABV").innerHTML = estABV + "% ABV";

    // calculates DU and displays to the screen
    const delleUnits = dataObj.delle;

    document.getElementById("estDelle").innerHTML = delleUnits + " Delle Units";
  } else {
    alert("Invalid Input");
  }
}
