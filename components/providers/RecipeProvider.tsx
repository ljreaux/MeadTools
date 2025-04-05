"use client";
import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import { NutrientProvider } from "./NutrientProvider";
import {
  Additive,
  AdditiveType,
  blankAdditive,
  blankIngredient,
  blankNote,
  genRandomId,
  Ingredient,
  IngredientDetails,
  initialData,
  Recipe,
  RecipeData,
  UnitType,
} from "@/types/recipeDataTypes";
import { calcABV, toBrix, toSG } from "@/lib/utils/unitConverter";
import { isValidNumber, parseNumber } from "@/lib/utils/validateInput";
import { blendValues } from "@/lib/utils/blendValues";
import lodash from "lodash";
import { useTranslation } from "react-i18next";

const RecipeContext = createContext<Recipe | undefined>(undefined);

export default function RecipeProvider({
  children,
  recipeName: providedName,
}: {
  children: ReactNode;
  recipeName?: string;
}) {
  const { t, i18n } = useTranslation();
  const currentLocale = i18n.resolvedLanguage;
  const [firstMount, setFirstMount] = useState(true);
  const [preferredUnits, setPreferredUnits] = useState("US");

  const [recipeData, setRecipeData] = useState({
    ...initialData,
    ingredients: initialData.ingredients.map((ing) => ({
      ...ing,
      id: genRandomId(),
    })),
  });
  const [ingredientList, setIngredientList] = useState<Ingredient[]>([]);
  const [loadingIngredients, setLoadingIngredients] = useState(true);
  const [additiveList, setAdditiveList] = useState<Additive[]>([]);
  const [loadingAdditives, setLoadingAdditives] = useState(true);
  const [primaryNotes, setPrimaryNotes] = useState([blankNote]);
  const [secondaryNotes, setSecondaryNotes] = useState([blankNote]);

  const [backsweetenedFG, setBacksweetenedFG] = useState(1);
  const [totalVolume, setTotalVolume] = useState(0);
  const [totalForAbv, setTotalForAbv] = useState(1);
  const [delle, setDelle] = useState(0);

  const [addingStabilizers, setAddingStabilizers] = useState(
    initialData?.stabilizers?.adding ?? false
  );
  const [takingPh, setTakingPh] = useState(
    initialData?.stabilizers?.pH ?? false
  );
  const [phReading, setPhReading] = useState(
    initialData?.stabilizers?.phReading ?? "3.6"
  );
  const [recipeName, setRecipeName] = useState(providedName || "");

  const [numberOfAdditions, setNumberOfAdditions] = useState("1");

  const addIngredient = () => {
    setRecipeData((prev) => ({
      ...prev,
      ingredients: [
        ...prev.ingredients,
        { ...blankIngredient, id: genRandomId() },
      ],
    }));
  };

  const removeIngredient = (id: string) => {
    setRecipeData((prev) => ({
      ...prev,
      ingredients: prev.ingredients.filter((ing) => {
        return id !== ing.id;
      }),
    }));
  };

  const changeIngredient = (
    ing: IngredientDetails,
    index: number,
    name: string
  ) => {
    const translatedName = t(lodash.camelCase(name));

    const foundIng = ingredientList.find((ing) => ing.name === name);

    if (foundIng) {
      const changed = {
        id: ing.id,
        name: translatedName, // Use the translated name
        brix:
          parseNumber(foundIng.sugar_content).toLocaleString(currentLocale, {
            maximumFractionDigits: 2,
          }) || "0",
        secondary: false,
        category: foundIng.category || "water",
      } as IngredientDetails;

      setRecipeData((prev) => ({
        ...prev,
        ingredients: prev.ingredients.map((ing, i) => {
          if (index === i) {
            return {
              ...changed,
              details: [
                ing.details[0],
                weightToVolume(
                  parseNumber(ing.details[0]),
                  parseNumber(changed.brix)
                ).toLocaleString(currentLocale, {
                  maximumFractionDigits: 3,
                }),
              ],
            };
          }
          return ing;
        }),
      }));
    } else {
      setRecipeData((prev) => ({
        ...prev,
        ingredients: prev.ingredients.map((ing, i) => {
          if (index === i) {
            return {
              ...ing,
              name, // Use the translated name
            };
          }
          return ing;
        }),
      }));
    }
  };

  const updateAdditives = (additives: AdditiveType[]) => {
    setRecipeData((prev) => ({
      ...prev,
      additives,
    }));
  };

  const changeAdditive = (id: string, name: string) => {
    const multiplier = recipeData.units.volume === "liter" ? 0.264172 : 1;
    const translatedName = t(lodash.camelCase(name));

    const foundAdd = additiveList.find((add) => add.name === name);

    if (foundAdd) {
      const changed = {
        name: translatedName,
        amount: (
          parseNumber(foundAdd.dosage) *
          multiplier *
          totalVolume
        ).toLocaleString(currentLocale, {
          maximumFractionDigits: 3,
        }),
        unit: foundAdd.unit,
        id,
      };

      setRecipeData((prev) => ({
        ...prev,
        additives: prev.additives.map((add) => (add.id == id ? changed : add)),
      }));
    } else {
      setRecipeData((prev) => ({
        ...prev,
        additives: prev.additives.map((add) => {
          if (add.id == id) {
            return {
              ...add,
              name, // Use the translated name
            };
          }
          return add;
        }),
      }));
    }
  };

  const changeAdditiveUnits = (id: string, unit: string) => {
    setRecipeData((prev) => ({
      ...prev,
      additives: prev.additives.map((add) =>
        add.id === id ? { ...add, unit } : add
      ),
    }));
  };

  const changeAdditiveAmount = (id: string, amount: string) => {
    setRecipeData((prev) => ({
      ...prev,
      additives: prev.additives.map((add) =>
        add.id === id ? { ...add, amount } : add
      ),
    }));
  };

  const addAdditive = () => {
    setRecipeData((prev) => {
      return {
        ...prev,
        additives: [...prev.additives, { ...blankAdditive, id: genRandomId() }],
      };
    });
  };

  const removeAdditive = (id: string) => {
    setRecipeData((prev) => ({
      ...prev,
      additives: prev.additives.filter((item) => item.id !== id),
    }));
  };

  const changeVolumeUnits = (unit: string) => {
    setRecipeData((prev) => ({
      ...prev,
      units: {
        ...prev.units,
        volume: unit as "gal" | "liter",
      },
    }));
  };

  const changeWeightUnits = (unit: string) => {
    setRecipeData((prev) => ({
      ...prev,
      units: {
        ...prev.units,
        weight: unit as "lbs" | "kg",
      },
    }));
  };

  const { units } = recipeData;
  const converter =
    units.weight === "kg" && units.volume === "liter"
      ? (8.345 * 0.453592) / 3.78541
      : units.weight === "kg"
        ? 8.345 * 0.453592
        : units.volume === "liter"
          ? 8.345 / 3.78541
          : 8.345;

  const volumeToWeight = (value: number, brix: number) =>
    value * converter * toSG(brix);

  const weightToVolume = (value: number, brix: number) =>
    value / converter / toSG(brix);

  const updateIngredientWeight = (
    ing: IngredientDetails,
    id: string,
    weight: string
  ) => {
    if (isValidNumber(weight)) {
      const updatedIngredient = {
        ...ing,
        details: [
          weight,
          weightToVolume(
            parseNumber(weight),
            parseNumber(ing.brix)
          ).toLocaleString(currentLocale, {
            maximumFractionDigits: 3,
          }),
        ] as [string, string],
      };
      setRecipeData((prev) => ({
        ...prev,
        ingredients: prev.ingredients.map((ing) =>
          id === ing.id ? updatedIngredient : ing
        ),
      }));
    }
  };

  const updateIngredientVolume = (
    ing: IngredientDetails,
    id: string,
    volume: string
  ) => {
    if (isValidNumber(volume)) {
      const updatedIngredient = {
        ...ing,
        details: [
          volumeToWeight(
            parseNumber(volume),
            parseNumber(ing.brix)
          ).toLocaleString(currentLocale, {
            maximumFractionDigits: 3,
          }),
          volume,
        ] as [string, string],
      };
      setRecipeData((prev) => ({
        ...prev,
        ingredients: prev.ingredients.map((ing) =>
          id === ing.id ? updatedIngredient : ing
        ),
      }));
    }
  };

  const updateBrix = (brix: string, id: string) => {
    if (isValidNumber(brix)) {
      setRecipeData((prev) => {
        const ingredients = prev.ingredients.map((ing) =>
          id === ing.id
            ? {
                ...ing,
                brix: brix,
                details: [
                  ing.details[0],
                  weightToVolume(
                    parseNumber(ing.details[0]),
                    parseNumber(brix)
                  ).toLocaleString(currentLocale, {
                    maximumFractionDigits: 3,
                  }),
                ] as [string, string],
              }
            : ing
        );
        return { ...prev, ingredients };
      });
    }
  };

  const toggleSecondaryChecked = (id: string, isChecked: boolean) => {
    setRecipeData((prev) => ({
      ...prev,
      ingredients: prev.ingredients.map((ing) =>
        ing.id === id ? { ...ing, secondary: isChecked } : ing
      ),
    }));
  };

  const updateFG = (FG: string) => {
    if (isValidNumber(FG)) {
      setRecipeData((prev) => ({ ...prev, FG }));
    }
  };

  const toggleStabilizers = (val: boolean) => {
    setAddingStabilizers(val);
    setRecipeData((prev) => ({
      ...prev,
      stabilizers: {
        ...prev.stabilizers,
        adding: val,
      },
    }));
  };

  const toggleTakingPh = (val: boolean) => {
    setTakingPh(val);
    setRecipeData((prev) => ({
      ...prev,
      stabilizers: {
        ...prev.stabilizers,
        pH: val,
      },
    }));
  };

  const updatePhReading = (ph: string) => {
    if (isValidNumber(ph)) {
      setPhReading(ph);
      setRecipeData((prev) => ({
        ...prev,
        stabilizers: {
          ...prev.stabilizers,
          phReading: ph,
        },
      }));
    }
  };

  const scaleRecipe = (curVol: number, targetVol: number) => {
    const scale = targetVol / curVol;

    const newIngredients = recipeData.ingredients.map((ing) => {
      const newDetails = ing.details.map((det) =>
        (parseNumber(det || "0") * scale).toLocaleString(currentLocale, {
          maximumFractionDigits: 3,
        })
      ) as [string, string];
      return { ...ing, details: newDetails };
    });
    setRecipeData((prev) => {
      const newAdditives = prev.additives.map((add) => ({
        ...add,
        amount: (parseNumber(add.amount || "0") * scale * 1000).toLocaleString(
          currentLocale,
          {
            maximumFractionDigits: 3,
          }
        ),
      }));

      return { ...prev, ingredients: newIngredients, additives: newAdditives };
    });
  };

  const editPrimaryNoteText = (id: string, text: string) => {
    setPrimaryNotes((prev) => {
      return prev.map((note) => {
        if (note.id === id) {
          return { ...note, content: [text, note.content[1]] };
        } else {
          return note;
        }
      });
    });
  };

  const editPrimaryNoteDetails = (id: string, text: string) => {
    setPrimaryNotes((prev) => {
      return prev.map((note) => {
        if (note.id === id) {
          return { ...note, content: [note.content[0], text] };
        } else {
          return note;
        }
      });
    });
  };

  const addPrimaryNote = () => {
    setPrimaryNotes((prev) => [...prev, { ...blankNote, id: genRandomId() }]);
  };

  const removePrimaryNote = (id: string) => {
    setPrimaryNotes((prev) => prev.filter((note) => note.id !== id));
  };

  const editSecondaryNoteText = (id: string, text: string) => {
    setSecondaryNotes((prev) => {
      return prev.map((note) => {
        if (note.id === id) {
          return { ...note, content: [text, note.content[1]] };
        } else {
          return note;
        }
      });
    });
  };

  const editSecondaryNoteDetails = (id: string, text: string) => {
    setSecondaryNotes((prev) => {
      return prev.map((note) => {
        if (note.id === id) {
          return { ...note, content: [note.content[0], text] };
        } else {
          return note;
        }
      });
    });
  };

  const addSecondaryNote = () => {
    setSecondaryNotes((prev) => [...prev, { ...blankNote, id: genRandomId() }]);
  };
  const removeSecondaryNote = (id: string) => {
    setSecondaryNotes((prev) => prev.filter((note) => note.id !== id));
  };

  const retrieveStoredData = () => {
    // get recipe Data
    const storedData = localStorage.getItem("recipeData") || "false";
    const parsed = JSON.parse(storedData) as RecipeData | false;

    if (parsed) {
      const parsedWithAdditiveIds = {
        ...parsed,
        additives: parsed.additives.map((add) => ({
          ...add,
          id: genRandomId(),
        })),
      };
      setRecipeData(parsedWithAdditiveIds);
    }

    // get notes data
    const primaryNotes = localStorage.getItem("primaryNotes") || "false";
    const secondaryNotes = localStorage.getItem("secondaryNotes") || "false";
    const parsedPrimaryNotes = JSON.parse(primaryNotes) as
      | [string, string][]
      | { id: string; content: [string, string] }[]
      | false;
    if (parsedPrimaryNotes) {
      setPrimaryNotes(
        parsedPrimaryNotes.map((note) => {
          const content = "content" in note ? note.content : note;
          const id = "id" in note ? note.id : genRandomId();
          return { id, content };
        })
      );
    }
    const parsedSecondaryNotes = JSON.parse(secondaryNotes) as
      | [string, string][]
      | { id: string; content: [string, string] }[]
      | false;
    if (parsedSecondaryNotes) {
      setSecondaryNotes(
        parsedSecondaryNotes.map((note) => {
          const content = "content" in note ? note.content : note;
          const id = "id" in note ? note.id : genRandomId();
          return { id, content };
        })
      );
    }

    // get stabilizers data
    const storedStabilizers =
      localStorage.getItem("addingStabilizers") || "false";
    const parsedStabilizers = JSON.parse(storedStabilizers) as
      | { adding: boolean; pH: boolean; phReading: string }
      | false;
    if (parsedStabilizers) {
      setAddingStabilizers(parsedStabilizers.adding);
      setTakingPh(parsedStabilizers.pH);
      setPhReading(parsedStabilizers.phReading);
    }
    const storedName = localStorage.getItem("recipeName");
    if (storedName) {
      setRecipeName(storedName);
    }

    const storedAdds = localStorage.getItem("numberOfAdditions");
    if (storedAdds) {
      setNumberOfAdditions(storedAdds);
    }
  };

  function calculateHoneyAndWater(
    desiredOG: number,
    totalVolume: number
  ): { honeyVolume: number; waterVolume: number } {
    const honeyOG = toSG(79.6); // OG for honey
    const waterOG = toSG(0); // OG for water

    if (desiredOG < waterOG || desiredOG > honeyOG) {
      throw new Error(
        `The desired OG (${desiredOG}) must be between ${waterOG} and ${honeyOG}.`
      );
    }

    // Solve the equations:
    // totalVolume = honeyVolume + waterVolume
    // desiredOG = (honeyOG * honeyVolume + waterOG * waterVolume) / totalVolume

    // Rearrange to find honeyVolume:
    const honeyVolume =
      ((desiredOG - waterOG) * totalVolume) / (honeyOG - waterOG);
    const waterVolume = totalVolume - honeyVolume;

    return { honeyVolume, waterVolume };
  }

  const setIngredientsToTarget = (og: number, volume: number) => {
    const target = calculateHoneyAndWater(og, volume);

    const honey = {
      ...blankIngredient,
      details: [
        volumeToWeight(
          target.honeyVolume,
          parseNumber(blankIngredient.brix)
        ).toFixed(3),
        target.honeyVolume.toFixed(3),
      ] as [string, string],
    };
    const water = {
      id: genRandomId(),
      name: "Water",
      brix: "0",
      secondary: false,
      category: "water",
      details: [
        volumeToWeight(
          target.waterVolume,
          parseNumber(blankIngredient.brix)
        ).toFixed(3),
        target.waterVolume.toFixed(3),
      ] as [string, string],
    };
    setRecipeData((prev) => ({
      ...prev,
      ingredients: [water, honey],
    }));
  };
  const fillToNearest = (id: string) => {
    const ingredient = recipeData.ingredients.find((ing) => id === ing.id);
    const currentIngredientVolume = parseNumber(ingredient?.details[1] || "");
    const targetVolume = Math.ceil(totalVolume);

    // Calculate the additional volume needed, accounting for the current ingredient's contribution
    const targetIngredientVolume =
      targetVolume - (totalVolume - currentIngredientVolume);

    if (targetIngredientVolume > 0 && ingredient) {
      updateIngredientVolume(ingredient, id, targetIngredientVolume.toFixed(3));
    }
  };

  // fetch initial ingredient data
  useEffect(() => {
    const fetchIngredients = async () => {
      try {
        const response = await fetch("/api/ingredients");
        const data = await response.json();
        setIngredientList(data);
        setLoadingIngredients(false);
      } catch (error) {
        console.error("Error fetching ingredient list:", error);
        setLoadingIngredients(false);
      }
    };
    const fetchAdditives = async () => {
      try {
        const response = await fetch("/api/additives");
        const data = await response.json();

        setAdditiveList(data);
        setLoadingAdditives(false);
      } catch (error) {
        console.error("Error fetching ingredient list:", error);
        setLoadingAdditives(false);
      }
    };

    fetchIngredients();
    fetchAdditives();

    retrieveStoredData();
    const units = localStorage.getItem("units");
    if (units) {
      setPreferredUnits(units);
    }

    setFirstMount(false);
  }, []);

  useEffect(() => {
    const secondaryBlendArr = recipeData.ingredients
      .filter((ing) => ing.secondary)
      .map((ing) => {
        return [toSG(parseNumber(ing.brix)).toPrecision(6), ing.details[1]] as [
          string,
          string,
        ];
      });
    const primaryBlendArr = recipeData.ingredients
      .filter((ing) => !ing.secondary)
      .map((ing) => {
        return [toSG(parseNumber(ing.brix)).toPrecision(6), ing.details[1]] as [
          string,
          string,
        ];
      });

    const total = blendValues([...secondaryBlendArr, ...primaryBlendArr]);
    setTotalForAbv(total.blendedValue);

    const { blendedValue: secondaryVal, totalVolume: secondaryVol } =
      blendValues(secondaryBlendArr);
    const { blendedValue: primaryVal, totalVolume: primaryVol } =
      blendValues(primaryBlendArr);
    const { blendedValue: backFG, totalVolume } = blendValues([
      [
        recipeData.FG,
        primaryVol.toLocaleString(currentLocale, {
          maximumFractionDigits: 3,
        }),
      ],
      [
        secondaryVal.toLocaleString(currentLocale, {
          maximumFractionDigits: 3,
        }),
        secondaryVol.toLocaleString(currentLocale, {
          maximumFractionDigits: 3,
        }),
      ],
    ]);

    setBacksweetenedFG(backFG);
    setTotalVolume(totalVolume);

    const offset = recipeData.ingredients
      .filter((ing) => !ing.secondary && ing.category === "fruit")
      .map((ing) => {
        return parseNumber(ing.details[0]) * 25;
      })
      .reduce((prev, curr) => {
        return curr / primaryVol + prev;
      }, 0)
      .toLocaleString(currentLocale, {
        maximumFractionDigits: 0,
      });

    const volume = primaryVol.toLocaleString(currentLocale, {
      maximumFractionDigits: 3,
    });
    const OG = Math.round(primaryVal * 1000) / 1000;

    setRecipeData((prev) => ({
      ...prev,
      volume,
      OG,
      offset,
    }));
  }, [recipeData.ingredients, recipeData.FG]);

  useEffect(() => {
    const ABV = calcABV(totalForAbv, backsweetenedFG);
    const delle = toBrix(backsweetenedFG) + 4.5 * ABV;
    setDelle(delle);
    setRecipeData((prev) => ({ ...prev, ABV }));
  }, [backsweetenedFG, recipeData.OG, totalForAbv]);

  useEffect(() => {
    if (!firstMount) {
      const { weight } = recipeData.units;

      let scaler = 2.20462;

      if (weight === "kg") {
        scaler = 0.453592;
      }
      const updatedIngredients = recipeData.ingredients.map((ing) => {
        const updatedWeight = parseNumber(ing.details[0]) * scaler;
        return {
          ...ing,
          details: [
            updatedWeight.toLocaleString(currentLocale, {
              maximumFractionDigits: 3,
            }),
            ing.details[1],
          ] as [string, string],
        };
      });
      setRecipeData({ ...recipeData, ingredients: updatedIngredients });
    }
  }, [recipeData.units.weight]);

  useEffect(() => {
    if (!firstMount) {
      const { volume } = recipeData.units;

      let scaler = 0.264172;

      if (volume === "liter") {
        scaler = 3.78541;
      }
      const updatedIngredients = recipeData.ingredients.map((ing) => {
        const updatedVolume = parseNumber(ing.details[1]) * scaler;
        return {
          ...ing,
          details: [
            ing.details[0],
            updatedVolume.toLocaleString(currentLocale, {
              maximumFractionDigits: 3,
            }),
          ] as [string, string],
        };
      });
      setRecipeData({ ...recipeData, ingredients: updatedIngredients });
    }
  }, [recipeData.units.volume]);

  useEffect(() => {
    if (!takingPh && !firstMount) {
      updatePhReading("3.6");
    }
  }, [takingPh]);

  useEffect(() => {
    if (addingStabilizers) {
      const volume = parseNumber(recipeData.volume);
      const { volume: volumeUnits } = recipeData.units;
      const ph = parseNumber(phReading);
      const vol =
        volumeUnits == "gal" ? volume * 0.003785411784 : volume / 1000;
      const sorbate = ((-recipeData.ABV * 25 + 400) / 0.75) * vol;

      let ppm = 50;
      if (ph <= 2.9) ppm = 11;
      if (ph == 3) ppm = 13;
      if (ph == 3.1) ppm = 16;
      if (ph == 3.2) ppm = 21;
      if (ph == 3.3) ppm = 26;
      if (ph == 3.4) ppm = 32;
      if (ph == 3.5) ppm = 39;
      if (ph == 3.6) ppm = 50;
      if (ph == 3.7) ppm = 63;
      if (ph == 3.8) ppm = 98;
      if (ph >= 3.9) ppm = 123;

      const sulfite =
        volumeUnits == "gal"
          ? (volume * 3.785 * ppm) / 570
          : (volume * ppm) / 570;

      const campden =
        volumeUnits !== "gal"
          ? (ppm / 75) * (volume / 3.785)
          : (ppm / 75) * volume;

      setRecipeData((prev) => ({
        ...prev,
        sulfite,
        sorbate,
        campden,
      }));
    } else {
      setRecipeData((prev) => ({
        ...prev,
        sulfite: 0,
        sorbate: 0,
        campden: 0,
      }));
    }
  }, [
    phReading,
    recipeData.units,
    recipeData.ABV,
    recipeData.volume,
    addingStabilizers,
  ]);

  // default to users preferred units when recipe is reset. The abv check is required to ensure it doesn't change the state of the recipe if there is data in local storage.
  useEffect(() => {
    if (recipeData.ABV < 1) {
      const units: UnitType =
        preferredUnits === "US"
          ? {
              weight: "lbs",
              volume: "gal",
            }
          : {
              weight: "kg",
              volume: "liter",
            };
      setRecipeData((prev) => ({ ...prev, units }));
    }
  }, [preferredUnits]);

  useEffect(() => {
    localStorage.setItem("recipeData", JSON.stringify(recipeData));
    localStorage.setItem("primaryNotes", JSON.stringify(primaryNotes));
    localStorage.setItem("secondaryNotes", JSON.stringify(secondaryNotes));
    localStorage.setItem("recipeName", recipeName);
    localStorage.setItem(
      "addingStabilizers",
      JSON.stringify({
        adding: addingStabilizers,
        pH: takingPh,
        phReading,
      })
    );
  }, [
    recipeData,
    primaryNotes,
    secondaryNotes,
    addingStabilizers,
    takingPh,
    phReading,
    recipeName,
  ]);

  return (
    <RecipeContext.Provider
      value={{
        ...recipeData,
        setIngredients: (ing) => {
          setRecipeData((prev) => ({ ...prev, ingredients: ing }));
        },
        addIngredient,
        removeIngredient,
        changeIngredient,
        changeVolumeUnits,
        changeWeightUnits,
        ingredientList,
        loadingIngredients,
        updateIngredientWeight,
        updateIngredientVolume,
        updateBrix,
        toggleSecondaryChecked,
        updateFG,
        backsweetenedFG,
        totalVolume,
        delle,
        scaleRecipe,
        addingStabilizers,
        toggleStabilizers,
        takingPh,
        toggleTakingPh,
        phReading,
        updatePhReading,
        updateAdditives,
        additiveList,
        loadingAdditives,
        changeAdditive,
        changeAdditiveUnits,
        changeAdditiveAmount,
        addAdditive,
        removeAdditive,
        setPrimaryNotes,
        setSecondaryNotes,
        notes: {
          primary: primaryNotes,
          secondary: secondaryNotes,
        },
        editPrimaryNote: {
          text: editPrimaryNoteText,
          details: editPrimaryNoteDetails,
        },
        addPrimaryNote,
        removePrimaryNote,
        editSecondaryNote: {
          text: editSecondaryNoteText,
          details: editSecondaryNoteDetails,
        },
        addSecondaryNote,
        removeSecondaryNote,
        recipeNameProps: {
          value: recipeName,
          onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
            setRecipeName(e.target.value),
        },
        setIngredientsToTarget,
        fillToNearest,
      }}
    >
      <NutrientProvider
        recipeData={{
          volume: recipeData.volume,
          sg: (1 + recipeData.OG - parseNumber(recipeData.FG)).toLocaleString(
            currentLocale,
            {
              maximumFractionDigits: 3,
            }
          ),
          offset: recipeData.offset,
          numberOfAdditions,
          units: recipeData.units.volume,
        }}
        storeData
      >
        {children}
      </NutrientProvider>
    </RecipeContext.Provider>
  );
}
export const useRecipe = () => {
  const context = useContext(RecipeContext);
  if (!context) {
    throw new Error("useRecipe must be used within an RecipeProvider");
  }
  return context;
};
