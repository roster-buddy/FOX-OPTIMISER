'use strict';
const assert=require('node:assert/strict');
const dates=require('./fox-actual-costs.js');
const moduleUnderTest=require('./fox-discharge-flow.js');
const report=require('./fox-actual-report.js');
const w=dates.windowFor('2026-10-26'),n=(w.end-w.start)/1800000;
const stream=(value,measurementPoint,extra={})=>Array.from({length:n},(_,i)=>({
 start:w.start+i*1800000,end:w.start+(i+1)*1800000,
 value,source:'fox',measured:true,verified:true,measurementPoint,...extra
}));
const input={streams:{
 batteryDischargeDC:stream(.25,'battery-dc-output'),
 batteryDeliveredAC:stream(.23,'battery-inverter-ac-output',{attribution:'battery-only'}),
 // Deliberately do not include any grid readings: inverter energy is a separate measurement.
}};
let result=moduleUnderTest.calculate(input,w,w.end);
assert(result.available,'Complete verified DC and AC streams should be comparable');
assert(Math.abs(result.dcKwh-12)<1e-10);
assert(Math.abs(result.acKwh-11.04)<1e-10);
assert(Math.abs(result.lossKwh-.96)<1e-10);
assert(Math.abs(result.efficiencyPct-92)<1e-10);
assert.equal(result.scope.includes('Does not determine billable grid export'),true);
let r=report.build('2026-10-26',input,w.end);
assert.equal(r.dischargeFlow.available,true);
assert.equal(r.forceExport.available,false,'No grid meter means no paid force export even when battery discharges');
let csv=report.csv({...r,gridImport:{available:true,total:1,cost:1}});
assert.match(csv,/batteryDischargeDC/);
assert.match(csv,/batteryDeliveredAC/);
assert.match(csv,/batteryDCtoACDifference/);
assert(!csv.includes('"batteryDCtoACDifference","0.96","0.96"'),'Loss is energy, not cash');
input.streams.batteryDeliveredAC[2].value=.30;
assert.match(moduleUnderTest.calculate(input,w,w.end).reason,/AC output exceeds DC/);
input.streams.batteryDeliveredAC[2].value=.23;
input.streams.batteryDeliveredAC[2].attribution='solar-plus-battery';
assert.match(moduleUnderTest.calculate(input,w,w.end).reason,/battery-only AC/);
input.streams.batteryDeliveredAC[2].attribution='battery-only';
input.streams.batteryDischargeDC[2].verified=false;
assert.match(moduleUnderTest.calculate(input,w,w.end).reason,/Verified Fox ESS/);
input.streams.batteryDischargeDC[2].verified=true;
input.streams.batteryDeliveredAC.pop();
assert.match(moduleUnderTest.calculate(input,w,w.end).reason,/Missing readings/);
assert.equal(moduleUnderTest.calculate(input,w,w.end-1).available,false);
assert.equal(moduleUnderTest.calculate({},w,w.end).available,false);
const zero={streams:{
 batteryDischargeDC:stream(0,'battery-dc-output'),
 batteryDeliveredAC:stream(0,'battery-inverter-ac-output',{attribution:'battery-only'})
}};
result=moduleUnderTest.calculate(zero,w,w.end);
assert(result.available);
assert.equal(result.lossKwh,0);
assert.equal(result.efficiencyPct,null,'No energy means no defined discharge efficiency');
console.log('DISCHARGE FLOW PASS: measured DC/AC loss, boundaries, solar attribution, incomplete days, zero and independent meter revenue');
