'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('app.js','utf8');
const a=source.indexOf('function chargingPolicyV420(');
const b=source.indexOf('// Provisional data freshness policy:',a);
assert(a>=0&&b>a);
const at=Date.parse('2026-10-27T12:00:00Z'),end=at+1800000;
const c={
 window:{
  FoxScheduleCore:require('./fox-schedule-core.js'),
  FoxChargeAdapter:require('./fox-charge-adapter.js')
 },
 settings:{capacity:10,soc:50,efficiency:90,cheapImport:7,peakImport:28},
 V2:{estimatedChargeKw:5,batteryDischargeKw:5,gridExportLimitKw:3.5},
 financialWearP:0,localStorage:{getItem:()=>null},
 hour:t=>new Date(t).getUTCHours(),
 mins:t=>new Date(t).getUTCMinutes(),
 loadKwh:()=>.15,solarKwh:()=>0
};
vm.createContext(c);
vm.runInContext(source.slice(a,b),c);
const run=()=>c.simulateV2([{start:at,rate:40}],{},[.5]);
c.window.foxChargingScenarioV420={
 mode:'max',confirmed:false,
 evSchedule:[{start:at,end,kw:2}],smartWindows:[]
};
let r=run();
assert.equal(r.output[0].action,'Hold battery');
assert.equal(r.output[0].importRate,28);
assert.equal(r.output[0].socEnd,50);
assert.ok(Math.abs(r.importCost-1.15*.28)<1e-9);
c.window.foxChargingScenarioV420={
 mode:'smart',confirmed:true,
 evSchedule:[{start:at,end,kw:2}],smartWindows:[{start:at,end}]
};
r=run();
assert.equal(r.output[0].importRate,7);
assert.equal(r.output[0].action,'Cheap charge');
assert.ok(Math.abs(r.output[0].socEnd-54.5)<1e-9);
assert.ok(Math.abs(r.importCost-1.65*.07)<1e-9);
c.window.foxChargingScenarioV420.confirmed=false;
assert.throws(run,/confirmed/);
delete c.window.foxChargingScenarioV420;
r=c.simulateV2([{start:at,rate:40}],{});
assert.equal(r.output[0].evEstimate,0);
assert.ok(r.output[0].socEnd<50);
console.log('CHARGING DASHBOARD PASS: Smart/Max rates, EV protection, selected charging, eligibility rejection and clearing');
