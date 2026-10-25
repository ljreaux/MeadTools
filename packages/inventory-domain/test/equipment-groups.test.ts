import test from 'node:test';
import assert from 'node:assert/strict';
import { groupEquipment } from '../src/equipment-groups';
test('identical unnamed containers stay grouped while labels and occupancy remain independent',()=>{
 const units=Array.from({length:6},(_,index)=>({id:String(index),group_id:'buckets',label:index===0?'Blue lid':null,brew:index<2?{id:'batch'}:null}));
 const [group]=groupEquipment(units);
 assert.equal(group.total,6);assert.equal(group.available,4);assert.equal(group.units[0].label,'Blue lid');assert.equal(group.units.filter(unit=>unit.brew?.id==='batch').length,2);
 const separate=groupEquipment([...units,{...units[0],id:'other',group_id:'other-pool',brew:null}]);assert.equal(separate.length,2);
});
