const sorbSubmit = document.querySelector("#runSorbate");
sorbSubmit.addEventListener("click", displaySorbate);

const sorbUnits = document.getElementById("sorbUnits");
sorbUnits.addEventListener("change", displaySorbate);

// determines volume units
function determineSorbUnits() {
  const sorbValue = sorbUnits.value;
  return sorbValue;
}

// rounding function allows b to be value for number of places
function round(a, b) {
  const result = Math.round(a * 10 ** b) / 10 ** b;
  return result;
}

function calcSorbate() {
  const kSorbUnits = determineSorbUnits();
  const sorbSize = document.getElementById("sorbSize").value;
  const sorbAbv = document.getElementById("sorbAbv").value;
  let gSorb = ((-sorbAbv * 25 + 400) / 0.75) * sorbSize;

  // evaluates given volume based on units
  return kSorbUnits == "gal"
    ? (gSorb = round(gSorb * 0.003785411784, 3))
    : (gSorb = round(gSorb / 1000, 3));
}

// displays amount of sorbate
function displaySorbate() {
  const display = calcSorbate() + "g k-sorbate";
  document.getElementById("disSorbPPM").innerHTML = display;
}
