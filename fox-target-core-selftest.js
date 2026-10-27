
'use strict';
const assert=require('node:assert/strict');
const target=require('./fox-target-core.js');
const overnight=require('./fox-overnight-core.js');
const now=Date.parse('2026-10-27T18:00:00Z');
const night=overnight.windowFor(now);
let d=target.decide(now,night,null);
assert(d.pending&&d.target===100);
d=target.decide(night.start,night,null);
assert(!d.pending&&d.target===100);
assert.deepEqual(target.decide(night.start+3600000,night,d),d);
assert(target.decide(night.start+120000,night,null).late);
const c={
 capacity:4,eff:.9,min:.2,target:.8,forcedFloor:.8,
 chargeKW:5,dischargeKW:5,exportKW:3.5,refillP:7,wearP:0
};
const cfg={
 evPercent:0,evCapacity:61.7,evKw:6.63,evEfficiency:90,
 gridKw:8.3,houseKw:.4,batteryKw:5,batteryEfficiency:90,
 capacity:4,soc:5,evConnect:'23:30',evDeadline:'05:30'
};
const slots=Array.from({length:35},(_,i)=>{
 const t=night.end+i*1800000;
 const h=new Date(t).getUTCHours()+new Date(t).getUTCMinutes()/60;
 return {
  utc:new Date(t).toISOString(),clock:h,
  solar:h>=10&&h<16?.8:0,house:.03,price:0,importP:28,
  cheap:false,allowExport:h<19,checkpoint:h===18.5
 };
});
const sunny=target.compare(c,slots,cfg,now);
assert(sunny.ok&&sunny.researchOnly&&sunny.activeTarget===100);
assert(sunny.best.target<100,'Leave room for abundant zero-price solar');
assert(sunny.best.at19>=20-1e-7);
assert(sunny.best.cost<sunny.full.cost);
const valuable=target.compare(c,slots.map(s=>({
 ...s,solar:0,price:50
})),cfg,now);
assert(valuable.ok);
assert.equal(valuable.best.target,100,'Cheap overnight energy can fund valuable exports');
assert.throws(()=>target.compare(c,slots.slice(1),cfg,now),/05:30/);
assert.throws(()=>target.compare(c,slots.slice(0,-1),cfg,now),/23:00/);
console.log('TARGET PASS: 23:30 record, retained fallback, solar headroom, valuable export and full-day coverage');
