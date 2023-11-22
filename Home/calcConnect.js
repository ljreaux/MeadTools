// determines volume for nute calculator
function addVolume2() {
  const t1 = document.getElementById("totalVol").innerHTML;
  const t2 = document.getElementById("totalVol2").innerHTML;
  const t3 = document.getElementById("waterVol").value;
  const total = Number(t1) + Number(t2) + Number(t3)
  return total
}

// sets volume units to match ingredient calc
function setVolume(){
  const calUnits = document.getElementById("volUnits").value
  const totalVol = addVolume2()
  let unit

  if (calUnits=='gal'){
    document.getElementById("nuteVolUnits").value='gal'
  } else if (calUnits=='liters'){
    document.getElementById("nuteVolUnits").value='liters'
  }
  document.getElementById("Volume").value= round(totalVol, 4)
}

// sets sg to match ingredient calc
function setSG(){
  let sg = document.getElementById("estOG").innerHTML
  document.getElementById("sgMeasurement").value= Number(sg)
}

