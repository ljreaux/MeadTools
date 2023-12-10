const convertObj = {};

const convertButton = document.querySelector("#runConvert");
convertButton.addEventListener("click", calConvert);
const determineGravityReading = document.querySelector("#gravityReading");
const determineGravityUnits = document.querySelector("#gravityUnits");

determineGravityUnits.addEventListener("change", () => {
  if (!determineGravityReading.value) {
    return;
  } else {
    if (convertObj.isSg) {
      determineGravityReading.value = round(ConvertToSG(convertObj.gr), 3);
      calConvert();
      convertObj.isSg = false;
    } else {
      determineGravityReading.value = round(ConvertToBrix(convertObj.gr), 2);
      calConvert();
      convertObj.isSg = true;
    }
  }
});
// rounding function allows b to be value for number of places
function round(a, b) {
  const result = Math.round(a * 10 ** b) / 10 ** b;
  return result;
}

function ConvertToBrix(gravityReading) {
  return (
    -668.962 +
    1262.45 * gravityReading -
    776.43 * gravityReading ** 2 +
    182.94 * gravityReading ** 3
  );
}
function ConvertToSG(gravityReading) {
  return (
    1.00001 +
    0.0038661 * gravityReading +
    1.3488 * 10 ** -5 * gravityReading ** 2 +
    4.3074 * 10 ** -8 * gravityReading ** 3
  );
}
// converts brix to sg and vice versa
function calConvert() {
  // sets variables for gravity units and gets value from form element
  const gravityUnits = determineGravityUnits.value;
  convertObj.gu = gravityUnits;
  const gravityReading = determineGravityReading.value;
  convertObj.gr = gravityReading;
  // establishes equations for converting brix to sg or sg to brix
  const toBrix = ConvertToBrix(convertObj.gr);
  const toSG = ConvertToSG(convertObj.gr);

  convertObj.brix = toBrix;
  convertObj.sg = toSG;
  // determines which equation to use and returns correct value
  let display;

  // sets value of display, rounds to the correct number of places,
  // and adds a string to display units
  gravityUnits === "brix"
    ? (display = round(convertObj.sg, 3)) && (convertObj.isSg = true)
    : (display = round(convertObj.brix, 2) + " Brix") &&
      (convertObj.isSg = false);

  // displays value on screen
  document.getElementById("disConvertFunc").innerHTML = display;
}
