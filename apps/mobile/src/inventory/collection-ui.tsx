import type { ReactNode } from "react";
import { ActivityIndicator, View } from "react-native";
import { useTranslation } from "react-i18next";

import { StockButton, StockCard, StockText, useStockStyles } from "./stock-ui";

export function CollectionGate({ pending, error, allowed, retry, children }: {
  pending: boolean;
  error: boolean;
  allowed: boolean;
  retry: () => void;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  if (error) return (
    <StockCard>
      <StockText kind="error">{t("inventory.loadError")}</StockText>
      <StockButton label={t("equipment.retry")} onPress={retry} />
    </StockCard>
  );
  if (pending) return <ActivityIndicator accessibilityLabel={t("inventory.loading")} />;
  if (!allowed) return (
    <StockCard>
      <StockText kind="heading">{t("inventory.access.title")}</StockText>
      <StockText>{t("mobileInventory.premium")}</StockText>
    </StockCard>
  );
  return children;
}

export function CollectionSave({ busy, retryOnly, error, label, onSave, onCancel }: {
  busy: boolean;
  retryOnly: boolean;
  error: string | null;
  label: string;
  onSave: () => void;
  onCancel?: () => void;
}) {
  const { t } = useTranslation();
  const styles = useStockStyles();
  return (
    <>
      {error ? <StockText kind="error">{error}</StockText> : null}
      <View style={styles.row}>
        <StockButton label={t(busy ? "equipment.saving" : retryOnly ? "equipment.retry" : label)} onPress={onSave} disabled={busy} primary />
        {onCancel ? <StockButton label={t("cancel")} onPress={onCancel} disabled={busy} /> : null}
      </View>
    </>
  );
}

export function useBottleLabel() {
  const { t, i18n } = useTranslation();
  const number = new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 6 });
  return (bottle: { size_liters: number; display_size?: { value: number; unit: string } | null }) => {
    const size = bottle.display_size ?? { value: bottle.size_liters, unit: "L" };
    return `${number.format(size.value)} ${t(`inventory.units.${size.unit}`)}`;
  };
}
