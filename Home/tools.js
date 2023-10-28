const num = 8.345

// rounding function allows b to be value for number of places
function round (a, b){
  const result = Math.round(a*10**b)/10**b
  return result}

// converts brix to SG for ABV calc
function ingredientSG(a) {
  const gravityReading = document.getElementById(a).innerHTML;

  const toSG = 1.00001 + 0.0038661 * gravityReading + (1.3488 * 10 ** -5) * (gravityReading) ** 2 + (4.3074 * 10 ** -8) * (gravityReading) ** 3

  return toSG
}

function calcGal(a, w, b) {
  const gravityReading = document.getElementById(w);
  let gr= gravityReading.value
  let SG = ingredientSG(a)
  let answer = gr/num/SG
  const roundedvol = round(answer, 4)
  document.getElementById(b).innerHTML= roundedvol;
}

function addVolume(){
  const t1 = document.getElementById("totalVol").innerHTML;
  const t2 = document.getElementById("totalVol2").innerHTML;
  const total = Number(t1)+Number(t2)
  document.getElementById("addedVol").innerHTML= total +" gal"
}