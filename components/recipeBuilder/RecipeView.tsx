/* eslint-disable @next/next/no-img-element */
"use client";
import lodash from "lodash";
import { useTranslation } from "react-i18next";
import { toBrix, calcSb } from "@/lib/utils/unitConverter";
import { NutrientType } from "@/types/nutrientTypes";
import { Recipe } from "@/types/recipeDataTypes";
import { parseNumber } from "@/lib/utils/validateInput";
function RecipeView({
  nutrientData,
  recipeData
}: {
  nutrientData: NutrientType;
  recipeData: Recipe;
}) {
  const {
    selected,
    inputs,
    goFerm,
    goFermType,
    yeastAmount,
    nutrientAdditions,
    remainingYan,
    otherNutrientName
  } = nutrientData;
  const {
    units,
    ingredients,
    additives,
    notes,
    volume,
    OG,
    backsweetenedFG,
    ABV,
    delle,
    sorbate,
    sulfite,
    campden,
    addingStabilizers,
    recipeNameProps,
    public_username,
    stabilizerType
  } = recipeData;

  const { t, i18n } = useTranslation();
  const currentLocale = i18n.resolvedLanguage;
  const isMetric = units?.weight === "kg" || units?.volume === "liter";
  function toC(num?: number) {
    if (!num) return "";
    return isMetric ? Math.round((num - 32) * (5 / 9)) : num;
  }
  const lowTemp = toC(parseNumber(selected.yeastDetails.low_temp));
  const highTemp = toC(parseNumber(selected?.yeastDetails.high_temp));
  const tempString = `${t("PDF.tempRange")} ${lowTemp}-${highTemp}°${
    isMetric ? "C" : "F"
  }`;

  const primary = ingredients.filter(
    (item) => !item.secondary && parseNumber(item.details[0]) > 0
  );
  const secondary =
    ingredients?.filter(
      (item) => item.secondary && parseNumber(item.details[0]) > 0
    ) || [];
  const filteredAdditives =
    additives?.filter((item) => {
      return parseNumber(item.amount) > 0 && item.name.length > 0;
    }) || [];

  const secondaryNotesExist =
    notes.secondary.length > 0 &&
    (notes.secondary[0].content[0].length > 0 ||
      notes.secondary[0].content[1].length > 0);

  const showPageTwo =
    secondary.length > 0 || secondaryNotesExist || filteredAdditives.length > 0;

  const nuteNames = [
    "g Fermaid O",
    "g Fermaid K",
    "g DAP",
    `g ${otherNutrientName.value}`
  ];
  const labels = [
    "nutrients.fermO",
    "nutrients.fermK",
    "nutrients.dap",
    "other.label"
  ];
  const goFermKeys = {
    "Go-Ferm": "nuteResults.gfTypes.gf",
    protect: "nuteResults.gfTypes.gfProtect",
    "sterol-flash": "nuteResults.gfTypes.gfSterol",
    none: "nuteResults.gfTypes.none"
  };

  const goFermLabel = t(goFermKeys[goFermType.value]) || t(goFermType.value);

  return (
    <div className="pdf-page">
      <div className="page-one">
        <header>
          <img src="/pdf-logo.png" alt="meadtools logo" />
          <span>
            <h1>
              {recipeNameProps.value
                ? recipeNameProps.value
                : t("PDF.pageTitle")}
            </h1>
            <p>
              {t("byUser", { public_username: public_username ?? "Anonymous" })}
            </p>
          </span>
        </header>
        <section>
          <table>
            <thead>
              <tr>
                <td>{t("PDF.totalVolume")}</td>
                <td> {t("PDF.yeast")}</td>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <p>
                    {volume} {units && units.volume}
                  </p>
                  <p>
                    {goFerm.amount > 0 &&
                      `${goFerm.amount}g ${goFermLabel} ${t(
                        "PDF.with"
                      )} ${goFerm.water}ml ${t("water")}`}
                  </p>
                </td>
                <td>
                  <p>
                    {`${yeastAmount}g ${t("PDF.of")} ${
                      selected?.yeastBrand !== "Other"
                        ? selected?.yeastBrand
                        : ""
                    } ${selected?.yeastDetails.name}`}
                  </p>
                  <p>{tempString}</p>
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
                    {OG.toLocaleString(currentLocale, {
                      maximumFractionDigits: 3,
                      minimumFractionDigits: 3
                    })}
                  </p>
                  <p>
                    {toBrix(OG).toLocaleString(currentLocale, {
                      maximumFractionDigits: 2
                    })}
                  </p>
                </td>
                <td>
                  <p>
                    {parseNumber(backsweetenedFG).toLocaleString(
                      currentLocale,
                      {
                        maximumFractionDigits: 3,
                        minimumFractionDigits: 3
                      }
                    )}
                  </p>
                  <p>{`${toBrix(parseNumber(backsweetenedFG)).toLocaleString(
                    currentLocale,
                    {
                      maximumFractionDigits: 2
                    }
                  )} ${t("BRIX")}`}</p>
                </td>
                <td>
                  <p>{`${selected?.yeastDetails.tolerance}%`}</p>
                  <p>
                    {OG !== undefined
                      ? `${t("PDF.sugarBreak")} ${calcSb(OG).toLocaleString(
                          currentLocale,
                          { maximumFractionDigits: 3 }
                        )}`
                      : ""}
                  </p>
                </td>
                <td>
                  <p>
                    {ABV.toLocaleString(currentLocale, {
                      maximumFractionDigits: 2
                    })}
                    %
                  </p>
                  <p>
                    {delle.toLocaleString(currentLocale)} {t("DU")}
                  </p>
                </td>
              </tr>
            </tbody>
          </table>
          <table>
            <thead>
              <tr>
                <td> {t("PDF.nutrient")}</td>
                <td>{t("PDF.numberOfAdditions")}</td>
                <td> {t("PDF.amount")}</td>
                <td> {t("PDF.total")}</td>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{t(`nuteSchedules.${selected?.schedule}`)}</td>
                <td>{inputs.numberOfAdditions.value}</td>
                <td>
                  {nutrientAdditions.perAddition.map((nute, i) => {
                    const shouldShow = selected.selectedNutrients.includes(
                      t(labels[i])
                    );
                    if (shouldShow)
                      return (
                        <p key={`nute ${i}`}>
                          {Math.max(nute, 0).toLocaleString(currentLocale, {
                            maximumFractionDigits: 3
                          })}
                          {nuteNames[i]}
                        </p>
                      );
                  })}
                </td>
                <td>
                  {nutrientAdditions.totalGrams.map((nute, i) => {
                    const shouldShow = selected.selectedNutrients.includes(
                      t(labels[i])
                    );
                    if (shouldShow)
                      return (
                        <p key={`nute ${i}`}>
                          {Math.max(nute, 0).toLocaleString(currentLocale, {
                            maximumFractionDigits: 3
                          })}
                          {nuteNames[i]}
                        </p>
                      );
                  })}
                </td>
              </tr>
            </tbody>
          </table>
        </section>
        <section>
          <table>
            <thead>
              <tr>
                {addingStabilizers && <td>{t("PDF.stabilizers")}</td>}

                <td>{t("PDF.remaining")}</td>
              </tr>
            </thead>
            <tbody>
              <tr>
                {addingStabilizers && (
                  <td>
                    <p>
                      {`${sulfite.toLocaleString(currentLocale, {
                        maximumFractionDigits: 3
                      })}g ${t(`PDF.${stabilizerType}`)} ${t(
                        "accountPage.or"
                      )} ${campden.toLocaleString(currentLocale, {
                        maximumFractionDigits: 3
                      })} ${t("campden")}`}
                    </p>
                    <p>{`${sorbate.toLocaleString(currentLocale, {
                      maximumFractionDigits: 3
                    })}g ${t("PDF.ksorb")}`}</p>
                  </td>
                )}
                <td>{`${remainingYan}PPM`}</td>
              </tr>
            </tbody>
          </table>
          <table>
            <thead>
              <tr>
                <td>{t("PDF.primary")}</td>
                <td>
                  {t("PDF.weight")} {units.weight}
                </td>
                <td>
                  {t("PDF.volume")} {units.volume}
                </td>
              </tr>
            </thead>
            <tbody>
              {primary?.map((item, i) => {
                const camelKey = lodash.camelCase(item.name);

                // Check if the key exists in translations
                const translatedText = i18n.exists(camelKey)
                  ? t(camelKey)
                  : item.name;
                return (
                  <tr key={item.name + i}>
                    <td>
                      {i + 1}. {translatedText}
                    </td>
                    <td>{item.details[0]}</td>
                    <td>{item.details[1]}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
        <section style={{ pageBreakAfter: "always" }}>
          {notes.primary.length > 0 &&
            notes.primary[0].content[0].length > 0 && (
              <table>
                <thead>
                  <tr>
                    <td>{t("PDF.primaryNotes")}</td>
                    <td> {t("PDF.details")}</td>
                  </tr>
                </thead>
                <tbody>
                  {notes.primary.map((note, i) => {
                    return (
                      <tr key={note.id}>
                        <td>
                          <p>
                            {i + 1}. {note.content[0]}
                          </p>
                        </td>
                        <td>
                          <p>{note.content[1]}</p>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
        </section>
      </div>
      {showPageTwo && (
        <div className="page-two">
          <div className="img-container">
            <img src="/pdf-logo.png" alt="meadtools logo" />
          </div>
          <section className="secondary-section">
            {secondary.length > 0 && (
              <table>
                <thead>
                  <tr>
                    <td>{t("PDF.secondary")}</td>
                    <td>
                      {t("PDF.weight")} {units.weight}
                    </td>
                    <td>
                      {t("PDF.volume")} {units.volume}
                    </td>
                  </tr>
                </thead>
                <tbody>
                  {secondary.map((item, i) => {
                    const camelKey = lodash.camelCase(item.name);

                    // Check if the key exists in translations
                    const translatedText = i18n.exists(camelKey)
                      ? t(camelKey)
                      : item.name;
                    return (
                      <tr key={item.name + i}>
                        <td>
                          {i + 1}. {translatedText}
                        </td>
                        <td>{item.details[0]}</td>
                        <td>{item.details[1]}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </section>
          {filteredAdditives.length > 0 && (
            <section>
              <table>
                <thead>
                  <tr>
                    <td>Additives</td>

                    <td>Amount</td>
                  </tr>
                </thead>
                <tbody>
                  {filteredAdditives?.map((item, i) => (
                    <tr key={"additive " + i}>
                      <td>
                        {i + 1}. {item.name}
                      </td>
                      <td>
                        {`${item.amount} ${
                          item.unit !== "units" ? item.unit : ""
                        }`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
          {secondaryNotesExist && (
            <table>
              <thead>
                <tr>
                  <td>{t("PDF.secondaryNotes")}</td>
                  <td> {t("PDF.details")}</td>
                </tr>
              </thead>
              <tbody>
                {notes.secondary.map((note, i) => {
                  return (
                    <tr key={note.id}>
                      <td>
                        <p>
                          {" "}
                          {i + 1}. {note.content[0]}
                        </p>
                      </td>
                      <td>
                        <p>{note.content[1]}</p>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

export default RecipeView;
