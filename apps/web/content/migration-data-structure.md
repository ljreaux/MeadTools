# Proposed Data Structure and Migration Plan

## Current Local Storage

recipeData

```json
{
  "ingredients": [
    {
      "id": "e9M_SzF3",
      "name": "Water",
      "brix": "0.00",
      "details": ["0", "0.000"],
      "secondary": false,
      "category": "water"
    },
    {
      "id": "Fe8n9O3m",
      "name": "Honey",
      "brix": "79.60",
      "details": ["0", "0.000"],
      "secondary": false,
      "category": "sugar"
    }
  ],
  "OG": 0,
  "volume": "0",
  "ABV": 0,
  "FG": "0.996",
  "offset": "0",
  "units": { "weight": "lbs", "volume": "gal" },
  "additives": [{ "name": "", "amount": "", "unit": "g", "id": "YN9ejdAp" }],
  "sorbate": 0,
  "sulfite": 0,
  "campden": 0,
  "stabilizers": { "adding": false, "pH": false, "phReading": "3.6" }
}
```

nutrientData

```json
{
  "inputs": {
    "volume": "0",
    "sg": "0.004",
    "offset": "0",
    "numberOfAdditions": "1",
    "units": "gal"
  },
  "selected": {
    "yeastBrand": "Lalvin",
    "yeastStrain": "18-2007",
    "yeastDetails": {
      "id": 1,
      "brand": "Lalvin",
      "name": "18-2007",
      "nitrogen_requirement": "Low",
      "tolerance": "17",
      "low_temp": "55",
      "high_temp": "95"
    },
    "n2Requirement": "Low",
    "volumeUnits": "gal",
    "schedule": "tosna",
    "selectedNutrients": ["Fermaid O"]
  },
  "yanContribution": [40, 100, 210],
  "outputs": {
    "targetYan": 351,
    "yeastAmount": 0,
    "goFerm": { "type": "Go-Ferm", "amount": 0, "water": 0 }
  }
}
```

yanContribution

```json
[40, 100, 210, 0]
```

selectedGpl

```json
["2.5", "0", "0", "0"]
```

primaryNotes and secondaryNotes

```json
[{ "id": "Laj3K_DZ", "content": ["", ""] }]
```

otherNutrientName, recipeName

addingStabilizers

```json
{ "adding": false, "pH": false, "phReading": "3.6" }
```

stabilizerType

```text
kmeta
```

```json
[
  {
    "id": 371,
    "user_id": 1,
    "name": "Tutorial Recipe",
    "recipeData": "{\"ingredients\":[{\"id\":4,\"name\":\"Water\",\"brix\":\"0.00\",\"details\":[\"4.173\",\"0.5\"],\"secondary\":false,\"category\":\"water\"},{\"id\":1,\"name\":\"Honey\",\"brix\":\"79.60\",\"details\":[\"2.5\",\"0.212\"],\"secondary\":false,\"category\":\"sugar\"},{\"id\":11,\"name\":\"Blueberry\",\"brix\":\"9.36\",\"secondary\":false,\"category\":\"fruit\",\"details\":[\"3\",\"0.347\"]},{\"id\":1,\"name\":\"Honey\",\"brix\":\"79.6\",\"details\":[\"0.5\",\"0.042\"],\"secondary\":true,\"category\":\"sugar\"}],\"OG\":1.095,\"volume\":\"1.059\",\"ABV\":12.717657223334099,\"FG\":\"0.996\",\"offset\":\"70.822\",\"units\":{\"weight\":\"lbs\",\"volume\":\"gal\"},\"additives\":[{\"name\":\"Opti-Red\",\"amount\":\"1.101\",\"unit\":\"g\"},{\"name\":\"FT Rouge\",\"amount\":\"1.431\",\"unit\":\"g\"}],\"sorbate\":0.4386031716149188,\"sulfite\":0.35160657894736835,\"campden\":0.706}",
    "yanFromSource": null,
    "yanContribution": "[\"40\",\"100\",\"210\",\"0\"]",
    "nutrientData": "{\"inputs\":{\"volume\":\"1.059\",\"sg\":\"1.099\",\"offset\":\"71\",\"numberOfAdditions\":\"1\",\"units\":\"gal\"},\"selected\":{\"yeastBrand\":\"Other\",\"yeastStrain\":\"Kviek\",\"yeastDetails\":{\"id\":103,\"brand\":\"Other\",\"name\":\"Kviek\",\"nitrogen_requirement\":\"Very High\",\"tolerance\":\"12\",\"low_temp\":\"50\",\"high_temp\":\"65\"},\"n2Requirement\":\"Very High\",\"volumeUnits\":\"gal\",\"schedule\":\"tbe\",\"selectedNutrients\":[\"Fermaid O\",\"Fermaid K\",\"DAP\"]},\"yanContribution\":[40,100,210],\"outputs\":{\"targetYan\":351,\"yeastAmount\":3.07}}",
    "advanced": false,
    "nuteInfo": null,
    "primaryNotes": "[\"Put any notes you want here.\",\"Add dates, gravity readings, etc.\"]",
    "secondaryNotes": "[\"\",\"\"]",
    "private": false,
    "lastActivityEmailAt": null,
    "activityEmailsEnabled": false
  }
]
```
