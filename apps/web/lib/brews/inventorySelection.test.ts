import assert from "node:assert/strict";
import test from "node:test";
import { additionInventoryQuantity } from "./inventorySelection";

test("brew stock selection normalizes recorded units without assuming density or packet size", () => {
  assert.deepEqual(additionInventoryQuantity({ amount: 2, unit: "lbs" }), {
    value: 2,
    unit: "lb",
  });
  assert.deepEqual(additionInventoryQuantity({ amount: 250, unit: "ml" }), {
    value: 250,
    unit: "mL",
  });
  for (const data of [
    null,
    { amount: 1, unit: "packet" },
    { amount: -1, unit: "kg" },
    { amount: 0, unit: "kg" },
    { amount: 0.0000001, unit: "kg" },
  ])
    assert.equal(additionInventoryQuantity(data), null);
});
test("a blended addition is not silently deducted as one component stock", () => {
  assert.equal(
    additionInventoryQuantity({
      amount: 4,
      unit: "g",
      meta: {
        components: [
          { name: "DAP", amount: 2 },
          { name: "Fermaid O", amount: 2 },
        ],
      },
    }),
    null,
  );
  assert.deepEqual(
    additionInventoryQuantity({
      amount: 4,
      unit: "g",
      meta: { components: [{ name: "Fermaid O", amount: 4 }] },
    }),
    { value: 4, unit: "g" },
  );
});

test('entry kind filters stock and Fuse selects the closest compatible stock',async()=>{
 const {brewStockChoices,defaultBrewStock}=await import('@meadtools/inventory-domain');
 const stock=[{id:'h',name:'Wildflower honey',category:'honey',quantity:{value:10,unit:'kg' as const},reconciliation_required:false},{id:'y',name:'Lalvin ICV D47',category:'yeast',quantity:{value:25,unit:'g' as const},reconciliation_required:false},{id:'n',name:'Fermaid O',category:'additive',quantity:{value:100,unit:'g' as const},reconciliation_required:false}];
 const yeast={kind:'YEAST',name:'Lalvin ICV D47',amount:5,unit:'g'};
 assert.deepEqual(brewStockChoices(stock,yeast).map(item=>item.id),['y']);assert.equal(defaultBrewStock(brewStockChoices(stock,yeast),yeast)?.id,'y');
 const honey={kind:'INGREDIENT',name:'Honey',amount:2,unit:'lb'};
 assert.deepEqual(brewStockChoices(stock,honey).map(item=>item.id),['h']);assert.equal(defaultBrewStock(brewStockChoices(stock,honey),honey)?.id,'h');
 assert.ok(defaultBrewStock([...stock, {...stock[0],id:'other-honey',name:'Orange blossom honey'}],honey));
 assert.equal(defaultBrewStock(stock,{...yeast,name:'Other yeast'}),undefined);
 assert.deepEqual(brewStockChoices(stock,{kind:'NUTRIENT',name:'Fermaid O',amount:2,unit:'g'}).map(item=>item.id),['n']);
});
