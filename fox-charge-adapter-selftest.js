'use strict';
const assert=require('node:assert/strict');
const adapter=require('./fox-charge-adapter.js');
const scheduler=require('./fox-schedule-core.js');
const start='2026-10-27T12:00:00Z';
const end='2026-10-27T12:30:00Z';
const base={
 utc:start,clock:12,solar:0,house:.15,
 price:30,importP:28,allowExport:true,checkpoint:true
};
const cfg={
 mode:'smart',confirmed:true,cheapP:7,peakP:28,
 gridKW:8.3,evMaxKW:11,smartWindows:[{start,end}],
 evSchedule:[{start,end,kw:7}]
};
let slot=adapter.apply(base,cfg);
assert.equal(slot.cheap,true);
assert.equal(slot.flexCharge,true);
assert.equal(slot.ev,3.5);
assert.equal(slot.allowExport,false);
assert.ok(Math.abs(slot.gridHeadroomKWh-.5)<1e-9);

slot=adapter.apply(base,{
 ...cfg,mode:'max',confirmed:false,smartWindows:[],
 evSchedule:[{
  start:'2026-10-27T12:10:00Z',
  end:'2026-10-27T12:20:00Z',kw:9
 }]
});
assert.equal(slot.importP,28);
assert.equal(slot.ev,1.5);
assert.equal(slot.gridConflict,true);
assert.equal(slot.hold,true);
assert.equal(slot.partialEVApproximation,true);

const c={
 capacity:10,initial:5,eff:.9,min:.5,target:2,
 forcedFloor:2,chargeKW:5,dischargeKW:5,exportKW:3.5,
 refillP:7,wearP:0
};
slot=adapter.apply({...base,solar:1.15},{
 ...cfg,mode:'max',confirmed:false,smartWindows:[],
 evSchedule:[{start,end,kw:2}]
});
const r=scheduler.replay(c,[slot]);
assert.ok(Math.abs(r.grid)<1e-9);
assert.ok(Math.abs(r.steps[0].naturalExport)<1e-9);
assert.ok(Math.abs(r.end-5)<1e-9);
assert.equal(r.steps[0].batteryHome,0);
console.log('CHARGE ADAPTER PASS: tariff, fixed EV energy, conservative partial-slot protection, conflicts and solar-to-EV accounting');
