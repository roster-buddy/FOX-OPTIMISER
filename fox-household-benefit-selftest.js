'use strict';
const assert=require('node:assert/strict');
const dates=require('./fox-actual-costs.js');
const model=require('./fox-household-benefit.js');
const report=require('./fox-actual-report.js');
const window=dates.windowFor('2026-10-26');
const count=(window.end-window.start)/1800000;
const stream=(source,value,house=false,forced=false)=>Array.from({length:count},(_,i)=>({
 start:window.start+i*1800000,end:window.start+(i+1)*1800000,
 source,measured:true,value,
 ...(house?{scope:'house-only',excludesEV:true}:{}),
 ...(forced?{attribution:'verified-grid-export'}:{})
}));
const rate=(pence,extra={})=>[{...window,pence,confirmed:true,...extra}];
const input={streams:{
 houseDemand:stream('fox',1,true),houseGrid:stream('fox',.2,true),
 houseDirectSolar:stream('fox',.3,true),houseBattery:stream('fox',.5,true),
 gridImport:stream('octopus',.5),gridExport:stream('octopus',.3),
 batteryExport:stream('fox',.2),forcedGridExport:stream('fox',.1,false,true)
},tariffs:{
 import:rate(20),export:rate(25),
 houseBatteryDeliveredCost:rate(5,{basis:'verified-storage-lot-ledger'})
}};
let calc=model.build(window,input,window.end);
assert(calc.savings.available);
assert(Math.abs(calc.savings.baselineCost-9.60)<1e-10);
assert(Math.abs(calc.savings.actualCost-3.12)<1e-10);
assert(Math.abs(calc.savings.value-6.48)<1e-10);
assert.equal(calc.savings.houseKwh,48);
assert.equal(calc.savings.batteryKwh,24);
assert(calc.forceExport.available);
assert(Math.abs(calc.forceExport.value-1.20)<1e-10);
assert.equal(calc.forceExport.total,4.8);
assert.equal(calc.forceNet.value,null,'Gross force revenue is not incremental profit');
assert.equal(calc.economicSavings.value,null,'Solar export opportunity is separate');
const r=report.build('2026-10-26',input,window.end);
assert.equal(r.savings.available,true);
assert.equal(r.forceExport.available,true);
assert.match(report.csv(r),/forceExport/);
assert.match(report.csv(r),/savings/);
// A day with absolutely no battery dispatch still has valid zero bill savings.
const direct={streams:{...input.streams,
 houseDemand:stream('fox',.2,true),houseGrid:stream('fox',.2,true),
 houseDirectSolar:stream('fox',0,true),houseBattery:stream('fox',0,true)
},tariffs:{...input.tariffs,houseBatteryDeliveredCost:undefined}};
assert.equal(model.parts(direct,window,window.end).value,0);
input.streams.houseDemand=stream('fox',2,true);
assert.match(model.parts(input,window,window.end).reason,/reconcile/);
input.streams.houseDemand=stream('fox',1,true);
input.streams.houseGrid[3].excludesEV=false;
assert.match(model.parts(input,window,window.end).reason,/excluding EV/);
input.streams.houseGrid[3].excludesEV=true;
delete input.tariffs.houseBatteryDeliveredCost[0].basis;
assert.match(model.parts(input,window,window.end).reason,/carried-battery/);
input.tariffs.houseBatteryDeliveredCost[0].basis='verified-storage-lot-ledger';
input.streams.forcedGridExport[0].value=.4;
assert.match(model.forced(input,window,window.end).reason,/attribution/);
input.streams.forcedGridExport[0].value=.1;
delete input.streams.forcedGridExport[0].attribution;
assert.match(model.forced(input,window,window.end).reason,/attribution/);
assert.equal(model.build(window,{},window.end).forceExport.value,null);
assert.equal(model.build(window,{},window.end).savings.value,null);
assert.equal(model.parts(input,window,window.end-1).value,null,'Incomplete periods cannot report savings');
console.log('HOUSE BENEFIT PASS: house-only/EV isolation, lot-based cost, forced-export attribution, missing-readings gates and no double-counting');
