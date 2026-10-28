'use strict';
const assert=require('node:assert/strict');
const dates=require('./fox-actual-costs.js');
const model=require('./fox-solar-meter-reconcile.js');
const day='2026-10-26',w=dates.windowFor(day);
const interval=(i)=>({start:w.start+i*1800000,end:w.start+(i+1)*1800000});
const stream=(key)=>{
 let n=0;
 if(key==='genLoadSolar')n=.50;
 if(key==='solarToBatteryAc')n=.40;
 if(key==='solarStoredDc')n=.36;
 if(key==='batteryDischargeDc')n=.40;
 if(key==='batteryHouseDc')n=.10;
 if(key==='batteryGridDc')n=.30;
 if(key==='batteryHouseAc')n=.08;
 if(key==='batteryExport')n=.24;
 if(key==='solarExport')n=.06;
 if(key==='gridExport')n=.30;
 return Array.from({length:48},(_,i)=>({
  ...interval(i),value:i===0?n:0,source:key==='gridExport'?'octopus':'fox',measured:true,verified:true,
  ...(key==='genLoadSolar'?{measurementPoint:'third-party-solar-generation-ac'}:{}),
  ...(key==='solarToBatteryAc'?{measurementPoint:'verified-solar-to-battery-ac'}:{})
 }));
};
const input={streams:Object.fromEntries(model.REQUIRED.map(key=>[key,stream(key)])),
 tariffs:{
  export:[{...w,pence:29.8,confirmed:true}],
  directExport:[{...w,pence:12,confirmed:true}]
 },
 solarExportOpportunityIntervals:Array.from({length:48},(_,i)=>({
  ...interval(i),verified:true,directExportFeasible:true
 }))};
let r=model.fromMeters(input,w,w.end,day);
assert(r.available,r.reason);
assert.equal(r.rows.length,48);
assert(Math.abs(r.losses.batteryDischargedDcKwh-.4)<1e-8);
assert(Math.abs(r.losses.batteryDeliveredAcKwh-.32)<1e-8);
assert(Math.abs(r.losses.batteryDischargingKwh-.08)<1e-8);
assert(Math.abs(r.losses.batteryDcToAcEfficiency-.8)<1e-8);
assert(Math.abs(r.losses.meteredGridExportKwh-.30)<1e-8);
assert(Math.abs(r.rows[0].directExportRateGbpPerKwh-.12)<1e-8);
assert(Math.abs(r.rows[0].achievedExportRateGbpPerKwh-.298)<1e-8);
assert.equal(r.rows[0].solarInputAcKwh,.4);
assert.equal(r.rows[0].exportToGridAcKwh,.24);
// House draw is not mistakenly a battery-to-grid energy loss.
input.streams.batteryHouseAc[0].value=0;
r=model.fromMeters(input,w,w.end,day);
assert(r.available);
assert(Math.abs(r.losses.batteryDischargingKwh-.16)<1e-8);
input.streams.batteryHouseAc[0].value=.08;
input.streams.gridExport[0].value=.25;
assert.match(model.fromMeters(input,w,w.end,day).reason,/reconcile/);
input.streams.gridExport[0].value=.30;
input.streams.solarToBatteryAc[0].measurementPoint='gen-load';
assert.match(model.fromMeters(input,w,w.end,day).reason,/Gen Load/);
input.streams.solarToBatteryAc[0].measurementPoint='verified-solar-to-battery-ac';
input.streams.genLoadSolar[0].value=.35;
assert.match(model.fromMeters(input,w,w.end,day).reason,/Gen Load/);
input.streams.genLoadSolar[0].value=.50;
input.solarExportOpportunityIntervals[0].directExportFeasible=false;
assert.match(model.fromMeters(input,w,w.end,day).reason,/export limit|headroom/);
input.solarExportOpportunityIntervals[0].directExportFeasible=true;
input.streams.batteryDischargeDc[0].value=.5;
assert.match(model.fromMeters(input,w,w.end,day).reason,/does not reconcile/);
input.streams.batteryDischargeDc[0].value=.4;
input.streams.batteryGridDc.pop();
assert.match(model.fromMeters(input,w,w.end,day).reason,/Missing readings/);
assert.equal(model.fromMeters({},w,w.end,day).available,false);
console.log('METERED SOLAR ARBITRAGE PASS: Fox Gen Load vs actual solar charging, battery DC/house/grid separation, Octopus meter and historical 12p/29.8p prices');
