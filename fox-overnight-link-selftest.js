
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('app.js','utf8');
const a=source.indexOf('function overnightSocV350(');
const b=source.indexOf('function renderForecastSocV330(',a);
assert(a>=0&&b>a);
const now=Date.parse('2026-10-27T12:00:00Z');
const cutoff=Date.parse('2026-10-27T23:30:00Z');
const c={
 window:{FoxEnergyCore:require('./fox-energy-core.js')},
 settings:{capacity:10,soc:80,efficiency:90},
 V2:{estimatedChargeKw:5,batteryDischargeKw:5,gridExportLimitKw:3.5},
 lastPlan:[
  {start:now,socEnd:70},
  {start:now+1800000,socEnd:60}
 ],
 priceSource:'live',v4LastPriceCheck:now,
 forecastFreshV320:(t,n)=>Number.isFinite(t)&&t<=n&&n-t<3600000,
 solarKwh:()=>0,loadKwh:()=>.1
};
vm.createContext(c);
vm.runInContext(source.slice(a,b),c);
let result=c.overnightSocV350(now,cutoff);
assert(result.available);
assert.equal(result.tailSlots,21);
assert(Math.abs(result.soc-(60-21*.1/.9/10*100))<1e-7);
assert(result.soc<80,'Do not reuse current manual SOC at night start');
const night=require('./fox-overnight-core.js');
const cfg={
 evPercent:0,evCapacity:61.7,evKw:6.63,evEfficiency:90,
 gridKw:8.3,houseKw:.4,batteryKw:5,batteryEfficiency:90,
 capacity:10,soc:result.soc,target:100,
 evConnect:'23:30',evDeadline:'05:30'
};
const charge=night.simulate(cfg,now);
assert(Math.abs(charge.batteryNeed-(10-10*result.soc/100)/.9)<1e-7);
assert(Math.abs(charge.predictedSoc-100)<1e-7);
c.loadKwh=()=>10;
result=c.overnightSocV350(now,cutoff);
assert(result.available);
assert(Math.abs(result.soc-5)<1e-7,'Evening minimum remains 5%');
c.v4LastPriceCheck=now-3600000;
assert.equal(c.overnightSocV350(now,cutoff).available,false);
c.v4LastPriceCheck=now;
c.lastPlan[1].start+=1800000;
assert.equal(c.overnightSocV350(now,cutoff).available,false);
c.lastPlan=[];
assert.equal(c.overnightSocV350(now,cutoff).available,false);
assert.equal(c.overnightSocV350(cutoff+1800000,cutoff).available,false);
console.log('OVERNIGHT LINK PASS: predicted night-start SOC, evening self-use, 5% floor, recharge energy and unavailable-data handling');
