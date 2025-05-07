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
