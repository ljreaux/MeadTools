import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import * as Localization from "expo-localization";
import { router, useLocalSearchParams } from "expo-router";
import { type ReactNode, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View
} from "react-native";
import { useTranslation } from "react-i18next";

import { MeadToolsApiError } from "@meadtools/api-client";
import type { BrewResponse, CreateBrewEntryRequestBody } from "@meadtools/api-contract";
import type { GravityEntryUnit, GravityReadingRole } from "@meadtools/brew-domain/entry-payload";
import type { VolumeUnit } from "@meadtools/core/recipe";
import { colorThemes, radii, spacing, typography } from "@meadtools/design-tokens";

import {
  inventoryErrorCode,
  UNTRACKED,
  type StockChoice
} from "@/entries/inventory-deduction";
import { matchInventoryStock, planEntryInventory, tryInventoryEntryLines, InventoryError } from "@meadtools/inventory-domain";
import { buildPlannedAddition, plannedAdditionRows, type PlannedRow } from "@/entries/planned-additions";
import { useIsOnline } from "@/hooks/useIsOnline";
import { useThemeColors } from "@/hooks/useThemeColors";
import {
  ADDITION_UNITS,
  buildAdditionInput,
  buildPhInput,
  buildTemperatureInput,
  buildTextEntryInput,
  buildVolumeInput,
  MANUAL_ADDITION_KINDS,
  parseNumberField,
  PH_RANGE,
  preferredVolumeUnit,
  TEMPERATURE_RANGES,
  validateAddition,
  VOLUME_UNITS,
  type AdditionUnit,
  type ManualAdditionKind,
  type TemperatureUnit
} from "@/outbox/entry-forms";
import { useBrewEntryOutbox, useBrewEntryOutboxRecords } from "@/outbox/entry-outbox-provider";
import type { EnqueueEntryInput } from "@/outbox/entry-outbox-record";
import {
  buildGravityEnqueueInput,
  canCorrectRefractometer,
  convertGravityText,
  findOriginalGravity,
  GRAVITY_INPUT_RANGES,
  validateGravityInput
} from "@/outbox/gravity-entry-form";
import { useApiClient, useSession } from "@/providers/app-providers";

const ENTRY_TYPES = [
  "GRAVITY", "TEMPERATURE", "PH", "VOLUME", "ADDITION", "NOTE", "TASTING", "ISSUE"
] as const;
type EntryType = (typeof ENTRY_TYPES)[number];

const GRAVITY_ROLES: GravityReadingRole[] = ["GENERAL", "OG", "FG"];
const GRAVITY_UNITS: GravityEntryUnit[] = ["SG", "BRIX"];
const TEMPERATURE_UNITS: TemperatureUnit[] = ["F", "C"];

type Validation = { input: EnqueueEntryInput | null; errors: Record<string, string | null>; hint: string | null };

export default function AddEntryScreen() {
  const params = useLocalSearchParams<{ brewId: string; name?: string; unit?: string; stage?: string; type?: string; planned?: string }>();
  const brewId = params.brewId ?? "";
  const { colors } = useThemeColors();
  const styles = createStyles(colors);
  const { t, i18n } = useTranslation();
  const outbox = useBrewEntryOutbox();
  const { session } = useSession();
  const queryClient = useQueryClient();
  const apiClient = useApiClient();
  const online = useIsOnline();
  // Stock deduction (online only): the choice, and stable IDs so a retry of
  // the same save is idempotent on the server.
  const [stockChoices, setStockChoices] = useState<Record<string, StockChoice>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const deduction = useRef<CreateBrewEntryRequestBody | null>(null);
  // Mirrors `deduction` for rendering: a retry must resend the same request.
  const [deductionPending, setDeductionPending] = useState(false);
  const submitting = useRef(false);
  const queuedRecords = useBrewEntryOutboxRecords(brewId);
  const locale = Localization.getLocales()[0];

  const plannedMode = params.planned === "1";
  const cachedBrew = queryClient.getQueryData<BrewResponse>(["brew", session?.id, brewId]);
  const plan = useMemo(
    () => plannedMode && cachedBrew
      ? plannedAdditionRows(cachedBrew, queuedRecords, (index) => t("brews.primary.nutrientAddition", { index }))
      : null,
    [cachedBrew, plannedMode, queuedRecords, t]
  );
  const [selectedPlan, setSelectedPlan] = useState<PlannedRow | null>(null);
  const [componentAmounts, setComponentAmounts] = useState<Record<string, string>>({});
  const [plannedUnit, setPlannedUnit] = useState<string>();
  const [packetWeight, setPacketWeight] = useState("");
  const [skipGoFerm, setSkipGoFerm] = useState(false);

  const [type, setType] = useState<EntryType>(
    ENTRY_TYPES.includes(params.type as EntryType) ? (params.type as EntryType) : "GRAVITY"
  );
  const [note, setNote] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);

  // Gravity
  const [role, setRole] = useState<GravityReadingRole>("GENERAL");
  const [gravityUnit, setGravityUnit] = useState<GravityEntryUnit>(params.unit === "BRIX" ? "BRIX" : "SG");
  const [gravityText, setGravityText] = useState("");
  const [applyCorrection, setApplyCorrection] = useState(false);
  const [factorText, setFactorText] = useState("1");
  // Temperature, pH, volume
  const [temperatureUnit, setTemperatureUnit] = useState<TemperatureUnit>(
    locale?.temperatureUnit === "fahrenheit" ? "F" : "C"
  );
  const [temperatureText, setTemperatureText] = useState("");
  const [phText, setPhText] = useState("");
  const [volumeUnit, setVolumeUnit] = useState<VolumeUnit>(preferredVolumeUnit(locale?.measurementSystem));
  const [volumeText, setVolumeText] = useState("");
  // Addition
  const [additionKind, setAdditionKind] = useState<ManualAdditionKind>("INGREDIENT");
  const [additionName, setAdditionName] = useState("");
  const [amountText, setAmountText] = useState("");
  const [additionUnit, setAdditionUnit] = useState<AdditionUnit>("g");
  // Text entries
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const number = (digits: number) =>
    new Intl.NumberFormat(i18n.language, { minimumFractionDigits: digits, maximumFractionDigits: digits });
  const plain = new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 3 });

  // The brew's recorded OG, including an OG queued on this device.
  const originalGravity = useMemo(() => {
    const cached = queryClient.getQueryData<BrewResponse>(["brew", session?.id, brewId]);
    return findOriginalGravity([
      ...(cached?.entries ?? []),
      ...queuedRecords.map((record) => ({
        type: record.request.type,
        datetime: record.measuredAt,
        gravity: record.request.gravity ?? null,
        data: record.request.data ?? null
      }))
    ]);
  }, [brewId, queryClient, queuedRecords, session?.id]);
  const correctionAvailable = canCorrectRefractometer(gravityUnit, originalGravity);

  function rangeMessage(error: string, min: number, max: number) {
    return error === "range"
      ? t("mobileBrews.addEntry.errors.range", { min: plain.format(min), max: plain.format(max) })
      : t(`mobileBrews.addEntry.errors.${error}`);
  }

  const validation = ((): Validation => {
    const measuredAt = new Date();
    const show = (error: string) => (submitted || error !== "empty" ? error : null);
    switch (type) {
      case "GRAVITY": {
        const result = validateGravityInput(gravityText, gravityUnit, {
          apply: applyCorrection && correctionAvailable,
          factorText,
          originalGravity
        });
        if (!result.ok) {
          const error = show(result.error);
          const range = GRAVITY_INPUT_RANGES[gravityUnit];
          const message = error === null ? null
            : error === "range"
              ? t(gravityUnit === "SG" ? "mobileBrews.addEntry.gravity.rangeSg" : "mobileBrews.addEntry.gravity.rangeBrix", {
                  min: gravityUnit === "SG" ? number(3).format(range.min) : plain.format(range.min),
                  max: gravityUnit === "SG" ? number(3).format(range.max) : plain.format(range.max)
                })
              : error === "invalid" ? t("mobileBrews.addEntry.gravity.invalid")
                : error === "factor" ? t("mobileBrews.addEntry.gravity.factorError")
                  : t("mobileBrews.addEntry.errors.empty");
          return { input: null, errors: { [error === "factor" ? "factor" : "value"]: message }, hint: null };
        }
        const hint = result.unit !== "BRIX" ? null
          : result.correction
            ? t("mobileBrews.addEntry.gravity.correctedNote", { sg: number(3).format(result.sg) })
            : t("mobileBrews.addEntry.gravity.uncorrectedNote", { sg: number(3).format(result.sg) });
        return { input: buildGravityEnqueueInput({ brewId, reading: result, role, note, measuredAt }), errors: {}, hint };
      }
      case "TEMPERATURE": {
        const range = TEMPERATURE_RANGES[temperatureUnit];
        const result = parseNumberField(temperatureText, range);
        if (!result.ok) {
          const error = show(result.error);
          return { input: null, errors: { value: error && rangeMessage(error, range.min, range.max) }, hint: null };
        }
        return { input: buildTemperatureInput({ brewId, value: result.value, unit: temperatureUnit, note, measuredAt }), errors: {}, hint: null };
      }
      case "PH": {
        const result = parseNumberField(phText, PH_RANGE);
        if (!result.ok) {
          const error = show(result.error);
          return { input: null, errors: { value: error && rangeMessage(error, PH_RANGE.min, PH_RANGE.max) }, hint: null };
        }
        return { input: buildPhInput({ brewId, value: result.value, note, measuredAt }), errors: {}, hint: null };
      }
      case "VOLUME": {
        const range = { min: 0, max: 100_000, exclusiveMin: true };
        const result = parseNumberField(volumeText, range);
        if (!result.ok) {
          const error = show(result.error);
          return { input: null, errors: { value: error && rangeMessage(error, 0, range.max) }, hint: null };
        }
        return { input: buildVolumeInput({ brewId, value: result.value, unit: volumeUnit, note, measuredAt }), errors: {}, hint: null };
      }
      case "ADDITION": {
        if (plannedMode) {
          const row = selectedPlan;
          if (!row || !plan?.rows.some((item) => item.id === row.id && item.status === "available")) {
            return { input: null, errors: {}, hint: null };
          }
          const name = (row.source === "manual_yeast" ? additionName : row.name).trim();
          const range = { min: 0, max: 1_000_000 };
          const components = row.components?.map((component) => ({
            ...component,
            parsed: parseNumberField(componentAmounts[component.key] ?? "", range)
          }));
          const amount = parseNumberField(amountText, range);
          const packet = parseNumberField(packetWeight, { ...range, exclusiveMin: true });
          const errors: Validation["errors"] = {};
          if (!name) errors.name = t("mobileBrews.addEntry.errors.nameRequired");
          const skip = row.source === "recipe_go_ferm" && skipGoFerm;
          if (!skip && !components && !amount.ok && amountText.trim()) {
            errors.amount = rangeMessage(amount.error, range.min, range.max);
          }
          for (const component of components ?? []) {
            if (!component.parsed.ok) errors[component.key] = rangeMessage(component.parsed.error, range.min, range.max);
          }
          if (plannedUnit === "units" && row.kind === "YEAST" && !packet.ok) {
            errors.packet = t("mobileBrews.plannedAdditions.packetWeightRequired");
          }
          if (Object.keys(errors).length > 0) {
            return { input: null, errors: submitted ? errors : {}, hint: null };
          }
          const actualComponents = components?.map(({ parsed, ...component }) => ({
            ...component, amount: parsed.ok ? parsed.value : 0
          }));
          const inputRow = {
            ...row,
            meta: { ...row.meta, packetWeightG: plannedUnit === "units" && packet.ok ? packet.value : undefined }
          };
          return {
            input: {
              brewId,
              payload: buildPlannedAddition(inputRow, {
                name,
                amount: actualComponents?.reduce((sum, component) => sum + component.amount, 0)
                  ?? (amount.ok ? amount.value : undefined),
                unit: plannedUnit,
                components: actualComponents,
                note,
                skipGoFerm: skip,
                datetime: measuredAt.toISOString(),
                stage: row.group
              }, (key, fallback) => t(key, { defaultValue: fallback }))
            },
            errors: {},
            hint: null
          };
        }
        const result = validateAddition({ name: additionName, kind: additionKind, amountText, unit: additionUnit });
        if (!result.ok) {
          const error = show(result.error);
          const message = error === null ? null
            : result.field === "name" ? t("mobileBrews.addEntry.errors.nameRequired")
              : rangeMessage(error, 0, 1_000_000);
          return { input: null, errors: { [result.field]: message }, hint: null };
        }
        return {
          input: buildAdditionInput({
            brewId, name: result.name, kind: additionKind, amount: result.amount, unit: additionUnit,
            note, stage: params.stage ?? null, measuredAt
          }),
          errors: {},
          hint: null
        };
      }
      case "NOTE":
      case "TASTING":
      case "ISSUE": {
        if (!body.trim()) {
          return { input: null, errors: { body: submitted ? t("mobileBrews.addEntry.errors.textRequired") : null }, hint: null };
        }
        return { input: buildTextEntryInput({ brewId, type, title, note: body, measuredAt }), errors: {}, hint: null };
      }
    }
  })();

  async function save() {
    setSubmitted(true);
    setSaveFailed(false);
    setServerError(null);
    if (!outbox || submitting.current || (!validation.input && !deduction.current)) return;
    if (bindings.length || deduction.current) {
      if (!online || (stockError && !deduction.current)) return;
      submitting.current = true;
      setSaving(true);
      deduction.current ??= {
        ...validation.input!.payload,
        datetime: new Date().toISOString(),
        client_entry_id: Crypto.randomUUID(),
        inventory: { mode: "items", operation_id: Crypto.randomUUID(), items: bindings, expected: [] }
      };
      setDeductionPending(true);
      try {
        const brew = await apiClient.createBrewEntry(brewId, deduction.current);
        queryClient.setQueryData(["brew", session?.id, brewId], brew);
        void queryClient.invalidateQueries({ queryKey: ["brews", session?.id] });
        void queryClient.invalidateQueries({ queryKey: ["inventory", session?.id] });
        router.back();
      } catch (error) {
        const code = inventoryErrorCode(error);
        if (error instanceof MeadToolsApiError && error.status >= 400 && error.status < 500) {
          deduction.current = null;
          setDeductionPending(false);
        }
        setServerError(code
          ? t(`inventory.errors.${code}`, { defaultValue: t("mobileBrews.addEntry.addition.stock.failed") })
          : t(deduction.current ? "mobileBrews.plannedAdditions.retrySame" : "mobileBrews.addEntry.addition.stock.failed"));
        submitting.current = false;
        setSaving(false);
      }
      return;
    }
    if (!validation.input) return;
    submitting.current = true;
    setSaving(true);
    try {
      await outbox.enqueue({
        ...validation.input,
        payload: { ...validation.input.payload, datetime: new Date().toISOString() }
      });
      router.back();
    } catch {
      setSaveFailed(true);
      submitting.current = false;
      setSaving(false);
    }
  }

  const inventoryQuery = useQuery({
    queryKey: ["inventory", session?.id],
    queryFn: () => apiClient.getInventoryOverview(),
    enabled: Boolean(session) && type === "ADDITION" && online && (!plannedMode || Boolean(selectedPlan)),
    staleTime: 30_000
  });
  const canDeduct = type === "ADDITION" && online && inventoryQuery.data?.can_manage === true;
  const stockItems = canDeduct ? inventoryQuery.data?.stock ?? [] : [];
  const additionData = validation.input?.payload.type === "ADDITION" ? validation.input.payload.data : null;
  const stockRows = canDeduct && additionData ? tryInventoryEntryLines("ADDITION", additionData).map((line) => {
    const match = matchInventoryStock(stockItems, line);
    const choice = stockChoices[line.key];
    const selected = choice === UNTRACKED || match.choices.some((item) => item.id === choice)
      ? choice
      : match.warning === "linked_ambiguous" ? UNTRACKED : match.stock?.id ?? UNTRACKED;
    return { line, choices: match.choices, selected };
  }) : [];
  const bindings = stockRows.filter(({ selected }) => selected !== UNTRACKED)
    .map(({ line, selected }) => ({ line_key: line.key, stock_id: selected }));
  let balances: ReturnType<typeof planEntryInventory>["balances"] = [];
  let stockError: string | null = null;
  if (bindings.length) {
    try {
      balances = planEntryInventory({ stocks: stockItems, lines: stockRows.map(({ line }) => line), bindings, previous: [] }).balances;
    } catch (error) {
      stockError = error instanceof InventoryError ? error.code : "INCOMPATIBLE_UNITS";
    }
  }
  const tracked = bindings.length > 0 || deductionPending;

  if (!outbox || !brewId) {
    return (
      <View style={styles.unavailable}>
        <Text accessibilityRole="alert" style={styles.body}>{t("mobileBrews.addEntry.unavailable")}</Text>
      </View>
    );
  }

  function segmented<T extends string>(
    label: string,
    options: readonly T[],
    value: T,
    onChange: (next: T) => void,
    optionLabel: (option: T) => string
  ) {
    return (
      <View accessibilityLabel={label} accessibilityRole="radiogroup" style={styles.segments}>
        {options.map((option) => {
          const selected = option === value;
          return (
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              key={option}
              onPress={() => onChange(option)}
              style={[styles.segment, selected && styles.segmentSelected]}
            >
              {/* Longer translations (German "Anfangsdichte") shrink before they truncate.
                  Neither platform enforces minimumFontScale here (iOS falls back to
                  4 pt), so segment labels still need short translations. */}
              <Text
                adjustsFontSizeToFit
                minimumFontScale={0.75}
                numberOfLines={1}
                style={[styles.segmentText, selected && styles.segmentTextSelected]}
              >
                {optionLabel(option)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    );
  }

  function chips<T extends string>(
    label: string,
    options: readonly T[],
    value: T,
    onChange: (next: T) => void,
    optionLabel: (option: T) => string
  ) {
    return (
      <ScrollView
        accessibilityLabel={label}
        accessibilityRole="radiogroup"
        contentContainerStyle={styles.chips}
        horizontal
        keyboardShouldPersistTaps="handled"
        showsHorizontalScrollIndicator={false}
      >
        {options.map((option) => {
          const selected = option === value;
          return (
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              key={option}
              onPress={() => onChange(option)}
              style={[styles.chip, selected && styles.segmentSelected]}
            >
              <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>{optionLabel(option)}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    );
  }

  function field(label: string, children: ReactNode, error?: string | null, hint?: string | null) {
    return (
      <View style={styles.field}>
        <Text style={styles.label}>{label}</Text>
        {children}
        {error ? (
          <Text accessibilityLiveRegion="polite" accessibilityRole="alert" style={styles.error}>{error}</Text>
        ) : hint ? (
          <Text accessibilityLiveRegion="polite" style={styles.hint}>{hint}</Text>
        ) : null}
      </View>
    );
  }

  function numberInput(
    label: string,
    value: string,
    onChange: (text: string) => void,
    placeholder: string,
    invalid: boolean,
    large = true
  ) {
    return (
      <TextInput
        accessibilityLabel={label}
        inputMode="decimal"
        keyboardType="decimal-pad"
        onChangeText={(text) => {
          onChange(text);
          setSaveFailed(false);
        }}
        placeholder={placeholder}
        placeholderTextColor={colors.placeholder}
        style={[styles.input, large && styles.largeInput, invalid && styles.inputInvalid]}
        value={value}
      />
    );
  }

  const unitLabel = (unit: string) => t(`units.${unit}`, { defaultValue: unit });
  const { errors } = validation;

  function renderFields() {
    switch (type) {
      case "GRAVITY":
        return (
          <>
            {field(
              t("mobileBrews.addEntry.gravity.roleLabel"),
              segmented(t("mobileBrews.addEntry.gravity.roleLabel"), GRAVITY_ROLES, role, setRole,
                (option) => t(`mobileBrews.addEntry.gravity.roles.${option}`))
            )}
            {field(
              t("mobileBrews.addEntry.gravity.readingLabel"),
              <View style={styles.row}>
                <View style={styles.grow}>
                  {numberInput(
                    `${t("mobileBrews.addEntry.gravity.readingLabel")}, ${t(`mobileBrews.addEntry.gravity.units.${gravityUnit}`)}`,
                    gravityText,
                    setGravityText,
                    gravityUnit === "SG" ? number(3).format(1.05) : plain.format(12.5),
                    Boolean(errors.value)
                  )}
                </View>
                {segmented(t("mobileBrews.addEntry.unitLabel"), GRAVITY_UNITS, gravityUnit, (next) => {
                  setGravityText((current) => convertGravityText(current, gravityUnit, next));
                  setGravityUnit(next);
                }, (option) => t(`mobileBrews.addEntry.gravity.units.${option}`))}
              </View>,
              errors.value,
              validation.hint
            )}
            {gravityUnit === "BRIX" ? (
              <View style={styles.panel}>
                {correctionAvailable ? (
                  <>
                    <Pressable
                      accessibilityRole="switch"
                      accessibilityState={{ checked: applyCorrection }}
                      onPress={() => setApplyCorrection((current) => !current)}
                      style={styles.switchRow}
                    >
                      <Text style={styles.label}>{t("mobileBrews.addEntry.gravity.correction")}</Text>
                      <Switch
                        accessibilityElementsHidden
                        importantForAccessibility="no-hide-descendants"
                        onValueChange={setApplyCorrection}
                        value={applyCorrection}
                      />
                    </Pressable>
                    {applyCorrection ? field(
                      t("mobileBrews.addEntry.gravity.correctionFactor"),
                      numberInput(t("mobileBrews.addEntry.gravity.correctionFactor"), factorText, setFactorText,
                        plain.format(1), Boolean(errors.factor), false),
                      errors.factor,
                      t("mobileBrews.addEntry.gravity.correctionOg", { og: number(3).format(originalGravity!) })
                    ) : null}
                  </>
                ) : (
                  <Text style={styles.hint}>{t("mobileBrews.addEntry.gravity.correctionUnavailable")}</Text>
                )}
              </View>
            ) : null}
          </>
        );
      case "TEMPERATURE":
        return field(
          t("mobileBrews.addEntry.temperature.label"),
          <View style={styles.row}>
            <View style={styles.grow}>
              {numberInput(`${t("mobileBrews.addEntry.temperature.label")}, ${unitLabel(temperatureUnit)}`,
                temperatureText, setTemperatureText, plain.format(temperatureUnit === "F" ? 68 : 20), Boolean(errors.value))}
            </View>
            {segmented(t("mobileBrews.addEntry.unitLabel"), TEMPERATURE_UNITS, temperatureUnit, setTemperatureUnit, unitLabel)}
          </View>,
          errors.value
        );
      case "PH":
        return field(
          t("mobileBrews.addEntry.ph.label"),
          numberInput(t("mobileBrews.addEntry.ph.label"), phText, setPhText, plain.format(3.6), Boolean(errors.value)),
          errors.value
        );
      case "VOLUME":
        return (
          <>
            {field(
              t("mobileBrews.addEntry.volume.label"),
              numberInput(`${t("mobileBrews.addEntry.volume.label")}, ${unitLabel(volumeUnit)}`, volumeText, setVolumeText,
                plain.format(volumeUnit === "L" ? 19 : 5), Boolean(errors.value)),
              errors.value,
              t("mobileBrews.addEntry.volume.hint")
            )}
            {field(t("mobileBrews.addEntry.unitLabel"),
              chips(t("mobileBrews.addEntry.unitLabel"), VOLUME_UNITS, volumeUnit, setVolumeUnit, unitLabel))}
          </>
        );
      case "ADDITION":
        if (plannedMode && selectedPlan) {
          const row = selectedPlan;
          return (
            <>
              <Text style={styles.label}>{plannedLabel(row)}</Text>
              {row.source === "manual_yeast" ? field(t("mobileBrews.addEntry.addition.nameLabel"),
                <TextInput accessibilityLabel={t("mobileBrews.addEntry.addition.nameLabel")} style={styles.input}
                  value={additionName} onChangeText={setAdditionName} />, errors.name) : null}
              {row.source === "recipe_go_ferm" ? (
                <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: skipGoFerm }}
                  onPress={() => setSkipGoFerm(!skipGoFerm)} style={styles.stockRow}>
                  <Text style={styles.stockName}>{skipGoFerm ? "☑" : "☐"} {t("brews.primary.goFermNotUsed")}</Text>
                </Pressable>
              ) : null}
              {!skipGoFerm && (row.components
                ? row.components.map((component) => (
                    <View key={component.key}>{field(`${component.name} · g`,
                      numberInput(`${component.name} · g`, componentAmounts[component.key] ?? "",
                        (text) => setComponentAmounts((values) => ({ ...values, [component.key]: text })),
                        "", Boolean(errors[component.key]), false), errors[component.key])}</View>
                  ))
                : field(`${t("mobileBrews.addEntry.addition.amountLabel")} · ${unitLabel(plannedUnit ?? row.unit ?? "g")}`,
                    numberInput(t("mobileBrews.addEntry.addition.amountLabel"), amountText, setAmountText,
                      "", Boolean(errors.amount), false), errors.amount))}
              {row.kind === "YEAST" ? (
                <>
                  {chips(t("mobileBrews.addEntry.unitLabel"), ["g", "units"], plannedUnit ?? "g", setPlannedUnit, unitLabel)}
                  {plannedUnit === "units" ? field(t("mobileBrews.plannedAdditions.packetWeight"),
                    numberInput(t("mobileBrews.plannedAdditions.packetWeight"), packetWeight, setPacketWeight,
                      "", Boolean(errors.packet), false), errors.packet) : null}
                </>
              ) : null}
              {!skipGoFerm && renderStockSection()}
            </>
          );
        }
        return (
          <>
            {field(
              t("mobileBrews.addEntry.addition.kindLabel"),
              segmented(t("mobileBrews.addEntry.addition.kindLabel"), MANUAL_ADDITION_KINDS, additionKind, setAdditionKind,
                (option) => t(`mobileBrews.addEntry.addition.kinds.${option}`))
            )}
            {field(
              t("mobileBrews.addEntry.addition.nameLabel"),
              <TextInput
                accessibilityLabel={t("mobileBrews.addEntry.addition.nameLabel")}
                autoCapitalize="sentences"
                onChangeText={setAdditionName}
                placeholder={t("mobileBrews.addEntry.addition.namePlaceholder")}
                placeholderTextColor={colors.placeholder}
                style={[styles.input, errors.name && styles.inputInvalid]}
                value={additionName}
              />,
              errors.name
            )}
            {field(
              t("mobileBrews.addEntry.addition.amountLabel"),
              numberInput(t("mobileBrews.addEntry.addition.amountLabel"), amountText, setAmountText, "", Boolean(errors.amount), false),
              errors.amount
            )}
            {field(t("mobileBrews.addEntry.unitLabel"),
              chips(t("mobileBrews.addEntry.unitLabel"), ADDITION_UNITS, additionUnit, setAdditionUnit, unitLabel))}
            {renderStockSection()}
          </>
        );
      case "NOTE":
      case "TASTING":
      case "ISSUE": {
        const bodyLabel = t(
          type === "NOTE" ? "mobileBrews.addEntry.text.noteLabel"
            : type === "TASTING" ? "mobileBrews.addEntry.text.tastingLabel"
              : "mobileBrews.addEntry.text.issueLabel"
        );
        return (
          <>
            {type === "NOTE" ? field(
              t("mobileBrews.addEntry.text.titleLabel"),
              <TextInput
                accessibilityLabel={t("mobileBrews.addEntry.text.titleLabel")}
                onChangeText={setTitle}
                placeholderTextColor={colors.placeholder}
                style={styles.input}
                value={title}
              />
            ) : null}
            {field(
              bodyLabel,
              <TextInput
                accessibilityLabel={bodyLabel}
                multiline
                onChangeText={setBody}
                placeholderTextColor={colors.placeholder}
                style={[styles.input, styles.noteInput, errors.body && styles.inputInvalid]}
                textAlignVertical="top"
                value={body}
              />,
              errors.body
            )}
          </>
        );
      }
    }
  }

  function renderStockSection() {
    if (!online) {
      return <Text style={styles.hint}>{t("mobileBrews.addEntry.addition.stock.offline")}</Text>;
    }
    if (inventoryQuery.isPending) return <Text style={styles.hint}>{t("inventory.loading")}</Text>;
    if (inventoryQuery.isError) return <Text style={styles.hint}>{t("inventory.loadError")}</Text>;
    if (!canDeduct) {
      return <Text style={styles.hint}>{t("mobileBrews.addEntry.addition.inventoryHint")}</Text>;
    }
    const label = t("mobileBrews.addEntry.addition.stock.label");
    if (!stockRows.length) {
      return field(label, <Text style={styles.hint}>{t("mobileBrews.addEntry.addition.stock.needsAmount")}</Text>);
    }
    return field(label, <View style={styles.stockList}>
      {stockRows.map(({ line, choices, selected }) => (
        <View key={line.key} accessibilityLabel={line.name} accessibilityRole="radiogroup" style={styles.stockList}>
          {stockRows.length > 1 ? <Text style={styles.label}>{line.name}</Text> : null}
          {!choices.length ? <Text style={styles.hint}>{t("mobileBrews.addEntry.addition.stock.noMatch")}</Text> : null}
          {[...choices.map((item) => ({ id: item.id, label: item.name, quantity: item.quantity })),
            { id: UNTRACKED, label: t("brewInventory.untrackedChoice"), quantity: null }].map((option) => (
            <Pressable key={option.id} accessibilityRole="radio" accessibilityState={{ checked: selected === option.id }}
              onPress={() => {
                setStockChoices((current) => ({ ...current, [line.key]: option.id }));
                setServerError(null);
              }}
              style={[styles.stockRow, selected === option.id && styles.stockRowSelected]}>
              <View style={[styles.radio, selected === option.id && styles.radioSelected]} />
              <View style={styles.grow}>
                <Text style={styles.stockName}>{option.label}</Text>
                {option.quantity ? <Text style={styles.hint}>{plain.format(option.quantity.value)} {unitLabel(option.quantity.unit)}</Text> : null}
              </View>
            </Pressable>
          ))}
        </View>
      ))}
      {balances.map(({ stock_id, quantity }) => (
        <Text key={stock_id} style={styles.hint}>
          {stockItems.find((item) => item.id === stock_id)?.name} · {t("inventory.balanceAfter", {
            value: plain.format(quantity.value), unit: unitLabel(quantity.unit)
          })}
        </Text>
      ))}
    </View>, stockError ? t(`inventory.errors.${stockError}`, { defaultValue: t("inventory.invalid") }) : null);
  }

  function plannedLabel(row: PlannedRow) {
    return row.name || t("mobileBrews.plannedAdditions.manualYeast");
  }

  function selectPlan(row: PlannedRow) {
    setSelectedPlan(row);
    setAdditionName("");
    setNote("");
    setPacketWeight("");
    setSkipGoFerm(false);
    setSaveFailed(false);
    setServerError(null);
    setAmountText(Number.isFinite(row.amount) ? String(Number(row.amount!.toFixed(2))) : "");
    setPlannedUnit(row.unit);
    setComponentAmounts(Object.fromEntries((row.components ?? []).map((item) => [
      item.key, String(Number(item.amount.toFixed(2)))
    ])));
    setSubmitted(false);
    setStockChoices({});
  }

  if (plannedMode && !selectedPlan) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
        <Text style={styles.brewName}>{t("mobileBrews.plannedAdditions.title")}</Text>
        {plan?.hasNutrientPlan ? <Text style={styles.hint}>
          {t("mobileBrews.plannedAdditions.remaining", {
            amounts: Object.entries(plan.remaining)
              .filter(([, value]) => value > 0.01)
              .map(([key, value]) => `${t(`nutrients.${key}`, { defaultValue: key })} ${plain.format(value)} g`)
              .join(", ") || t("none")
          })}
        </Text> : null}
        {(["PRIMARY", "SECONDARY"] as const).map((group) => {
          const rows = plan?.rows.filter((item) => item.group === group) ?? [];
          return rows.length ? <View key={group} style={styles.stockList}>
            <Text style={styles.label}>{t(`brewStage.${group}`)}</Text>
            {rows.map((row) => (
              <Pressable key={row.id} accessibilityRole="button" disabled={row.status !== "available"}
                accessibilityState={{ disabled: row.status !== "available" }} style={styles.stockRow}
                onPress={() => selectPlan(row)}>
                <View style={styles.grow}>
                  <Text style={styles.stockName}>{plannedLabel(row)}</Text>
                  <Text style={styles.hint}>{row.status === "available"
                    ? row.amount != null && Number.isFinite(row.amount) ? `${plain.format(row.amount)} ${unitLabel(row.unit ?? "")}` : t("brews.primary.log")
                    : t(`mobileBrews.plannedAdditions.${row.status}`)}</Text>
                </View>
              </Pressable>
            ))}
          </View> : null;
        })}
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>{t("mobileBrews.addEntry.cancel")}</Text>
        </Pressable>
      </ScrollView>
    );
  }

  const isTextType = type === "NOTE" || type === "TASTING" || type === "ISSUE";

  return (
    <KeyboardAvoidingView behavior={process.env.EXPO_OS === "ios" ? "padding" : undefined} style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
      >
        {params.name ? <Text style={styles.brewName}>{params.name}</Text> : null}

        {plannedMode ? null : chips(t("mobileBrews.addEntry.typeLabel"), ENTRY_TYPES, type, (next) => {
          setType(next);
          setSubmitted(false);
          setSaveFailed(false);
        }, (option) => t(`mobileBrews.timeline.types.${option}`))}

        {deductionPending ? null : renderFields()}

        {isTextType || deductionPending ? null : field(
          t("mobileBrews.addEntry.noteLabel"),
          <TextInput
            accessibilityLabel={t("mobileBrews.addEntry.noteLabel")}
            multiline
            onChangeText={setNote}
            placeholderTextColor={colors.placeholder}
            style={[styles.input, styles.noteInput]}
            textAlignVertical="top"
            value={note}
          />
        )}

        {serverError ? (
          <Text accessibilityLiveRegion="polite" accessibilityRole="alert" style={styles.error}>{serverError}</Text>
        ) : null}
        {saveFailed ? (
          <Text accessibilityRole="alert" style={styles.error}>{t("mobileBrews.addEntry.errors.saveFailed")}</Text>
        ) : null}
        <Text style={styles.hint}>
          {t(tracked ? "mobileBrews.addEntry.addition.stock.saveOnline" : "mobileBrews.addEntry.measuredNow")}
        </Text>

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ busy: saving, disabled: saving || (tracked && !online) }}
          disabled={saving || (tracked && !online)}
          onPress={() => void save()}
          style={({ pressed }) => [styles.button, saving && styles.buttonDisabled, pressed && !saving && styles.pressed]}
        >
          {saving ? (
            <ActivityIndicator accessibilityLabel={t("mobileBrews.addEntry.saving")} color={colors.onAccent} />
          ) : (
            <Text style={styles.buttonText}>{t("mobileBrews.addEntry.save")}</Text>
          )}
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            if (plannedMode && !deduction.current) setSelectedPlan(null);
            else router.back();
          }}
          style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
        >
          <Text style={styles.secondaryButtonText}>{t("mobileBrews.addEntry.cancel")}</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function createStyles(colors: typeof colorThemes.light) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    content: { gap: spacing.lg, padding: spacing.xl },
    unavailable: {
      alignItems: "center",
      flex: 1,
      justifyContent: "center",
      padding: spacing.xl,
      backgroundColor: colors.background
    },
    brewName: { color: colors.text, fontSize: typography.size.action, fontWeight: typography.weight.bold },
    body: { color: colors.text, fontSize: typography.size.body, textAlign: "center" },
    field: { gap: spacing.sm },
    label: { color: colors.text, fontSize: typography.size.body, fontWeight: typography.weight.bold },
    row: { flexDirection: "row", gap: spacing.md, alignItems: "stretch" },
    grow: { flex: 1 },
    panel: {
      borderColor: colors.border,
      borderRadius: radii.lg,
      borderWidth: 1,
      gap: spacing.md,
      padding: spacing.lg
    },
    switchRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", gap: spacing.md },
    input: {
      minHeight: 52,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.lg,
      backgroundColor: colors.surface,
      color: colors.text,
      fontSize: typography.size.body,
      paddingHorizontal: spacing.lg
    },
    largeInput: {
      fontSize: typography.size.title,
      fontVariant: ["tabular-nums"],
      fontWeight: typography.weight.bold
    },
    inputInvalid: { borderColor: colors.error, borderWidth: 2 },
    noteInput: { minHeight: 96, paddingTop: spacing.md },
    segments: {
      flexDirection: "row",
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.lg,
      overflow: "hidden",
      minHeight: 52
    },
    segment: {
      flex: 1,
      minWidth: 56,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: spacing.md,
      backgroundColor: colors.surface
    },
    segmentSelected: { backgroundColor: colors.accent, borderColor: colors.accent },
    segmentText: { color: colors.text, fontSize: typography.size.body, fontWeight: typography.weight.bold },
    segmentTextSelected: { color: colors.onAccent },
    chips: { gap: spacing.sm, paddingVertical: spacing.xs },
    chip: {
      borderColor: colors.border,
      borderRadius: radii.round,
      borderWidth: 1,
      backgroundColor: colors.surface,
      justifyContent: "center",
      minHeight: 44,
      paddingHorizontal: spacing.lg
    },
    error: { color: colors.error, fontSize: typography.size.caption, fontWeight: typography.weight.bold },
    stockList: { gap: spacing.sm },
    stockRow: {
      alignItems: "center",
      borderColor: colors.border,
      borderRadius: radii.lg,
      borderWidth: 1,
      backgroundColor: colors.surface,
      flexDirection: "row",
      gap: spacing.md,
      minHeight: 52,
      padding: spacing.md
    },
    stockRowSelected: { borderColor: colors.accent, borderWidth: 2 },
    stockName: { color: colors.text, fontSize: typography.size.body, fontWeight: typography.weight.bold },
    radio: { borderColor: colors.textMuted, borderRadius: radii.round, borderWidth: 2, height: 20, width: 20 },
    radioSelected: { backgroundColor: colors.accent, borderColor: colors.accent },
    hint: { color: colors.textMuted, fontSize: typography.size.caption },
    button: {
      minHeight: 52,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: radii.lg,
      backgroundColor: colors.accent,
      paddingHorizontal: spacing.xl
    },
    buttonDisabled: { opacity: 0.45 },
    pressed: { opacity: 0.8 },
    buttonText: { color: colors.onAccent, fontSize: typography.size.body, fontWeight: typography.weight.bold },
    secondaryButton: { minHeight: 44, alignItems: "center", justifyContent: "center" },
    secondaryButtonText: { color: colors.text, fontSize: typography.size.body }
  });
}
