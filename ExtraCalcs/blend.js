// rounding function allows b to be value for number of places
function round(a, b) {
  const result = Math.round(a * 10 ** b) / 10 ** b
  return result
}

// blending equation
function blend(a, b, c, d) {
  const blendedValue = ((a * c) + (b * d)) / (c + d)
  return blendedValue
}

// prints value to screen
function runBlendCal() {
  const val1 = document.getElementById("blendv1").value
  const val2 = document.getElementById("blendv2").value

  const vol1 = document.getElementById("blendvol1").value
  const vol2 = document.getElementById("blendvol2").value

  // blending equation
  const blendedValue = blend(val1, val2, vol1, vol2)

  // total volume equation
  const totalVol = Number(vol1) + Number(vol2)

  // rounds answers to 4 digits
  const roundedBlend = round(blendedValue, 4)
  const roundedVol = round(totalVol, 4)

  // displays value to screen
  document.getElementById("blendedValue").innerHTML = "Blended Value: " + roundedBlend
  document.getElementById("blendedVolume").innerHTML = "Total Volume: " + roundedVol
}