
'use strict';
const assert=require('node:assert/strict');
const scheduler=require('./fox-schedule-core.js');
const c={
 capacity:4,initial:4,eff:.9,min:.2,target:.8,forcedFloor:.8,
 chargeKW:5,dischargeKW:5,exportKW:3.5,refillP:7,wearP:0
};
const start=Date.parse('2026-10-28T05:30:00Z');
const slots=Array.from({length:36},(_,i)=>{
 const h=5.5+i*.5;
 return {
  utc:new Date(start+i*1800000).toISOString(),clock:h,
  solar:h>=10&&h<16?.8:0,
  house:.03,
  price:h>=16&&h<19?70:h<10?30:0,
  importP:28,cheap:false,allowExport:h<19,
  checkpoint:h===18.5
 };
});
const result=scheduler.solve(c,slots);
assert(result.ok&&result.valid&&result.reached19);
const morning=result.steps.filter(x=>x.clock<10);
const midday=result.steps.filter(x=>x.clock>=10&&x.clock<16);
const evening=result.steps.filter(x=>x.clock>=16&&x.clock<19);
assert(morning.some(x=>x.forced>0),'Export during valuable morning slots');
assert(midday.some(x=>x.solarStored>0),'Refill with surplus solar');
assert(Math.max(...midday.map(x=>x.ending))>=c.capacity-1e-7,
 'Solar refills battery to full in this fixture');
assert(evening.some(x=>x.forced>0),'Export again during higher-priced later slots');
assert(result.at19>=c.target-1e-7);
assert(result.steps.every(x=>x.ending>=c.min-1e-7));
assert(result.steps.every(x=>x.forced+x.naturalExport<=1.75+1e-7));

const holdMorning=scheduler.solve(c,slots.map(x=>({
 ...x,allowExport:x.allowExport&&x.clock>=10
})));
assert(holdMorning.ok&&holdMorning.valid);
assert(result.financial.cost<holdMorning.financial.cost-.01,
 'Morning export improves the modelled result versus holding until later');

const replay=scheduler.replay(c,slots,result.steps.map(x=>x.forced));
assert(Math.abs(replay.financial.cost-result.financial.cost)<1e-7);
console.log('SOLAR CYCLE PASS: morning export, solar refill to full, higher-price later export, reserve and financial improvement');
