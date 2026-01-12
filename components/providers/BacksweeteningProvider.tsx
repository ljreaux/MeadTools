import { useIngredientsQuery } from "@/hooks/reactQuery/useIngredientsQuery";
import {
  blankIngredientLine,
  IngredientCatalogItem,
  IngredientLine,
  initialRecipeData,
  RecipeUnitDefaults
} from "@/types/recipeData";
import { createContext, ReactNode, useContext, useState } from "react";

type BacksweeteningContextValue = {
  data: {
    abv: number;
    unitDefaults: RecipeUnitDefaults;
    ingredients: IngredientLine[];
  };
  inputs: {
    initialAbv: string;
    setInitialAbv: (v: string) => void;
    volume: string;
    setVolume: (v: string) => void;
  };
  catalog: {
    ingredientList: IngredientCatalogItem[];
    loadingIngredients: boolean;
  };
  ingredient: {
    add: () => void;
  };
};

const BacksweeteningContext = createContext<BacksweeteningContextValue | null>(
  null
);

export function BacksweeteningProvider({ children }: { children: ReactNode }) {
  const { data: ingredientList = [], isLoading: loadingIngredients } =
    useIngredientsQuery();
  const initial = initialRecipeData({ weight: "lb", volume: "gal" });

  const [unitDefaults, setUnitDefaultsState] = useState<RecipeUnitDefaults>(
    initial.unitDefaults
  );
  const [initialAbv, setInitialAbv] = useState("0");
  const [volume, setVolume] = useState("0");
  const [ingredients, setIngredients] = useState<IngredientLine[]>([]);

  const ingredientApi: BacksweeteningContextValue["ingredient"] = {
    add: () => {
      setIngredients((prev) => [
        ...prev,
        blankIngredientLine(unitDefaults, {
          name: "Honey",
          brix: "79.6",
          category: "sugar"
        })
      ]);
    }
  };

  const value: BacksweeteningContextValue = {
    data: {
      abv: parseFloat(initialAbv),
      unitDefaults,
      ingredients
    },
    inputs: { initialAbv, setInitialAbv, volume, setVolume },
    catalog: {
      ingredientList,
      loadingIngredients
    },
    ingredient: ingredientApi
  };

  return (
    <BacksweeteningContext.Provider value={value}>
      {children}
    </BacksweeteningContext.Provider>
  );
}

export function useBacksweetening() {
  const ctx = useContext(BacksweeteningContext);
  if (!ctx)
    throw new Error(
      "useBacksweetening must be used within a BacksweeteningProvider"
    );
  return ctx;
}
