"use client";
import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState
} from "react";
import {
  AdditiveType,
  blankAdditive,
  blankIngredient,
  blankNote,
  genRandomId,
  IngredientDetails,
  initialData,
  Recipe,
  RecipeData
} from "@/types/recipeDataTypes";
import { calcABV, toBrix, toSG } from "@/lib/utils/unitConverter";
import { isValidNumber, parseNumber } from "@/lib/utils/validateInput";
import { blendValues } from "@/lib/utils/blendValues";
import lodash from "lodash";
import { useTranslation } from "react-i18next";
import { SavedNutrientProvider } from "./SavedNutrientProvider";
import { FullNutrientData } from "@/types/nutrientTypes";
import { useIngredientsQuery } from "@/hooks/reactQuery/useIngredientsQuery";
import { useAdditivesQuery } from "@/hooks/reactQuery/useAdditivesQuery";

const RecipeContext = createContext<Recipe | undefined>(undefined);

export default function SavedRecipeProvider({
  children,
  recipe
}: {
  children: ReactNode;
  recipe: {
    id: number;
    name: string;

    recipeData: RecipeData;
    nutrientData: FullNutrientData;

    primaryNotes: [string, string][];
    secondaryNotes: [string, string][];

    user_id: number | null;

    yanContribution: string[];
    yanFromSource?: string[];
    nuteInfo?: string[];

    users?: {
      public_username: string | null;
    } | null;

    averageRating: number;
    numberOfRatings: number;
    userRating: number | null;
    emailNotifications: boolean;
  };
}) {
  const { t, i18n } = useTranslation();
  const currentLocale = i18n.resolvedLanguage;
  const [firstMount, setFirstMount] = useState(true);

  const parsedRecipeDataWithIds = {
    ...recipe.recipeData,
    additives: recipe.recipeData.additives.map((add) => ({
      ...add,
      id: genRandomId()
    })),
    ingredients: recipe.recipeData.ingredients.map((ing) => ({
      ...ing,
      id: genRandomId()
    }))
  };

  const [recipeData, setRecipeData] = useState(
    parsedRecipeDataWithIds || {
      ...initialData,
      ingredients: initialData.ingredients.map((ing) => ({
        ...ing,
        id: genRandomId()
      }))
    }
  );
  const { data: ingredientList = [], isLoading: loadingIngredients } =
    useIngredientsQuery();
  const { data: additiveList = [], isLoading: loadingAdditives } =
    useAdditivesQuery();
  const [primaryNotes, setPrimaryNotes] = useState(
    recipe.primaryNotes.map((note) => {
      const content = note;
      const id = genRandomId();
      return { id, content };
    })
  );
  const [secondaryNotes, setSecondaryNotes] = useState(
    recipe.secondaryNotes.map((note) => {
      const content = note;
      const id = genRandomId();
      return { id, content };
    })
  );

  const [backsweetenedFG, setBacksweetenedFG] = useState(1);
  const [totalVolume, setTotalVolume] = useState(0);
  const [totalForAbv, setTotalForAbv] = useState(1);
  const [delle, setDelle] = useState(0);

  const [stabilizerType, setStabilizerType] = useState(
    recipe.recipeData.stabilizerType ?? "kmeta"
  );
  const [addingStabilizers, setAddingStabilizers] = useState(
    recipe.recipeData?.stabilizers?.adding ?? false
  );
  const [takingPh, setTakingPh] = useState(
    recipe.recipeData?.stabilizers?.pH ?? false
  );
  const [phReading, setPhReading] = useState(
    recipe.recipeData?.stabilizers?.phReading ?? "3.6"
  );
  const [recipeName, setRecipeName] = useState(recipe.name || "");
  const [ratingStats, setRatingStats] = useState<{
    averageRating: number;
    numberOfRatings: number;
    userRating: number | null;
  }>({
    averageRating: recipe.averageRating,
    numberOfRatings: recipe.numberOfRatings,
    userRating: recipe.userRating
  });

  useEffect(() => {
    setRatingStats((prev) => {
      // Avoid pointless updates if nothing changed
      if (
        prev.averageRating === recipe.averageRating &&
        prev.numberOfRatings === recipe.numberOfRatings &&
        prev.userRating === recipe.userRating
      ) {
        return prev;
      }

      return {
        averageRating: recipe.averageRating,
        numberOfRatings: recipe.numberOfRatings,
        userRating: recipe.userRating
      };
    });
  }, [recipe.averageRating, recipe.numberOfRatings, recipe.userRating]);

  const addIngredient = () => {
    setRecipeData((prev) => ({
      ...prev,
      ingredients: [...prev.ingredients, blankIngredient]
    }));
  };

  const removeIngredient = (id: string) => {
    setRecipeData((prev) => ({
      ...prev,
      ingredients: prev.ingredients.filter((ing) => {
        return id !== ing.id;
      })
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
            maximumFractionDigits: 2
          }) || "0",
        secondary: false,
        category: foundIng.category || "water"
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
                  maximumFractionDigits: 3
                })
              ]
            };
          }
          return ing;
        })
      }));
    } else {
      setRecipeData((prev) => ({
        ...prev,
        ingredients: prev.ingredients.map((ing, i) => {
          if (index === i) {
            return {
              ...ing,
              name // Use the translated name
            };
          }
          return ing;
        })
      }));
    }
  };
  const updateAdditives = (additives: AdditiveType[]) => {
    setRecipeData((prev) => ({
      ...prev,
      additives
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
          maximumFractionDigits: 3
        }),
        unit: foundAdd.unit,
        id
      };

      setRecipeData((prev) => ({
        ...prev,
        additives: prev.additives.map((add) => (add.id == id ? changed : add))
      }));
    } else {
      setRecipeData((prev) => ({
        ...prev,
        additives: prev.additives.map((add) => {
          if (add.id == id) {
            return {
              ...add,
              name // Use the translated name
            };
          }
          return add;
        })
      }));
    }
  };

  const changeAdditiveUnits = (id: string, unit: string) => {
    setRecipeData((prev) => ({
      ...prev,
      additives: prev.additives.map((add) =>
        add.id === id ? { ...add, unit } : add
      )
    }));
  };

  const changeAdditiveAmount = (id: string, amount: string) => {
    setRecipeData((prev) => ({
      ...prev,
      additives: prev.additives.map((add) =>
        add.id === id ? { ...add, amount } : add
      )
    }));
  };

  const addAdditive = () => {
    setRecipeData((prev) => {
      return {
        ...prev,
        additives: [...prev.additives, { ...blankAdditive, id: genRandomId() }]
      };
    });
  };

  const removeAdditive = (id: string) => {
    setRecipeData((prev) => ({
      ...prev,
      additives: prev.additives.filter((item) => item.id !== id)
    }));
  };
  const changeVolumeUnits = (unit: string) => {
    setRecipeData((prev) => ({
      ...prev,
      units: {
        ...prev.units,
        volume: unit as "gal" | "liter"
      }
    }));
  };

  const changeWeightUnits = (unit: string) => {
    setRecipeData((prev) => ({
      ...prev,
      units: {
        ...prev.units,
        weight: unit as "lbs" | "kg"
      }
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
            maximumFractionDigits: 3
          })
        ] as [string, string]
      };
      setRecipeData((prev) => ({
        ...prev,
        ingredients: prev.ingredients.map((ing) =>
          id === ing.id ? updatedIngredient : ing
        )
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
            maximumFractionDigits: 3
          }),
          volume
        ] as [string, string]
      };
      setRecipeData((prev) => ({
        ...prev,
        ingredients: prev.ingredients.map((ing) =>
          id === ing.id ? updatedIngredient : ing
        )
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
                    maximumFractionDigits: 3
                  })
                ] as [string, string]
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
      )
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
        adding: val
      }
    }));
  };

  const toggleTakingPh = (val: boolean) => {
    setTakingPh(val);
    setRecipeData((prev) => ({
      ...prev,
      stabilizers: {
        ...prev.stabilizers,
        pH: val
      }
    }));
  };

  const updatePhReading = (ph: string) => {
    if (isValidNumber(ph)) {
      setPhReading(ph);
      setRecipeData((prev) => ({
        ...prev,
        stabilizers: {
          ...prev.stabilizers,
          phReading: ph
        }
      }));
    }
  };

  const scaleRecipe = (curVol: number, targetVol: number) => {
    const scale = targetVol / curVol;

    const newIngredients = recipeData.ingredients.map((ing) => {
      const newDetails = ing.details.map((det) =>
        (parseNumber(det || "0") * scale).toLocaleString(currentLocale, {
          maximumFractionDigits: 3
        })
      ) as [string, string];
      return { ...ing, details: newDetails };
    });
    setRecipeData((prev) => {
      const newAdditives = prev.additives.map((add) => ({
        ...add,
        amount: (parseNumber(add.amount || "0") * scale).toLocaleString(
          currentLocale,
          { maximumFractionDigits: 3 }
        )
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

  // fetch initial ingredient data
  useEffect(() => {
    setFirstMount(false);
  }, []);

  useEffect(() => {
    const secondaryBlendArr = recipeData.ingredients
      .filter((ing) => ing.secondary)
      .map((ing) => {
        return [toSG(parseNumber(ing.brix)).toPrecision(6), ing.details[1]] as [
          string,
          string
        ];
      });
    const primaryBlendArr = recipeData.ingredients
      .filter((ing) => !ing.secondary)
      .map((ing) => {
        return [toSG(parseNumber(ing.brix)).toPrecision(6), ing.details[1]] as [
          string,
          string
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
        primaryVol.toLocaleString(currentLocale, { maximumFractionDigits: 3 })
      ],
      [
        secondaryVal.toLocaleString(currentLocale, {
          maximumFractionDigits: 3
        }),
        secondaryVol.toLocaleString(currentLocale, {
          maximumFractionDigits: 3
        })
      ]
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
      .toLocaleString(currentLocale);

    const volume = primaryVol.toLocaleString(currentLocale, {
      maximumFractionDigits: 3
    });
    const OG = Math.round(primaryVal * 1000) / 1000;

    setRecipeData((prev) => ({
      ...prev,
      volume,
      OG,
      offset
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
              maximumFractionDigits: 3
            }),
            ing.details[1]
          ] as [string, string]
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
              maximumFractionDigits: 3
            })
          ] as [string, string]
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

      const multiplier = stabilizerType === "kmeta" ? 570 : 674;

      const sulfite =
        volumeUnits == "gal"
          ? (volume * 3.785 * ppm) / multiplier
          : (volume * ppm) / multiplier;

      const campden =
        volumeUnits !== "gal"
          ? (ppm / 75) * (volume / 3.785)
          : (ppm / 75) * volume;

      setRecipeData((prev) => ({
        ...prev,
        sulfite,
        sorbate,
        campden
      }));
    } else {
      setRecipeData((prev) => ({
        ...prev,
        sulfite: 0,
        sorbate: 0,
        campden: 0
      }));
    }
  }, [
    phReading,
    recipeData.units,
    recipeData.ABV,
    recipeData.volume,
    addingStabilizers
  ]);
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
        target.honeyVolume.toFixed(3)
      ] as [string, string]
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
        target.waterVolume.toFixed(3)
      ] as [string, string]
    };
    setRecipeData((prev) => ({
      ...prev,
      ingredients: [water, honey]
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
        additiveList,
        loadingAdditives,
        updateAdditives,
        changeAdditive,
        changeAdditiveUnits,
        changeAdditiveAmount,
        addAdditive,
        removeAdditive,
        setPrimaryNotes,
        setSecondaryNotes,
        notes: {
          primary: primaryNotes,
          secondary: secondaryNotes
        },
        editPrimaryNote: {
          text: editPrimaryNoteText,
          details: editPrimaryNoteDetails
        },
        addPrimaryNote,
        removePrimaryNote,
        editSecondaryNote: {
          text: editSecondaryNoteText,
          details: editSecondaryNoteDetails
        },
        addSecondaryNote,
        removeSecondaryNote,
        recipeNameProps: {
          value: recipeName,
          onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
            setRecipeName(e.target.value)
        },
        public_username: recipe.users?.public_username,
        fillToNearest,
        setIngredientsToTarget,
        stabilizerType,
        setStabilizerType,
        ratingStats,
        setRatingStats
      }}
    >
      <SavedNutrientProvider
        storedFullData={recipe.nutrientData}
        storedYanContribution={recipe.yanContribution}
        storedProvidedYan={recipe.yanFromSource}
        storedMaxGpl={recipe.nuteInfo}
        recipeData={{
          volume: recipeData.volume,

          sg: (1 + recipeData.OG - parseNumber(recipeData.FG)).toLocaleString(
            currentLocale,
            { maximumFractionDigits: 3 }
          ),
          offset: recipeData.offset,
          numberOfAdditions: recipe.nutrientData.inputs.numberOfAdditions,
          units: recipeData.units.volume
        }}
      >
        {children}
      </SavedNutrientProvider>
    </RecipeContext.Provider>
  );
}
export const useRecipe = () => {
  const context = useContext(RecipeContext);
  if (!context) {
    throw new Error("useRecipe must be used within an SavedRecipeProvider");
  }
  return context;
};
