const tempCorObj = {};

const tempUnits = document.getElementById("tempUnits");
tempUnits.addEventListener("change", displayTempUnits);

const sgForm = document.querySelector("#hydroSG");
sgForm.addEventListener("change", updateCorObj);

const curTemp = document.querySelector("#currentTemp");
curTemp.addEventListener("change", updateCorObj);

const calTemp = document.querySelector("#calibrationTemp");
calTemp.addEventListener("change", updateCorObj);

const submitTempCor = document.querySelector("#runTempCal");
submitTempCor.addEventListener("click", disTempCorrection);

// determines units from OG form feild
function updateCorObj() {
  tempCorObj.tu = tempUnits.value;
  tempCorObj.sg = Number(sgForm.value);
  tempCorObj.sgBrix = convertToBrix(tempCorObj.sg);
  tempCorObj.curTemp = Number(curTemp.value);
  tempCorObj.calTemp = Number(calTemp.value);
  tempCorObj.correctedSG = runTempCorrection();
  tempCorObj.brix = round(convertToBrix(tempCorObj.correctedSG), 2);

  // displays OG as brix
  function displaySGBrix() {
    const ogBrix = round(tempCorObj.sgBrix, 2);
    document.getElementById("disHydroSG").innerHTML = ogBrix + " Brix";
  }
  displaySGBrix();
}

// rounding function allows b to be value for number of places
function round(a, b) {
  const result = Math.round(a * 10 ** b) / 10 ** b;
  return result;
}

// sets up temp correction
function temperatureCorrection(r, t, c) {
  const tempCorrect =
    r *
    ((1.00130346 -
      0.000134722124 * t +
      0.00000204052596 * t ** 2 -
      0.00000000232820948 * t ** 3) /
      (1.00130346 -
        0.000134722124 * c +
        0.00000204052596 * c ** 2 -
        0.00000000232820948 * c ** 3));
  return tempCorrect;
}

// runs temp correct function
function runTempCorrection() {
  // establishes units and SG
  const units = tempCorObj.tu;
  const SG = tempCorObj.sg;
  let result;

  // current temp in C and F
  const currentTemp = tempCorObj.curTemp;
  const convertedCurrentTemp = currentTemp * (9 / 5) + 32;

  // calibration temp in C and F
  const calTemp = tempCorObj.calTemp;
  const convertedCalTemp = calTemp * (9 / 5) + 32;

  // runs temp correction based off correct
  units == "°F"
    ? (result = temperatureCorrection(SG, currentTemp, calTemp))
    : (result = temperatureCorrection(
        SG,
        convertedCurrentTemp,
        convertedCalTemp
      ));

  // rounds and returns result
  result = round(result, 3);
  return result;
}

// generic funtion to turn SG to brix
function convertToBrix(OG) {
  const OGBrix = -668.962 + 1262.45 * OG - 776.43 * OG ** 2 + 182.94 * OG ** 3;
  return OGBrix;
}

// displays temp units next to calibration temp
function displayTempUnits() {
  updateCorObj();
  const tempUnits = tempCorObj.tu;
  document.getElementById("displayTempUnits").innerHTML = tempUnits;
}

// displays temp correction
function disTempCorrection() {
  const result = tempCorObj.correctedSG;
  const brix = tempCorObj.brix + " Brix";
  const display = `${result} , ${brix}`;
  document.getElementById("disTempCorrection").innerHTML = display;
}
