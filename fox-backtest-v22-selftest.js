"use strict";
const assert=require('node:assert/strict');
const m=require('./fox-backtest-v22.js');
const c={capacity:10.24,load:.3,chargeKW:5,dischargeKW:5,exportKW:3.5,pv:2.01,inverterKW:1.5,pr:.82,eff:.95,importP:28,nightP:3.33,min:5,target:20,soc:100,derate:0,tilt:35,bearing:110,scenario:'low'};
const n={importKW:8.3,evKWh:13,evKW:6.6,nightHomeKW:.3,wearP:5};
assert.equal(m.version,'2.2');
for(const [date,slots] of [['2026-10-24',14],['2026-10-25',12],['2026-03-28',10]]){
 assert.equal(m.overnightSlotsFor(date).length,slots);
 for(const evKWh of [0,7,13,26]){
  const z=m.overnightCharge(c,date,.62,{...n,evKWh});
  assert(z.ok,'feasible DST test '+date+' / '+evKWh);
  assert(Math.abs(z.evDelivered-evKWh)<1e-8);
  assert(Math.abs(z.final-c.capacity)<1e-8);
  for(const step of z.rows)assert(step.gridKW<=8.3+1e-9);
 }
}
assert.deepEqual([0,1,2,3,4,5,6].map(x=>m.evForDate('2026-10-'+String(25+x).padStart(2,'0'),'mixed',13,'')),[0,12,0,12,0,12,14]);
assert.equal(m.evForDate('2026-10-25','fixed',13,''),13);
assert.equal(m.evForDate('2026-10-25','noEV',13,''),0);
assert.equal(m.evForDate('2026-10-26','custom',13,'0,4,0,9,0,4,20'),4);
assert.throws(()=>m.evForDate('2026-10-26','custom',13,'0,2,3'),/7 values/);
const slots=m.slotsFor('2026-10-18');
const hourlyMap=new Map();
for(const s of slots){hourlyMap.set(Math.ceil((s.at.getTime()+900000)/3600000)*3600000,1200)}
const solar=m.solarAudit(slots,hourlyMap,c);
assert(solar.solar.every(x=>Math.abs(x-.5*1.5)<1e-12));
assert(solar.clippedKWh>0);
assert(solar.acPeakKW<=c.inverterKW);
assert(Math.abs(solar.energy-solar.solar.reduce((a,b)=>a+b,0))<1e-8);
const clearMap=new Map([...hourlyMap].map(([k,v])=>[k,0]));
const noSun=m.solarAudit(slots,clearMap,c);
assert.equal(noSun.energy,0);
assert.equal(noSun.clippedKWh,0);
assert.throws(()=>m.solarAudit(slots,new Map(),c),/missing/);
const middaySolar=slots.map(z=>z.clock>=9&&z.clock<15?.1:0);
const prices=slots.map(z=>z.clock>=16.5&&z.clock<18.5?38:8);
const comparison=m.compare(c,slots,middaySolar,prices);
assert(comparison.ok);
const a=m.adjustedCompare(comparison,c,'2026-10-18',{...n,evKWh:0});
assert(a.ok);
assert(Math.abs(a.gross-a.net-a.wearCost)<1e-9);
assert(Math.abs(a.baseFullCost-a.optFullCost-a.net)<1e-8);
assert.equal(m.adjustedCompare(comparison,c,'2026-10-18',{...n,evKWh:60}).ok,false);
assert.equal(m.adjustedCompare(comparison,c,'2026-10-18',{...n,importKW:3}).ok,false);
assert(m.compare(c,slots,new Array(36).fill(0),new Array(36).fill(-10)).optimised.forced===0);
console.log('ALL V2.2 TESTS PASS: EV pattern selection, DST nights 10/12/14, solar inverter clipping, missing irradiance fail-closed, shared grid ceiling, wear/cost checks');
