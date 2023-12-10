const blendButton = document.querySelector("#runBlendCal");
blendButton.addEventListener("click", runBlendCal);
// rounding function allows b to be value for number of places
function round(a, b) {
  const result = Math.round(a * 10 ** b) / 10 ** b;
  return result;
}

// blending equation
function blend(a, b, c, d) {
  const blendedNum = a * c + b * d;
  const blendedDen = Number(c) + Number(d);
  const blendedValue = blendedNum / blendedDen;
  return blendedValue;
}

// prints value to screen
function runBlendCal() {
  // blending equation
  const val1 = document.querySelector("#blendv1").value;
  const val2 = document.querySelector("#blendv2").value;

  const vol1 = document.querySelector("#blendvol1").value;
  const vol2 = document.querySelector("#blendvol2").value;
  let blendedValue = blend(val1, val2, vol1, vol2);

  // total volume equation
  let totalVol = Number(vol1) + Number(vol2);

  // rounds answers to 4 digits
  blendedValue = round(blendedValue, 4);
  totalVol = round(totalVol, 4);

  // displays value to screen
  document.getElementById("blendedValue").textContent =
    "Blended Value: " + blendedValue;
  document.getElementById("blendedVolume").textContent =
    "Total Volume: " + totalVol;
}
