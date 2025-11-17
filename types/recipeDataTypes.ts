import { nanoid } from "nanoid";
import { Dispatch, SetStateAction } from "react";

export const genRandomId = () => nanoid(8);

export type IngredientDetails = {
  id: string;
  name: string;
  brix: string;
  details: [string, string];
  secondary: boolean;
  category: string;
};

export type Ingredient = {
  id: string;
  name: string;
  sugar_content: string;
  water_content: string;
  category: string;
  translationKey?: string;
};

export type UnitType = {
  weight: "lbs" | "kg";
  volume: "gal" | "liter";
};

export type AdditiveType = {
  name: string;
  amount: string;
  unit: string;
  id: string;
};

export type Additive = {
  name: string;
  dosage: string;
  unit: string;
};

export interface RecipeData {
  ingredients: IngredientDetails[];
  OG: number;
  volume: string;
  ABV: number;
  FG: string;
  offset: string;
  units: UnitType;
  additives: AdditiveType[];
  sorbate: number;
  sulfite: number;
  campden: number;
  stabilizers?: {
    adding?: boolean;
    pH?: boolean;
    phReading?: string;
  };
  stabilizerType?: string;
}

export type NotesType = { id: string; content: [string, string] }[];

export const blankAdditive: AdditiveType = {
  name: "",
  amount: "",
  unit: "g",
  id: genRandomId()
};

export const initialData: RecipeData = {
  ingredients: [
    {
      id: genRandomId(),
      name: "Water",
      brix: "0.00",
      details: ["0", "0.000"],
      secondary: false,
      category: "water"
    },
    {
      id: genRandomId(),
      name: "Honey",
      brix: "79.60",
      details: ["0", "0.000"],
      secondary: false,
      category: "sugar"
    }
  ],
  OG: 1.0,
  volume: "0",
  ABV: 0,
  FG: "0.996",
  offset: "0",
  units: {
    weight: "lbs",
    volume: "gal"
  },
  additives: [blankAdditive],
  sorbate: 0,
  sulfite: 0,
  campden: 0,
  stabilizers: {
    adding: false,
    pH: false,
    phReading: "3.6"
  }
};

export interface Recipe extends RecipeData {
  setIngredients: (
    ingredients: {
      id: string;
      name: string;
      brix: string;
      details: [string, string];
      secondary: boolean;
      category: string;
    }[]
  ) => void;
  addIngredient: () => void;
  removeIngredient: (id: string) => void;
  ingredientList: Ingredient[];
  loadingIngredients: boolean;
  changeIngredient: (ing: IngredientDetails, i: number, name: string) => void;
  changeVolumeUnits: (unit: string) => void;
  changeWeightUnits: (unit: string) => void;
  updateIngredientVolume: (
    ing: IngredientDetails,
    id: string,
    volume: string
  ) => void;
  updateIngredientWeight: (
    ing: IngredientDetails,
    id: string,
    weight: string
  ) => void;
  updateBrix: (brix: string, id: string) => void;
  toggleSecondaryChecked: (id: string, b: boolean) => void;
  updateFG: (FG: string) => void;
  backsweetenedFG: number;
  totalVolume: number;
  delle: number;
  scaleRecipe: (val: number, scaler: number) => void;
  addingStabilizers: boolean;
  toggleStabilizers: (val: boolean) => void;
  takingPh: boolean;
  toggleTakingPh: (val: boolean) => void;
  phReading: string;
  updatePhReading: (val: string) => void;
  updateAdditives: (add: AdditiveType[]) => void;
  additiveList: Additive[];
  loadingAdditives: boolean;
  changeAdditive: (id: string, name: string) => void;
  changeAdditiveUnits: (id: string, unit: string) => void;
  changeAdditiveAmount: (id: string, amount: string) => void;
  addAdditive: () => void;
  removeAdditive: (id: string) => void;
  setPrimaryNotes: (notes: NotesType) => void;
  setSecondaryNotes: (notes: NotesType) => void;
  notes: {
    primary: NotesType;
    secondary: NotesType;
  };
  editPrimaryNote: {
    text: (id: string, note: string) => void;
    details: (id: string, note: string) => void;
  };
  addPrimaryNote: () => void;
  removePrimaryNote: (id: string) => void;
  editSecondaryNote: {
    text: (id: string, note: string) => void;
    details: (id: string, note: string) => void;
  };
  addSecondaryNote: () => void;
  removeSecondaryNote: (id: string) => void;
  recipeNameProps: {
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  };
  public_username?: string | null;
  setIngredientsToTarget: (og: number, volume: number) => void;
  fillToNearest: (id: string) => void;
  stabilizerType: string;
  setStabilizerType: (val: string) => void;
  ratingStats?: {
    averageRating: number;
    numberOfRatings: number;
    userRating: number | null;
  };
  setRatingStats?: Dispatch<
    SetStateAction<{
      averageRating: number;
      numberOfRatings: number;
      userRating: number | null;
    }>
  >;
}

export const blankIngredient: IngredientDetails = {
  id: genRandomId(),
  name: "Honey",
  brix: "79.6",
  details: ["0", "0"],
  secondary: false,
  category: "sugar"
};

export const blankNote: { id: string; content: [string, string] } = {
  id: genRandomId(),
  content: ["", ""]
};
