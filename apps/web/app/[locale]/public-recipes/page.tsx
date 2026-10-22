import RecipeList from "./RecipeList";
import initTranslations from "@/lib/i18n";
import { getPublicRecipesPage } from "@/lib/db/recipes";

const DEFAULT_PAGE_SIZE = 10;
const ALLOWED_PAGE_SIZES = Array.from({ length: 5 }, (_, i) => (i + 1) * 10);

export default async function PublicRecipes({
  params,
  searchParams
}: Readonly<{
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ page?: string; query?: string; pageSize?: string }>;
}>) {
  const { locale } = await params;
  const {
    page: pageParam,
    query: queryParam,
    pageSize: pageSizeParam
  } = await searchParams;

  const i18nNamespaces = ["default", "YeastTable"];
  const { t } = await initTranslations(locale, i18nNamespaces);

  // page
  const page = Math.max(1, Number(pageParam) || 1);

  // query
  const query = typeof queryParam === "string" ? queryParam.trim() : "";

  // pageSize from URL, clamped to allowed set
  const parsedPageSize = Number(pageSizeParam);
  const pageSize = ALLOWED_PAGE_SIZES.includes(parsedPageSize)
    ? parsedPageSize
    : DEFAULT_PAGE_SIZE;

  try {
    const { recipes, totalPages, totalCount } = await getPublicRecipesPage({
      page,
      limit: pageSize,
      query
    });

    return (
      <div className="flex flex-col p-12 py-8 rounded-xl bg-background gap-4 w-11/12 max-w-[1000px]">
        <h1 className="text-2xl font-bold text-foreground mb-4">
          {t("publicRecipes.title")}
        </h1>
        <RecipeList
          recipes={recipes}
          page={page}
          totalPages={totalPages}
          totalCount={totalCount}
          query={query}
          pageSize={pageSize}
          allowedPageSizes={ALLOWED_PAGE_SIZES}
        />
      </div>
    );
  } catch (error) {
    console.error("Error loading recipes:", error);
    return (
      <div className="flex flex-col p-12 py-8 rounded-xl bg-background gap-4 w-11/12 max-w-[1000px]">
        <p className="text-destructive-foreground">{t("publicRecipes.fail")}</p>
      </div>
    );
  }
}
