export { additionInventoryQuantity } from "@meadtools/inventory-domain";

export class BrewInventoryCancelled extends Error {
  constructor() {
    super("Inventory confirmation cancelled");
  }
}
