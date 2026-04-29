export type WeightUnit = "kg" | "g" | "lb" | "oz";

export type VolumeUnit =
  | "L"
  | "mL"
  | "gal"
  | "qt"
  | "pt"
  | "fl_oz"
  | "imp_gal"
  | "imp_qt"
  | "imp_pt"
  | "imp_fl_oz";

export type RecipeUnitDefaultsResponse = {
  weight: WeightUnit;
  volume: VolumeUnit;
};

export type IngredientRefResponse =
  | {
      kind: "catalog";
      ingredientId: number | string;
    }
  | {
      kind: "custom";
    };

export type RecipeAmountInputResponse = {
  value: string;
  unit: string;
};

export type IngredientLineAmountsResponse = {
  weight: RecipeAmountInputResponse;
  volume: RecipeAmountInputResponse;
  basis: "weight" | "volume";
};

export type IngredientLineResponse = {
  lineId: string;
  name: string;
  ref: IngredientRefResponse;
  category: string;
  brix: string;
  secondary: boolean;
  amounts: IngredientLineAmountsResponse;
};

export type AdditiveAmountDim = "weight" | "volume" | "count" | "unknown";

export type AdditiveLineResponse = {
  lineId: string;
  name: string;
  amount: string;
  unit: string;
  amountTouched: boolean;
  amountDim: AdditiveAmountDim;
};

export type StabilizersResponse = {
  adding: boolean;
  takingPh: boolean;
  phReading: string;
  type: "kmeta" | "nameta";
};

export type NoteLineResponse = {
  lineId: string;
  content: string[];
};

export type NotesResponse = {
  primary: NoteLineResponse[];
  secondary: NoteLineResponse[];
};

export type NutrientVolumeUnit = "gal" | "liter";
export type GoFermType = "Go-Ferm" | "protect" | "sterol-flash" | "none";
export type NitrogenRequirement =
  | "Very Low"
  | "Low"
  | "Medium"
  | "High"
  | "Very High";
export type NutrientScheduleType =
  | "tbe"
  | "tosna"
  | "justK"
  | "dap"
  | "oAndk"
  | "oAndDap"
  | "kAndDap"
  | "other";

export type SelectedNutrientsResponse = {
  fermO: boolean;
  fermK: boolean;
  dap: boolean;
  other: boolean;
};

export type NutrientAmountsByKeyResponse = {
  fermO: string;
  fermK: string;
  dap: string;
  other: string;
};

export type NutrientAdjustmentsResponse = {
  adjustAllowed: boolean;
  providedYanPpm: NutrientAmountsByKeyResponse;
};

export type NutrientSettingsResponse = {
  yanContribution: NutrientAmountsByKeyResponse;
  maxGpl: NutrientAmountsByKeyResponse;
  maxGplTouched: boolean;
  other: {
    name: string;
  };
};

export type NutrientInputsResponse = {
  volume: string;
  volumeUnits: NutrientVolumeUnit;
  sg: string;
  offsetPpm: string;
  numberOfAdditions: string;
  goFermType: GoFermType;
  yeastAmountG: string;
  yeastAmountTouched: boolean;
};

export type NutrientSelectedResponse = {
  yeastBrand: string;
  yeastStrain: string;
  yeastId?: number;
  nitrogenRequirement: NitrogenRequirement;
  schedule: NutrientScheduleType;
  selectedNutrients: SelectedNutrientsResponse;
};

export type NutrientDataResponse = {
  version: 2;
  inputs: NutrientInputsResponse;
  selected: NutrientSelectedResponse;
  settings: NutrientSettingsResponse;
  adjustments: NutrientAdjustmentsResponse;
};

export type RecipeDataV2Response = {
  version: 2;
  unitDefaults: RecipeUnitDefaultsResponse;
  ingredients: IngredientLineResponse[];
  fg: string;
  additives: AdditiveLineResponse[];
  stabilizers: StabilizersResponse;
  notes: NotesResponse;
  nutrients?: NutrientDataResponse;
  flags?: {
    advanced?: boolean;
    private?: boolean;
  };
};

export type ApiErrorResponse = {
  error: string;
};

export type AdditiveUnitResponse =
  | "g"
  | "ml"
  | "tsp"
  | "oz"
  | "units"
  | "mg"
  | "kg"
  | "lbs"
  | "liters"
  | "fl_oz"
  | "quarts"
  | "gal"
  | "tbsp";

export type AdditiveResponse = {
  id: string;
  created_at: string;
  name: string;
  dosage: number;
  unit: AdditiveUnitResponse;
};

export type AdditivesResponse = AdditiveResponse[];

export type AdditiveByIdResponse = AdditiveResponse;

export type AdditiveQueryParams = {
  name?: string;
};

export type AdditiveByIdPathParams = {
  id: string;
};

export type AdditivesFetchErrorResponse = {
  error: "Failed to fetch additives";
};

export type AdditiveNotFoundErrorResponse = {
  error: "Additive not found";
};

export type AdditiveFetchErrorResponse = {
  error: "Failed to fetch additive";
};

export type CreateAdditiveRequestBody = {
  name: string;
  dosage: number | string;
  unit: AdditiveUnitResponse | "fl oz";
};

export type UpdateAdditiveRequestBody = Partial<CreateAdditiveRequestBody>;

export type CreateAdditiveValidationErrorResponse = {
  error: "Missing required fields";
};

export type CreateAdditiveFailureErrorResponse = {
  error: "Failed to create additive";
};

export type UpdateAdditiveFailureErrorResponse = {
  error: "Failed to update additive";
};

export type DeleteAdditiveSuccessResponse = {
  message: string;
};

export type DeleteAdditiveFailureErrorResponse = {
  error: "Failed to delete additive";
};

export type IngredientResponse = {
  id: number;
  name: string;
  sugar_content: string;
  water_content: string;
  category: string;
};

export type IngredientsResponse = IngredientResponse[];

export type IngredientByIdResponse = IngredientResponse | null;

export type IngredientQueryParams = {
  category?: string;
  name?: string;
};

export type IngredientByIdPathParams = {
  id: string;
};

export type IngredientsFetchErrorResponse = {
  error: "Failed to fetch ingredients";
};

export type IngredientByIdErrorResponse = ApiErrorResponse;

export type CreateIngredientRequestBody = {
  name: string;
  sugar_content: number;
  water_content: number;
  category: string;
};

export type UpdateIngredientRequestBody = Partial<CreateIngredientRequestBody>;

export type CreateIngredientFailureErrorResponse = ApiErrorResponse;

export type UpdateIngredientFailureErrorResponse = ApiErrorResponse;

export type DeleteIngredientSuccessResponse = {
  message: string;
};

export type DeleteIngredientFailureErrorResponse = ApiErrorResponse;

export type YeastBrandResponse =
  | "Lalvin"
  | "Fermentis"
  | "Mangrove Jack"
  | "Red Star"
  | "Other";

export type YeastNitrogenRequirementResponse =
  | "Very Low"
  | "Low"
  | "Medium"
  | "High"
  | "Very High";

export type YeastResponse = {
  id: number;
  brand: YeastBrandResponse;
  name: string;
  nitrogen_requirement: YeastNitrogenRequirementResponse;
  tolerance: string;
  low_temp: string;
  high_temp: string;
};

export type YeastsResponse = YeastResponse[];

export type YeastLookupResponse = YeastResponse | YeastsResponse;

export type YeastByIdResponse = YeastResponse | null;

export type YeastQueryParams = {
  brand?: string;
  name?: string;
  id?: string;
};

export type YeastByIdPathParams = {
  id: string;
};

export type YeastNotFoundErrorResponse = ApiErrorResponse;

export type YeastsFetchErrorResponse = {
  error: "Failed to fetch yeasts";
};

export type YeastByIdErrorResponse = ApiErrorResponse;

export type CreateYeastRequestBody = {
  brand: YeastBrandResponse | string;
  name: string;
  nitrogen_requirement: YeastNitrogenRequirementResponse;
  tolerance: number;
  low_temp: number;
  high_temp: number;
};

export type UpdateYeastRequestBody = Partial<CreateYeastRequestBody>;

export type CreateYeastValidationErrorResponse = {
  error: "Yeast name is required";
};

export type CreateYeastFailureErrorResponse = {
  error: "Failed to create yeast";
};

export type UpdateYeastFailureErrorResponse = ApiErrorResponse;

export type DeleteYeastSuccessResponse = {
  message: string;
};

export type DeleteYeastFailureErrorResponse = ApiErrorResponse;

export type LoginRequestBody = {
  email: string;
  password: string;
};

export type LoginSuccessResponse = {
  message: "Successfully logged in!";
  accessToken: string;
  refreshToken: string;
  role: string | null;
  email: string;
  id: number;
};

export type LoginMissingCredentialsErrorResponse = {
  error: "Please provide email and password";
};

export type LoginInvalidCredentialsErrorResponse = {
  error: "Invalid email or password";
};

export type LoginFailureErrorResponse = {
  error: "Failed to log in user";
};

export type RegisterRequestBody = {
  email: string;
  password: string;
  public_username?: string;
};

export type RegisterSuccessResponse = {
  message: "Thank you for signing up!";
  accessToken: string;
  refreshToken: string;
  role: string | null;
  email: string;
};

export type RegisterValidationErrorResponse = {
  error: "Email and password are required." | "A user by that email already exists";
};

export type RegisterFailureErrorResponse = {
  error: "Failed to register user";
};

export type RefreshTokenRequestBody = {
  email: string;
  refreshToken: string;
};

export type RefreshTokenSuccessResponse = {
  accessToken: string;
};

export type RefreshTokenValidationErrorResponse = {
  error: "Email and refreshToken are required";
};

export type RefreshTokenInvalidEmailErrorResponse = {
  error: "Invalid email";
};

export type RefreshTokenFailureErrorResponse = {
  error: "Invalid refresh token" | "Failed to refresh token";
};

export type RequestPasswordResetBody = {
  email: string;
};

export type RequestPasswordResetSuccessResponse = {
  message: "If that email exists, a reset link has been sent." | "Reset link sent.";
};

export type RequestPasswordResetValidationErrorResponse = {
  error: "Email is required";
};

export type ResetPasswordRequestBody = {
  token: string;
  password: string;
};

export type ResetPasswordSuccessResponse = {
  message: "Password updated successfully.";
};

export type ResetPasswordValidationErrorResponse = {
  error: "Missing token or password.";
};

export type ResetPasswordInvalidTokenErrorResponse = {
  error: "Invalid or expired token.";
};

export type VerifyTokenRequestBody = {
  token: string;
  provider: "google";
  email?: string;
};

export type VerifyTokenUserResponse = {
  id: number;
  email: string;
  role: string;
};

export type VerifyTokenSuccessResponse = {
  token: string;
  user: VerifyTokenUserResponse;
};

export type VerifyTokenValidationErrorResponse = {
  error: "Invalid provider" | "Email required when using access token";
};

export type VerifyTokenUnauthorizedErrorResponse = {
  error: "Invalid token" | "Invalid ID token";
};

export type VerifyTokenNotFoundErrorResponse = {
  error: "User not found";
};

export type VerifyTokenFailureErrorResponse = {
  error: "Authentication failed";
};

export type AccountUserResponse = {
  id: number;
  email: string;
  password?: undefined;
  google_id: string | null;
  role: string | null;
  hydro_token: string | null;
  public_username: string | null;
  google_avatar_url: string | null;
  show_google_avatar: boolean;
  active: boolean;
  isGoogleUser: boolean;
};

export type AccountRecipeOwnerResponse = {
  public_username: string | null;
};

export type AccountRecipeResponse = {
  id: number;
  user_id: number | null;
  name: string;
  recipeData: string;
  yanFromSource: string | null;
  yanContribution: string;
  nutrientData: string;
  advanced: boolean;
  nuteInfo: string | null;
  primaryNotes: string[][];
  secondaryNotes: string[][];
  dataV2: RecipeDataV2Response | null;
  version: number;
  private: boolean;
  lastActivityEmailAt: string | null;
  activityEmailsEnabled: boolean;
  users: AccountRecipeOwnerResponse | null;
  public_username: string | null;
};

export type AccountInfoResponse = {
  user: AccountUserResponse;
  recipes: AccountRecipeResponse[];
};

export type AccountInfoUnauthorizedErrorResponse = {
  error: "Unauthorized";
};

export type AccountInfoNotFoundErrorResponse = {
  error: "User not found";
};

export type AccountInfoFetchErrorResponse = {
  error: "Failed to fetch account info";
};

export type UpdateAccountInfoRequestBody = {
  email?: string;
  password?: string;
  public_username?: string;
  google_id?: string;
  hydro_token?: string;
  role?: string;
};

export type UpdateAccountInfoResponse = Omit<
  AccountUserResponse,
  "isGoogleUser"
>;

export type UpdateAccountInfoErrorResponse = {
  error: "Failed to update account info";
};

export type CreateUsernameRequestBody = {
  public_username: string;
};

export type CreateUsernameSuccessResponse = {
  message: "Public username successfully updated.";
  public_username: string | null;
};

export type CreateUsernameValidationErrorResponse = {
  error: "Public username is required.";
};

export type CreateUsernameFailureErrorResponse = {
  error: "Failed to update public username.";
};

export type CreateRecipeRequestBody = {
  name: string;
  dataV2: RecipeDataV2Response;
  private?: boolean;
  activityEmailsEnabled?: boolean;
  lastActivityEmailAt?: string | null;
};

export type CreateRecipeResponse = {
  recipe: {
    id: number;
    user_id: number | null;
    name: string;
    recipeData: string;
    yanFromSource: string | null;
    yanContribution: string;
    nutrientData: string;
    advanced: boolean;
    nuteInfo: string | null;
    primaryNotes: string[];
    secondaryNotes: string[];
    dataV2: RecipeDataV2Response | null;
    version: number;
    private: boolean;
    lastActivityEmailAt: string | null;
    activityEmailsEnabled: boolean;
  };
};

export type CreateRecipeValidationErrorResponse = {
  error: "Name and recipe data are required." | "Invalid dataV2 payload.";
};

export type CreateRecipeFailureErrorResponse = {
  error: "Failed to create recipe";
};

export type UpdateRecipeRequestBody = Partial<CreateRecipeRequestBody>;

export type UpdateRecipeResponse = CreateRecipeResponse["recipe"];

export type UpdateRecipeValidationErrorResponse = {
  error: "Invalid recipe ID" | "Invalid payload";
};

export type UpdateRecipeForbiddenErrorResponse = {
  error: "You are not authorized to update this recipe";
};

export type UpdateRecipeFailureErrorResponse = {
  error: "Failed to update recipe";
};

export type DeleteRecipeSuccessResponse = {
  message: string;
};

export type DeleteRecipeForbiddenErrorResponse = {
  error: "You are not authorized to delete this recipe";
};

export type DeleteRecipeFailureErrorResponse = {
  error: "Failed to delete recipe";
};

export type RateRecipeRequestBody = {
  rating: number;
};

export type RecipeRatingAggregateResponse = {
  recipe_id: number;
  averageRating: number;
  numberOfRatings: number;
  userRating: number;
};

export type RateRecipeResponse = {
  rating: RecipeRatingAggregateResponse;
};

export type RateRecipeValidationErrorResponse = {
  error: "Invalid recipe ID" | "Rating is a required field";
};

export type RateRecipeFailureErrorResponse = {
  error: "Failed to add rating";
};

export type CreateRecipeCommentRequestBody = {
  comment: string;
  parent_id?: string | null;
};

export type RecipeCommentResponse = {
  id: string;
  recipe_id: number;
  user_id: number;
  parent_id: string | null;
  comment: string;
  created_at: string;
  updated_at: string;
};

export type CreateRecipeCommentResponse = {
  comment: RecipeCommentResponse;
};

export type CreateRecipeCommentValidationErrorResponse = {
  error: "Invalid recipe ID" | "Comment text is required";
};

export type CreateRecipeCommentFailureErrorResponse = {
  error: "Failed to add comment";
};

export type RecipeCommentListPathParams = {
  id: string;
};

export type RecipeCommentRepliesPathParams = {
  id: string;
  commentId: string;
};

export type RecipeCommentListQueryParams = {
  limit?: number;
  cursor?: string;
  order?: "asc" | "desc";
};

export type RecipeCommentAuthorResponse = {
  public_username: string | null;
  avatarUrl: string | null;
  active?: boolean;
};

export type RecipeCommentListItemResponse = {
  id: string;
  recipe_id: number;
  user_id: number;
  parent_id: string | null;
  comment: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  reply_count: number;
  author: RecipeCommentAuthorResponse | null;
};

export type RecipeCommentsPageResponse = {
  data: RecipeCommentListItemResponse[];
  nextCursor: string | null;
  totalCount: number;
};

export type RecipeCommentsValidationErrorResponse = {
  error: "Invalid recipe id" | "Missing commentId";
};

export type RecipeCommentsFetchErrorResponse = {
  error: "Failed to fetch comments";
};

export type RecipeCommentPathParams = {
  id: string;
};

export type UpdateRecipeCommentRequestBody = {
  comment: string;
};

export type UpdateRecipeCommentResponse = {
  comment: RecipeCommentResponse;
};

export type DeleteRecipeCommentResponse = {
  deleted: {
    id: string;
    deleted_at: string | null;
  };
};

export type UpdateRecipeCommentValidationErrorResponse = {
  error: "Comment text is required";
};

export type UpdateRecipeCommentFailureErrorResponse = {
  error: "Failed to update comment";
};

export type DeleteRecipeCommentFailureErrorResponse = {
  error: "Failed to delete comment";
};

export type BrewStageResponse =
  | "PLANNED"
  | "PRIMARY"
  | "SECONDARY"
  | "BULK_AGE"
  | "STABILIZED"
  | "BACKSWEETENED"
  | "PACKAGED"
  | "COMPLETE";

export type BrewEntryTypeResponse =
  | "NOTE"
  | "GRAVITY"
  | "TEMPERATURE"
  | "PH"
  | "ADDITION"
  | "NUTRIENT"
  | "RACKING"
  | "STABILIZATION"
  | "BACKSWEETENING"
  | "PACKAGING"
  | "TASTING"
  | "STAGE_CHANGE"
  | "ISSUE";

export type TemperatureUnitResponse = "F" | "C" | "K";

export type BrewPathParams = {
  brew_id: string;
};

export type BrewEntryPathParams = {
  brew_id: string;
  entry_id: string;
};

export type BrewListItemResponse = {
  id: string;
  name: string | null;
  start_date: string;
  end_date: string | null;
  stage: BrewStageResponse;
  current_volume_liters: number | null;
  recipe_id: number | null;
  recipe_name: string | null;
  entry_count: number;
  latest_gravity: number | null;
};

export type BrewsResponse = {
  brews: BrewListItemResponse[];
};

export type BrewRecipeSnapshotResponse = {
  id: number;
  name: string;
  version: number;
  dataV2: RecipeDataV2Response | null;
  snapshottedAt: string;
};

export type BrewEntryResponse = {
  id: string;
  datetime: string;
  type: BrewEntryTypeResponse;
  title: string | null;
  note: string | null;
  gravity: number | null;
  temperature: number | null;
  temp_units: TemperatureUnitResponse | null;
  data: object | null;
  user_id: number | null;
};

export type BrewEntryWithBrewIdResponse = {
  brew_id: string;
  id: string;
  datetime: string;
  type: BrewEntryTypeResponse;
  title: string | null;
  note: string | null;
  gravity: number | null;
  temperature: number | null;
  temp_units: TemperatureUnitResponse | null;
  data: object | null;
  user_id: number | null;
};

export type BrewEntriesByStageResponse = {
  stage: BrewStageResponse;
  entries: BrewEntryResponse[];
};

export type BrewResponse = {
  id: string;
  name: string | null;
  start_date: string;
  end_date: string | null;
  stage: BrewStageResponse;
  batch_number: number | null;
  current_volume_liters: number | null;
  latest_gravity: number | null;
  recipe_id: number | null;
  recipe_name: string | null;
  recipe_snapshot: BrewRecipeSnapshotResponse | null;
  entry_count: number;
  entries: BrewEntryResponse[];
  entries_by_stage: BrewEntriesByStageResponse[];
};

export type CreateBrewRequestBody = {
  recipe_id: number;
  name?: string | null;
  current_volume_liters?: number | null;
};

export type CreateBrewResponse = {
  brew: {
    id: string;
    name: string | null;
    start_date: string;
    end_date: string | null;
    stage: BrewStageResponse;
    batch_number: number | null;
    current_volume_liters: number | null;
    recipe_id: number | null;
  };
};

export type UpdateBrewRequestBody = {
  name?: string | null;
  stage?: BrewStageResponse;
  current_volume_liters?: number | null;
  requested_email_alerts?: boolean;
  end_date?: string | null;
};

export type UpdateBrewResponse = {
  id: string;
  name: string | null;
  start_date: string;
  end_date: string | null;
  stage: BrewStageResponse;
  batch_number: number | null;
  current_volume_liters: number | null;
  requested_email_alerts: boolean | null;
  latest_gravity: number | null;
  recipe_id: number | null;
} | null;

export type CreateBrewEntryRequestBody = {
  type: BrewEntryTypeResponse;
  datetime?: string;
  title?: string | null;
  note?: string | null;
  gravity?: number | null;
  temperature?: number | null;
  temp_units?: TemperatureUnitResponse | null;
  data?: object | null;
  stage_to?: BrewStageResponse;
};

export type CreateBrewEntryResponse = {
  brew: BrewResponse;
};

export type UpdateBrewEntryRequestBody = {
  datetime?: string;
  title?: string | null;
  note?: string | null;
  gravity?: number | null;
  temperature?: number | null;
  temp_units?: TemperatureUnitResponse | null;
  data?: object | null;
};

export type UpdateBrewEntryResponse = {
  entry: BrewEntryWithBrewIdResponse | null;
};

export type DeleteBrewSuccessResponse = {
  message: "Brew deleted successfully.";
};

export type DeleteBrewEntrySuccessResponse = {
  message: "Entry deleted successfully.";
};

export type AttachDeviceToBrewRequestBody = {
  device_id: string;
  force?: boolean;
};

export type AttachDeviceToBrewResponse = {
  message: "Device already attached" | "Device attached";
  device_id: string;
  brew_id: string;
};

export type AdoptLogsForBrewRequestBody = {
  device_id: string;
  start_date?: string;
  end_date?: string;
  from_brew_id?: string | null;
};

export type AdoptLogsForBrewResponse = {
  message: "Logs adopted";
  adopted_count: number;
  brew_id: string;
  device_id: string;
};

export type AuthenticatedRouteErrorResponse = {
  error:
    | "Authorization header missing"
    | "Token missing"
    | "Invalid token or unauthorized access"
    | "Invalid or expired token"
    | "User not found"
    | "Server misconfiguration";
};

export type BrewValidationErrorResponse = {
  error:
    | "Invalid JSON body"
    | "Missing recipe_id"
    | "Missing brew_id"
    | "Missing entry_id";
};

export type BrewFetchErrorResponse = {
  error: "Failed to fetch brews." | "Failed to fetch brew.";
};

export type BrewCreateErrorResponse = {
  error: "Failed to create brew.";
};

export type BrewUpdateErrorResponse = {
  error: "Failed to update brew.";
};

export type BrewDeleteErrorResponse = {
  error: "Failed to delete brew.";
};

export type BrewEntryCreateErrorResponse = {
  error: "Failed to create entry.";
};

export type BrewEntryUpdateErrorResponse = {
  error: "Failed to update entry.";
};

export type BrewEntryDeleteErrorResponse = {
  error: "Failed to delete entry.";
};

export type BrewDeviceActionErrorResponse = {
  error:
    | "Missing device_id"
    | "Brew not found"
    | "Device not found"
    | "Device already attached to another brew"
    | "Invalid start_date"
    | "Invalid end_date"
    | "Failed";
};

export type AdminAuthErrorResponse = {
  error:
    | "Authorization header missing"
    | "Token missing"
    | "Invalid token or unauthorized access"
    | "Invalid or expired token"
    | "User not found"
    | "Server misconfiguration"
    | "Unauthorized access"
    | "Forbidden – admin access required."
    | "Failed to verify admin";
};

export type AdminRecipesQueryParams = {
  page?: string;
  limit?: string;
  query?: string;
};

export type AdminRecipeListItemResponse = {
  id: number;
  user_id: number | null;
  name: string;
  recipeData: string;
  yanFromSource: string | null;
  yanContribution: string;
  nutrientData: string;
  advanced: boolean;
  nuteInfo: string | null;
  primaryNotes: string[][];
  secondaryNotes: string[][];
  dataV2: RecipeDataV2Response | null;
  version: number;
  private: boolean;
  lastActivityEmailAt: string | null;
  activityEmailsEnabled: boolean;
  users: {
    public_username: string | null;
    active: boolean;
  } | null;
  public_username: string;
  averageRating: number;
  numberOfRatings: number;
};

export type AdminRecipesPageResponse = {
  recipes: AdminRecipeListItemResponse[];
  totalCount: number;
  totalPages: number;
  page: number;
  limit: number;
};

export type AdminRecipesFetchErrorResponse = {
  error: "Failed to fetch recipes";
};

export type AdminUserPathParams = {
  id: string;
};

export type AdminUserListItemResponse = {
  id: number;
  email: string;
  role: string | null;
  google_id: string | null;
  public_username: string | null;
  hydro_token: string | null;
  active: boolean;
};

export type AdminUsersResponse = AdminUserListItemResponse[];

export type AdminUserResponse = {
  id: number;
  email: string;
  password: string | null;
  google_id: string | null;
  role: string | null;
  hydro_token: string | null;
  public_username: string | null;
  google_avatar_url: string | null;
  show_google_avatar: boolean;
  active: boolean;
};

export type UpdateAdminUserRequestBody = {
  email?: string;
  password?: string;
  role?: string;
  public_username?: string;
  google_id?: string;
  hydro_token?: string;
  updateToken?: boolean;
};

export type DeleteAdminUserSuccessResponse = {
  message: "User deleted successfully";
};

export type AdminUsersFetchErrorResponse = {
  error: "Failed to fetch users";
};

export type AdminUserNotFoundErrorResponse = {
  error: "User not found";
};

export type AdminUserFetchErrorResponse = {
  error: "Failed to fetch user";
};

export type AdminUserUpdateErrorResponse = {
  error: "Failed to update user";
};

export type AdminUserDeleteErrorResponse = {
  error: "Failed to delete user";
};

export type CreateBjcpIngredientRequestBody = {
  label?: string | null;
  category?: string | null;
  value?: string | null;
};

export type CreateBjcpIngredientFailureErrorResponse = ApiErrorResponse;

export type HydrometerDevicePathParams = {
  device_id: string;
};

export type HydrometerLogPathParams = {
  id: string;
};

export type HydrometerLogsQueryParams = {
  device_id: string;
  start_date: string;
  end_date?: string;
};

export type HydrometerLogMutationQueryParams = {
  device_id: string;
};

export type HydrometerLogMutationParams = {
  id: string;
  device_id: string;
};

export type HydrometerLogRangeDeleteQueryParams = {
  device_id: string;
  start_date: string;
  end_date: string;
};

export type HydrometerDeviceBrewResponse = {
  id: string;
  name: string | null;
};

export type HydrometerDeviceResponse = {
  id: string;
  device_name: string | null;
  brew_id: string | null;
  recipe_id: number | null;
  coefficients: number[];
  brews?: HydrometerDeviceBrewResponse | null;
};

export type HydrometerAccountResponse = {
  hydro_token: string | null;
  devices: HydrometerDeviceResponse[];
};

export type HydrometerTokenResponse = {
  token: string;
};

export type HydrometerBrewResponse = {
  id: string;
  start_date: string;
  end_date: string | null;
  user_id: number | null;
  latest_gravity: number | null;
  recipe_id: number | null;
  name: string | null;
  requested_email_alerts: boolean | null;
  sb_alert_sent: boolean | null;
  fg_alert_sent: boolean | null;
  stage: BrewStageResponse;
  batch_number: number | null;
  current_volume_liters: number | null;
  recipe_snapshot: object | null;
};

export type HydrometerBrewsResponse = HydrometerBrewResponse[];

export type StartHydrometerBrewRequestBody = {
  device_id: string;
  brew_name: string;
};

export type HydrometerBrewDevicePairItemResponse =
  | HydrometerBrewResponse
  | HydrometerDeviceResponse;

export type StartHydrometerBrewResponse =
  HydrometerBrewDevicePairItemResponse[];

export type UpdateHydrometerBrewRequestBody = {
  brew_id: string;
  device_id?: string;
  brew_name?: string | null;
};

export type RenameHydrometerBrewResponse = HydrometerBrewResponse;

export type EndHydrometerBrewResponse = HydrometerBrewDevicePairItemResponse[];

export type UpdateHydrometerBrewResponse =
  | HydrometerBrewResponse
  | EndHydrometerBrewResponse;

export type LinkRecipeToHydrometerBrewRequestBody = {
  recipe_id?: number;
  requested_email_alerts?: boolean;
};

export type LinkRecipeToHydrometerBrewResponse = HydrometerBrewResponse;

export type HydrometerBrewAlertResponse = {
  message: string;
};

export type UpdateHydrometerBrewRecipeOrAlertsResponse =
  | LinkRecipeToHydrometerBrewResponse
  | HydrometerBrewAlertResponse;

export type DeleteHydrometerBrewResponse = {
  message: "Brew deleted successfully.";
};

export type UpdateHydrometerDeviceRequestBody = {
  coefficients: number[];
};

export type DeleteHydrometerDeviceResponse = {
  message: string;
};

export type HydrometerLogResponse = {
  id: string;
  datetime: string;
  angle: number;
  temperature: number;
  temp_units: TemperatureUnitResponse;
  battery: number;
  gravity: number;
  interval: number;
  calculated_gravity: number | null;
  device_id: string | null;
  brew_id: string | null;
};

export type HydrometerLogsResponse = HydrometerLogResponse[];

export type UpdateHydrometerLogRequestBody = {
  angle?: number | string;
  temperature?: number | string;
  temp_units?: "F" | "C";
  battery?: number | string;
  gravity?: number | string;
  interval?: number | string;
  calculated_gravity?: number | string;
  dateTime?: string;
};

export type DeleteHydrometerLogsInRangeResponse = {
  message: string;
};

export type HydrometerIngestRequestBody = {
  token: string;
  name: string;
  angle?: number;
  temperature: number;
  temp_units?: "F" | "C";
  battery?: number;
  gravity: number;
  interval?: number;
};

export type RaptPillCloudIngestRequestBody = HydrometerIngestRequestBody;

export type RaptPillRegisterRequestBody = {
  token: string;
  name: string;
  gravity: number;
};

export type TiltColor =
  | "BLUE"
  | "BLACK"
  | "RED"
  | "ORANGE"
  | "YELLOW"
  | "PURPLE"
  | "PINK";

export type TiltIngestQueryParams = {
  token: string;
};

export type TiltIngestRequestBody = {
  Beer: string;
  Temp: number | string;
  SG: number | string;
  Color: TiltColor;
  Comment?: string;
  Timepoint?: number | string;
};

export type HydrometerAuthErrorResponse = {
  error: "Missing token" | "Invalid token";
};

export type HydrometerAccountErrorResponse = {
  error: "Failed to fetch hydro_token" | "Failed to create hydro_token";
};

export type HydrometerBrewValidationErrorResponse = {
  error:
    | "Missing device_id or brew_name"
    | "Missing brew_id"
    | "Missing device_id for ending brew"
    | "Missing brew_id or recipe_id";
};

export type HydrometerBrewErrorResponse = {
  error:
    | "Failed to get brews."
    | "Failed to create brew."
    | "Failed to update brew."
    | "Failed to delete brew.";
};

export type HydrometerDeviceErrorResponse = {
  error: "Failed to update device." | "Failed to delete device.";
};

export type HydrometerLogValidationErrorResponse = {
  error:
    | "Date or Device Id error"
    | "Missing device_id parameter"
    | "Must provide a device id."
    | "Missing device_id, start_date, or end_date parameters"
    | "Unsupported content type"
    | "Missing required fields";
};

export type HydrometerLogErrorResponse = {
  error:
    | "Failed to fetch logs."
    | "Failed to update log."
    | "Failed to delete log."
    | "Error deleting log."
    | "Failed to log"
    | "Failed to log Tilt data";
};

export type RaptPillRegisterErrorResponse = {
  error: "Failed to get device info";
};
