import {
  normalizeQuantityUnit,
  quantitySchema,
  type Quantity,
} from "./quantity";

/** Only one physical ingredient use can share an ADDITION's stable identity. */
export function additionInventoryQuantity(data: unknown): Quantity | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const value = data as Record<string, unknown>;
  const meta =
    value.meta && typeof value.meta === "object"
      ? (value.meta as Record<string, unknown>)
      : null;
  if (Array.isArray(meta?.components) && meta.components.length > 1)
    return null;
  try {
    const quantity = quantitySchema.parse({
      value: value.amount,
      unit: normalizeQuantityUnit(value.unit),
    });
    return quantity.value > 0 ? quantity : null;
  } catch {
    return null;
  }
}

import { matchInventoryStock, type MatchStock } from './stock-matching';
export function brewStockChoices<T extends MatchStock>(stock:readonly T[],data:unknown):T[]{
 const value=data as {name?:string;kind?:string};const quantity=additionInventoryQuantity(data);return quantity?matchInventoryStock(stock,{key:'addition',name:value.name??'',kind:value.kind??'INGREDIENT',quantity}).choices:[];
}
export function defaultBrewStock<T extends MatchStock>(choices:readonly T[],data:unknown):T|undefined{
 const value=data as {name?:string;kind?:string};const quantity=additionInventoryQuantity(data);return quantity?matchInventoryStock(choices,{key:'addition',name:value.name??'',kind:value.kind??'INGREDIENT',quantity}).stock:undefined;
}
