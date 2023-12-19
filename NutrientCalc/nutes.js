const yeastObj = {};
const yeasts = "../yeast.json";

async function getYeasts() {
  const response = await fetch(yeasts);
  const data = await response.json();
  yeastObj.data = data;
}

async function displayYeasts() {
  await getYeasts();
  const selectYeastBrand = document.getElementById("yeastBrand");
  selectYeastBrand.addEventListener("change", changeStrainList);
  const yeastBrand = yeastObj.data;
  for (key in yeastBrand) {
    const option = document.createElement("option");
    option.textContent = key;
    selectYeastBrand.append(option);
  }
  const selectYeastName = document.getElementById("yeastName");
  const lalvin = yeastBrand.Lalvin;
  const lalvinYeastNames = lalvin.map((item) => {
    const option = document.createElement("option");
    option.textContent = item.name;
    return option;
  });
  const redStar = yeastBrand["Red Star"];
  const redStarYeastNames = redStar.map((item) => {
    const option = document.createElement("option");
    option.textContent = item.name;
    return option;
  });
  const mangroveJack = yeastBrand["Mangrove Jack"];
  const mangroveJackYeastNames = mangroveJack.map((item) => {
    const option = document.createElement("option");
    option.textContent = item.name;
    return option;
  });
  const other = yeastBrand["Other"];
  const otherYeastNames = other.map((item) => {
    const option = document.createElement("option");
    option.textContent = item.name;
    return option;
  });
  selectYeastName.replaceChildren(...lalvinYeastNames);
  function changeStrainList() {
    if (selectYeastBrand.value == "Lalvin") {
      selectYeastName.replaceChildren(...lalvinYeastNames);
    } else if (selectYeastBrand.value == "Red Star") {
      selectYeastName.replaceChildren(...redStarYeastNames);
    } else if (selectYeastBrand.value == "Mangrove Jack") {
      selectYeastName.replaceChildren(...mangroveJackYeastNames);
    } else {
      selectYeastName.replaceChildren(...otherYeastNames);
    }
  }
  displayNitrogen();
}
displayYeasts();

function displayNitrogen() {
  const data = yeastObj.data;
  const lalvin = data.Lalvin;
  const redStar = data["Red Star"];
  const mangrove = data["Mangrove Jack"];
  const other = data.Other;
  const selectYeastBrand = document.getElementById("yeastBrand");
  selectYeastBrand.addEventListener("change", changeNRequirement);
  const strain = document.getElementById("yeastName");
  strain.addEventListener("change", changeNRequirement);
  const nitrogenDisplay = document.getElementById("nitrogenRequirement");
  function changeNRequirement() {
    if (selectYeastBrand.value == "Lalvin") {
      const obj = lalvin.find((obj) => obj.name == strain.value);
      nitrogenDisplay.textContent = obj["Nitrogen Requirement"];
    } else if (selectYeastBrand.value == "Red Star") {
      const obj = redStar.find((obj) => obj.name == strain.value);
      nitrogenDisplay.textContent = obj["Nitrogen Requirement"];
    } else if (selectYeastBrand.value == "Mangrove Jack") {
      const obj = mangrove.find((obj) => obj.name == strain.value);
      nitrogenDisplay.textContent = obj["Nitrogen Requirement"];
    } else {
      const obj = other.find((obj) => obj.name == strain.value);
      nitrogenDisplay.textContent = obj["Nitrogen Requirement"];
    }
  }
}
// rounding function allows b to be value for number of places
function round(a, b) {
  const result = Math.round(a * 10 ** b) / 10 ** b;
  return result;
}

// converts OG to brix
function ogBrix() {
  const OG = document.getElementById("sgMeasurement").value;
  const OGBrix = -668.962 + 1262.45 * OG - 776.43 * OG ** 2 + 182.94 * OG ** 3;
  const roundedBrix = round(OGBrix, 2);
  document.getElementById("nuteOG").innerHTML = roundedBrix + " Brix";
  return OGBrix;
}

// calculates sugar in grams per liter
function calcGpl() {
  const ogSg = document.getElementById("sgMeasurement").value;
  const sugar = ogBrix() * ogSg * 10;
  return round(sugar, 4);
}

// calculates PPM of YAN needed
function calcPPM() {
  let multiplier;
  const nitroRequirement = document.getElementById(
    "nitrogenRequirement"
  ).innerHTML;

  // determines yeast nitrogen requirement and sets multiplier
  nitroRequirement == "Low"
    ? (multiplier = 0.75)
    : nitroRequirement == "Medium"
    ? (multiplier = 0.9)
    : nitroRequirement == "High"
    ? (multiplier = 1.25)
    : (multiplier = 1.8);

  let targetYan = calcGpl() * multiplier;
  const offsetPPM = document.getElementById("offsetYan").value;
  targetYan = targetYan - offsetPPM;
  const roundedYan = round(targetYan, 0);

  document.getElementById("targetYan").innerHTML = roundedYan + " PPM";
  return roundedYan;
}

// determines amount of fermaid O needed in grams per liter
function checkFermOPPM() {
  const totalPPM = calcPPM();
  const maxGPL = document.getElementById("fermOgpl").value;
  let toAddGPL;
  const target = totalPPM / 160;

  if (target > maxGPL) {
    toAddGPL = round(maxGPL, 2);
  } else {
    toAddGPL = round(target, 2);
  }
  document.getElementById("fermOToAdd").innerHTML = toAddGPL;
}

// calculates and displays needed PPM for each nutrient
function calcNPPM(a, b, c) {
  const nPPM = a * document.getElementById(b).innerHTML;
  document.getElementById(c).innerHTML = nPPM;
  return nPPM;
}

// calculates needed YAN for fermaid O and subtracts from the total
function fermOPPMN() {
  const totalPPM = calcPPM();
  checkFermOPPM();
  const fermONPPM = calcNPPM(160, "fermOToAdd", "fermOPpm");
  const leftOver = totalPPM - fermONPPM;
  return leftOver;
}

// determines amount of fermaid k needed in grams per liter
function checkFermKPPM() {
  const totalPPM = fermOPPMN();
  const maxGPL = document.getElementById("fermKgpl").value;
  let toAddGPL;
  const target = totalPPM / 100;

  target > maxGPL
    ? (toAddGPL = round(maxGPL, 2))
    : (toAddGPL = round(target, 2));

  document.getElementById("fermKToAdd").innerHTML = toAddGPL;
  return toAddGPL;
}

// calculates needed YAN for fermaid k and subtracts from the total
function fermKPPMN() {
  const totalPPM = fermOPPMN();
  checkFermKPPM();
  const fermKNPPM = calcNPPM(100, "fermKToAdd", "fermKPpm");
  const leftOver = totalPPM - fermKNPPM;
  return leftOver;
}

// determines amount of DAP needed in grams per liter
function checkDAPPPM() {
  const totalPPM = fermKPPMN();
  const maxGPL = document.getElementById("DAPgpl").value;
  let toAddGPL;
  const target = totalPPM / 210;

  target > maxGPL
    ? (toAddGPL = round(maxGPL, 2))
    : (toAddGPL = round(target, 2));

  document.getElementById("DAPToAdd").innerHTML = toAddGPL;
  return toAddGPL;
}

// calculates needed YAN for DAP and subtracts from the total
function DAPPPMN() {
  const totalPPM = fermKPPMN();
  checkDAPPPM();
  const DAPNPPM = calcNPPM(210, "DAPToAdd", "DAPPpm");
  const leftOver = totalPPM - DAPNPPM;
  return leftOver;
}

// calculates the toatl grams needed for each nutrient
function totalGrams(a, b) {
  const units = document.getElementById("nuteVolUnits").value;
  const gpl = document.getElementById(a).innerHTML;
  let vol = document.getElementById("Volume").value;
  let totalGrams;
  if (units === "gal") {
    vol *= 3.78541;
  }
  totalGrams = gpl * vol;
  totalGrams = round(totalGrams, 2);
  document.getElementById(b).innerHTML = totalGrams;
  return totalGrams;
}

// runs totalGrams for each Nutrient
function totalGramsAll() {
  const fermO = totalGrams("fermOToAdd", "fermOTotGrams");
  const fermK = totalGrams("fermKToAdd", "fermKTotGrams");
  const DAP = totalGrams("DAPToAdd", "DAPTotGrams");
  let diviser = document.getElementById("numAdd").value;
  diviser = Number(diviser);

  document.getElementById("fermOperAdd").innerHTML =
    round(fermO / diviser, 2) + "g Ferm O";
  document.getElementById("fermKperAdd").innerHTML =
    round(fermK / diviser, 2) + "g Ferm K";
  document.getElementById("DAPperAdd").innerHTML =
    round(DAP / diviser, 2) + "g DAP";
}

// determins where the 1/3 sugar break is and displays to screen
function determineSB() {
  const SG = document.getElementById("sgMeasurement").value - 1;
  let SB = SG * (2 / 3) + 1;
  SB = round(SB, 3);
  document.getElementById("oneThird").innerHTML = SB;
}

// determines the amount of yeast needed for the batch
function determineYeastAmount() {
  let multiplier;
  const units = document.getElementById("nuteVolUnits").value;
  let vol = document.getElementById("Volume").value;
  const SG = document.getElementById("sgMeasurement").value;
  if (units !== "gal") {
    vol /= 3.78541;
  }

  if (SG > 1.125) {
    multiplier = 4;
  } else if (SG > 1.1 && SG < 1.125) {
    multiplier = 3;
  } else {
    multiplier = 2;
  }

  const yeastAmount = vol * multiplier;
  document.getElementById("yeastAmount").value = round(yeastAmount, 0);
  const goFerm = yeastAmount * 1.25;
  const goFermWater = goFerm * 20;
  document.getElementById("go-fermGrams").innerHTML = round(goFerm, 2) + "g";
  document.getElementById("go-fermWater").innerHTML =
    round(goFermWater, 0) + "ml";
}

// used on home.html to change go-ferm amount based on amount of yeast
function determineGoFerm() {
  const yeastAmount = document.getElementById("yeastAmount").value;
  const goFerm = yeastAmount * 1.25;
  const goFermWater = goFerm * 20;
  document.getElementById("go-fermGrams").innerHTML = goFerm + "g";
  document.getElementById("go-fermWater").innerHTML = goFermWater + "ml";
}

// changes max GPL values for each nutrient schedule
function determineNuteSch() {
  const preferredSch = document.getElementById("nuteSchedule").value;
  const gravity = document.getElementById("sgMeasurement").value;

  if (preferredSch == "TOSNA") {
    document.getElementById("fermOgpl").value = 2.5;
    document.getElementById("fermKgpl").value = 0;
    document.getElementById("DAPgpl").value = 0;
  } else if (preferredSch == "FermK") {
    document.getElementById("fermOgpl").value = 0;
    document.getElementById("fermKgpl").value = 3;
    document.getElementById("DAPgpl").value = 0;
  } else if (preferredSch == "DAP") {
    document.getElementById("fermOgpl").value = 0;
    document.getElementById("fermKgpl").value = 0;
    document.getElementById("DAPgpl").value = 1.5;
  } else if (preferredSch == "OandDAP") {
    document.getElementById("fermOgpl").value = 1;
    document.getElementById("fermKgpl").value = 0;
    document.getElementById("DAPgpl").value = 0.96;
  } else if (preferredSch == "KandDAP") {
    document.getElementById("fermOgpl").value = 0;
    document.getElementById("fermKgpl").value = 1;
    document.getElementById("DAPgpl").value = 0.96;
  } else if (preferredSch == "OandK" && gravity <= 1.08) {
    document.getElementById("fermOgpl").value = 0.6;
    document.getElementById("fermKgpl").value = 0.81;
    document.getElementById("DAPgpl").value = 0;
  } else if (preferredSch == "OandK" && gravity <= 1.11) {
    document.getElementById("fermOgpl").value = 0.9;
    document.getElementById("fermKgpl").value = 0.81;
    document.getElementById("DAPgpl").value = 0;
  } else if (preferredSch == "OandK" && gravity > 1.11) {
    document.getElementById("fermOgpl").value = 1.1;
    document.getElementById("fermKgpl").value = 1;
    document.getElementById("DAPgpl").value = 0;
  } else {
    document.getElementById("fermOgpl").value = 0.45;
    document.getElementById("fermKgpl").value = 0.5;
    document.getElementById("DAPgpl").value = 0.96;
  }
}

// determines if there is any remaining YAN will probably want to refractor to depreciate a global variable at some point
function determineExtraYan() {
  let totalYAN = calcPPM();
  totalYAN = Number(totalYAN);
  let totalGramsO = document.getElementById("fermOPpm").innerHTML;
  totalGramsO = Number(totalGramsO);
  let totalGramsK = document.getElementById("fermKPpm").innerHTML;
  totalGramsK = Number(totalGramsK);
  let totalGramsDAP = document.getElementById("DAPPpm").innerHTML;
  totalGramsDAP = Number(totalGramsDAP);
  let remainingYAN = totalYAN - (totalGramsO + totalGramsK + totalGramsDAP);
  remainingYAN = round(remainingYAN, 0);

  // avoids negative YAN numbers that ocassionally pop up
  if (remainingYAN <= 1) {
    remainingYAN = 0;
  }
  document.getElementById("missingYan").innerHTML = remainingYAN + " PPM";
  document.getElementById("TotalYan").innerHTML = totalYAN + " PPM";
}

// allows for change of volume units automatically
function changeUnits() {
  const units = document.getElementById("nuteVolUnits").value;
  let vol = document.getElementById("Volume").value;

  units === "gal" ? (vol /= 3.78541) : (vol *= 3.78541);

  document.getElementById("Volume").value = round(vol, 2);
}
