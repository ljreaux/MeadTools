/* eslint-disable @next/next/no-img-element */
"use client";

import { useMemo } from "react";
import lodash from "lodash";
import { useTranslation } from "react-i18next";
import { toBrix, calcSb } from "@/lib/utils/unitConverter";
import { normalizeNumberString, parseNumber } from "@/lib/utils/validateInput";

import type { NutrientKey } from "@/types/nutrientDataV2";
import { ORDER } from "@/types/nutrientDataV2";

type Props = {
  recipe: ReturnType<
    typeof import("@/components/providers/RecipeProviderV2").useRecipeV2
  >;
  nutrients: ReturnType<
    typeof import("@/components/providers/NutrientProviderV2").useNutrientsV2
  >;
  yeast?: any;

  // optional metadata from saved recipe row
  title?: string;
  publicUsername?: string;
};

function n0(x: unknown): number {
  const n = typeof x === "number" ? x : parseNumber(String(x ?? ""));
  return Number.isFinite(n) ? n : 0;
}

export default function RecipePdfView({
  recipe,
  nutrients,
  yeast,
  title,
  publicUsername
}: Props) {
  const { t, i18n } = useTranslation();
  const currentLocale = i18n.resolvedLanguage;

  // ---------- Build a V2 view model ----------
  const model = useMemo(() => {
    const r = recipe;
    const n = nutrients;

    const unitDefaults = r.data.unitDefaults;

    // for temp conversion only (keep your old behavior)
    const isMetric =
      unitDefaults.weight === "kg" ||
      unitDefaults.weight === "g" ||
      unitDefaults.volume === "L" ||
      unitDefaults.volume === "mL";

    const toC = (f?: unknown) => {
      const num = n0(f);
      if (!Number.isFinite(num) || num === 0) return "";
      return isMetric ? Math.round((num - 32) * (5 / 9)) : Math.round(num);
    };

    // ✅ Ingredients: show NEW per-line units (no conversion)
    const ingredientRows = (r.data.ingredients ?? []).map((line) => {
      const hasAmount =
        parseNumber(line.amounts.weight.value) > 0 ||
        parseNumber(line.amounts.volume.value) > 0;

      return {
        lineId: line.lineId,
        secondary: line.secondary,
        name: line.name,

        // raw strings the user typed (already “per-line units”)
        weightStr: line.amounts.weight.value,
        volumeStr: line.amounts.volume.value,

        // per-line units
        weightUnit: line.amounts.weight.unit,
        volumeUnit: line.amounts.volume.unit,

        hasAmount
      };
    });

    const primary = ingredientRows.filter((x) => !x.secondary && x.hasAmount);
    const secondary = ingredientRows.filter((x) => x.secondary && x.hasAmount);

    const filteredAdditives = (r.data.additives ?? []).filter((a) => {
      const amt = parseNumber(a.amount);
      return (
        Number.isFinite(amt) &&
        amt > 0 &&
        String(a.name ?? "").trim().length > 0
      );
    });

    const secondaryNotesExist =
      (r.data.notes?.secondary?.length ?? 0) > 0 &&
      ((r.data.notes.secondary?.[0]?.content?.[0] ?? "").length > 0 ||
        (r.data.notes.secondary?.[0]?.content?.[1] ?? "").length > 0);

    const showPageTwo =
      secondary.length > 0 ||
      secondaryNotesExist ||
      filteredAdditives.length > 0;

    const yeastName = yeast?.name ?? n.data.selected.yeastStrain;
    const yeastBrand =
      n.data.selected.yeastBrand && n.data.selected.yeastBrand !== "Other"
        ? n.data.selected.yeastBrand
        : "";

    const lowTemp = toC(yeast?.low_temp);
    const highTemp = toC(yeast?.high_temp);

    const tempString =
      lowTemp !== "" && highTemp !== ""
        ? `${t("PDF.tempRange")} ${lowTemp}-${highTemp}°${isMetric ? "C" : "F"}`
        : "";

    // Volumes / gravities from derived (the real V2 truth)
    const totalVolume = r.derived.totalVolume;
    const og = r.derived.ogPrimary;
    const backsweetenedFg = r.derived.backsweetenedFg;
    const abv = r.derived.abv;
    const delle = r.derived.delle;

    return {
      unitDefaults,
      isMetric,

      // header meta
      recipeTitle: title?.trim() || t("PDF.pageTitle"),
      byUser: t("byUser", { public_username: publicUsername ?? "Anonymous" }),

      // main values
      totalVolume,
      og,
      backsweetenedFg,
      abv,
      delle,

      yeastBrand,
      yeastName,
      yeastTolerance: yeast?.tolerance,
      tempString,

      // tables
      primary,
      secondary,
      filteredAdditives,
      secondaryNotesExist,
      showPageTwo
    };
  }, [recipe, nutrients, yeast, title, publicUsername, t]);

  // ---------- Nutrient rows (V2 keys) ----------
  const nutrientRows = useMemo(() => {
    const enabled = nutrients.data.selected.selectedNutrients;
    const per = nutrients.derived.nutrientAdditions.perAddition;
    const total = nutrients.derived.nutrientAdditions.totalGrams;

    const otherName =
      nutrients.data.settings.other?.name?.trim() || t("other.label");

    const labelKey: Record<NutrientKey, string> = {
      fermO: "nutrients.fermO",
      fermK: "nutrients.fermK",
      dap: "nutrients.dap",
      other: "other.label"
    };

    const suffix: Record<NutrientKey, string> = {
      fermO: "g Fermaid O",
      fermK: "g Fermaid K",
      dap: "g DAP",
      other: `g ${otherName}`
    };

    return ORDER.filter((k) => enabled[k]).map((k) => ({
      key: k,
      label: t(labelKey[k]),
      per: Number.isFinite(per[k]) ? per[k] : 0,
      total: Number.isFinite(total[k]) ? total[k] : 0,
      suffix: suffix[k]
    }));
  }, [nutrients, t]);

  const goFermKeys: Record<string, string> = {
    "Go-Ferm": "nuteResults.gfTypes.gf",
    protect: "nuteResults.gfTypes.gfProtect",
    "sterol-flash": "nuteResults.gfTypes.gfSterol",
    none: "nuteResults.gfTypes.none"
  };

  const goFermType = nutrients.data.inputs.goFermType;
  const goFermLabel = t(goFermKeys[goFermType] ?? goFermType);

  // ---------- Render ----------
  return (
    <div className="pdf-page">
      <div className="page-one">
        <header>
          <img src="/pdf-logo.png" alt="meadtools logo" />
          <span>
            <h1>{model.recipeTitle}</h1>
            <p>{model.byUser}</p>
          </span>
        </header>

        <section>
          <table>
            <thead>
              <tr>
                <td>{t("PDF.totalVolume")}</td>
                <td>{t("PDF.yeast")}</td>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <p>
                    {normalizeNumberString(model.totalVolume, 3, currentLocale)}{" "}
                    {model.unitDefaults.volume}
                  </p>
                  <p>
                    {nutrients.derived.goFerm.amount > 0 &&
                      `${nutrients.derived.goFerm.amount}g ${goFermLabel} ${t(
                        "PDF.with"
                      )} ${nutrients.derived.goFerm.water}ml ${t("water")}`}
                  </p>
                </td>
                <td>
                  <p>
                    {`${nutrients.data.inputs.yeastAmountG || "0"}g ${t(
                      "PDF.of"
                    )} ${model.yeastBrand} ${model.yeastName}`}
                  </p>
                  <p>{model.tempString}</p>
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        <section>
          <table>
            <thead>
              <tr>
                <td>{t("PDF.estimatedOG")}</td>
                <td>{t("PDF.estimatedFG")}</td>
                <td>{t("PDF.tolerance")}</td>
                <td>{t("PDF.expectedABV")}</td>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <p>
                    {normalizeNumberString(model.og, 3, currentLocale, true)}
                  </p>
                  <p>
                    {normalizeNumberString(toBrix(model.og), 2, currentLocale)}
                  </p>
                </td>

                <td>
                  <p>
                    {normalizeNumberString(
                      model.backsweetenedFg,
                      3,
                      currentLocale,
                      true
                    )}
                  </p>
                  <p>
                    {`${normalizeNumberString(
                      toBrix(model.backsweetenedFg),
                      2,
                      currentLocale
                    )} ${t("BRIX")}`}
                  </p>
                </td>

                <td>
                  <p>
                    {model.yeastTolerance != null
                      ? `${model.yeastTolerance}%`
                      : ""}
                  </p>
                  <p>
                    {Number.isFinite(model.og)
                      ? `${t("PDF.sugarBreak")} ${normalizeNumberString(
                          calcSb(model.og),
                          3,
                          currentLocale,
                          true
                        )}`
                      : ""}
                  </p>
                </td>

                <td>
                  <p>{normalizeNumberString(model.abv, 2, currentLocale)}%</p>
                  <p>
                    {normalizeNumberString(model.delle, 0, currentLocale)}{" "}
                    {t("DU")}
                  </p>
                </td>
              </tr>
            </tbody>
          </table>

          <table>
            <thead>
              <tr>
                <td>{t("PDF.nutrient")}</td>
                <td>{t("PDF.numberOfAdditions")}</td>
                <td>{t("PDF.amount")}</td>
                <td>{t("PDF.total")}</td>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  {t(`nuteSchedules.${nutrients.data.selected.schedule}`)}
                </td>
                <td>{nutrients.data.inputs.numberOfAdditions || "1"}</td>

                <td>
                  {nutrientRows.map((row) => (
                    <p key={`nute-per-${row.key}`}>
                      {normalizeNumberString(
                        Math.max(row.per, 0),
                        3,
                        currentLocale
                      )}
                      {row.suffix}
                    </p>
                  ))}
                </td>

                <td>
                  {nutrientRows.map((row) => (
                    <p key={`nute-total-${row.key}`}>
                      {normalizeNumberString(
                        Math.max(row.total, 0),
                        3,
                        currentLocale
                      )}
                      {row.suffix}
                    </p>
                  ))}
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        <section>
          <table>
            <thead>
              <tr>
                {recipe.stabilizers.addingStabilizers && (
                  <td>{t("PDF.stabilizers")}</td>
                )}
                <td>{t("PDF.remaining")}</td>
              </tr>
            </thead>
            <tbody>
              <tr>
                {recipe.stabilizers.addingStabilizers && (
                  <td>
                    <p>
                      {`${normalizeNumberString(
                        recipe.stabilizers.sulfite,
                        3,
                        currentLocale
                      )}g ${t(`PDF.${recipe.stabilizers.stabilizerType}`)} ${t(
                        "accountPage.or"
                      )} ${normalizeNumberString(
                        recipe.stabilizers.campden,
                        3,
                        currentLocale
                      )} ${t("campden")}`}
                    </p>
                    <p>
                      {`${normalizeNumberString(
                        recipe.stabilizers.sorbate,
                        3,
                        currentLocale
                      )}g ${t("PDF.ksorb")}`}
                    </p>
                  </td>
                )}
                <td>{`${nutrients.derived.remainingYanPpm}PPM`}</td>
              </tr>
            </tbody>
          </table>

          {/* ✅ per-line units display */}
          <table>
            <thead>
              <tr>
                <td>{t("PDF.primary")}</td>
                <td>{t("PDF.weight")}</td>
                <td>{t("PDF.volume")}</td>
              </tr>
            </thead>
            <tbody>
              {model.primary.map((item, i) => {
                const camelKey = lodash.camelCase(item.name);
                const translatedText = i18n.exists(camelKey)
                  ? t(camelKey)
                  : item.name;

                return (
                  <tr key={item.lineId}>
                    <td>
                      {i + 1}. {translatedText}
                    </td>
                    <td>
                      {item.weightStr} {item.weightUnit}
                    </td>
                    <td>
                      {item.volumeStr} {item.volumeUnit}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        <section style={{ pageBreakAfter: "always" }}>
          {recipe.data.notes?.primary?.length > 0 &&
            (recipe.data.notes.primary?.[0]?.content?.[0] ?? "").length > 0 && (
              <table>
                <thead>
                  <tr>
                    <td>{t("PDF.primaryNotes")}</td>
                    <td>{t("PDF.details")}</td>
                  </tr>
                </thead>
                <tbody>
                  {recipe.data.notes.primary.map((note, i) => (
                    <tr key={note.lineId}>
                      <td>
                        <p>
                          {i + 1}. {note.content[0]}
                        </p>
                      </td>
                      <td>
                        <p>{note.content[1]}</p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
        </section>
      </div>

      {model.showPageTwo && (
        <div className="page-two">
          <div className="img-container">
            <img src="/pdf-logo.png" alt="meadtools logo" />
          </div>

          <section className="secondary-section">
            {model.secondary.length > 0 && (
              <table>
                <thead>
                  <tr>
                    <td>{t("PDF.secondary")}</td>
                    <td>{t("PDF.weight")}</td>
                    <td>{t("PDF.volume")}</td>
                  </tr>
                </thead>
                <tbody>
                  {model.secondary.map((item, i) => {
                    const camelKey = lodash.camelCase(item.name);
                    const translatedText = i18n.exists(camelKey)
                      ? t(camelKey)
                      : item.name;

                    return (
                      <tr key={item.lineId}>
                        <td>
                          {i + 1}. {translatedText}
                        </td>
                        <td>
                          {item.weightStr} {item.weightUnit}
                        </td>
                        <td>
                          {item.volumeStr} {item.volumeUnit}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </section>

          {model.filteredAdditives.length > 0 && (
            <section>
              <table>
                <thead>
                  <tr>
                    <td>Additives</td>
                    <td>Amount</td>
                  </tr>
                </thead>
                <tbody>
                  {model.filteredAdditives.map((a, i) => (
                    <tr key={`add-${a.lineId ?? i}`}>
                      <td>
                        {i + 1}. {a.name}
                      </td>
                      <td>{`${a.amount} ${
                        a.unit !== "units" ? a.unit : ""
                      }`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {model.secondaryNotesExist && (
            <table>
              <thead>
                <tr>
                  <td>{t("PDF.secondaryNotes")}</td>
                  <td>{t("PDF.details")}</td>
                </tr>
              </thead>
              <tbody>
                {recipe.data.notes.secondary.map((note, i) => (
                  <tr key={note.lineId}>
                    <td>
                      <p>
                        {i + 1}. {note.content[0]}
                      </p>
                    </td>
                    <td>
                      <p>{note.content[1]}</p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
