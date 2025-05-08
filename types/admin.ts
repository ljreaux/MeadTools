export type User = {
  id: number;
  email: string;
  google_id?: string;
  hydro_token: string;
  public_username?: string;
  role: "user" | "admin";
};

export type Ingredient = {
  id: number;
  name: string;
  sugar_content: string | number;
  water_content: string | number;
  category: string;
};

export type Yeast = {
  id: number;
  brand: string;
  name: string;
  nitrogen_requirement: string;
  tolerance: string | number;
  low_temp: string | number;
  high_temp: string | number;
};

export type Recipe = {
  id: number;
  name: string;
  nuteInfo: string;
  nutrientData: string;
  recipeData: string;
  primaryNotes: [string, string][];
  secondaryNotes: [string, string][];
  private: boolean;
  public_username?: string;
  user_id: number;
  users: { public_username?: string };
  yanContribution?: string;
  yanFromSource?: string;
};

export type Additive = {
  id: string;
  name: string;
  dosage: number;
  unit: string;
};
