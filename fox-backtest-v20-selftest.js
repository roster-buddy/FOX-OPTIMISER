'use strict';
const assert=require('node:assert/strict');
const engine=require('./fox-backtest-v20.js');
const c={capacity:10.24,load:.3,chargeKW:5,dischargeKW:5,exportKW:3.5,pv:2.01,inverterKW:1.5,pr:.82,eff:.95,importP:28,nightP:3.33,min:5,target:20,soc:100,derate:0,tilt:35,bearing:110,scenario:'low'};
for(const date of ['2026-10-18','2026-10-25','2026-03-29']){
 const slots=engine.slotsFor(date);
 assert.equal(slots.length,36);
 assert.equal(slots[0].clock,5.5);
 assert.equal(slots[35].clock,23);
 for(let i=1;i<slots.length;i++)assert.equal(new Date(slots[i].utc)-new Date(slots[i-1].utc),1800000);
}
const s=engine.slotsFor('2026-10-18');
const prices=s.map(z=>z.clock>=16.5&&z.clock<18.5?38:8);
const radiance=s.map(z=>z.clock>=9&&z.clock<15?.1:0);
const trial=engine.compare(c,s,radiance,prices);
assert(trial.ok,JSON.stringify(trial));
assert(trial.improvement>=-0.01,'optimiser worse');
assert(trial.optimised.audit.worst<1e-6);
assert(trial.optimised.at19/c.capacity*100>=20-1e-6);
console.log('Standard day:',trial.improvement,trial.optimised.forced,trial.optimised.at19/c.capacity*100);
const neg=engine.compare(c,s,new Array(36).fill(0),new Array(36).fill(-10));
assert(neg.ok);
assert.equal(neg.optimised.forced,0);
assert.equal(neg.improvement,0);
const cloudy=engine.compare(c,s,new Array(36).fill(0),prices);
assert(cloudy.ok);
assert(cloudy.optimised.forced>=0);
assert(cloudy.optimised.audit.worst<1e-6);
const stressed=engine.compare({...c,scenario:'spike'},s,new Array(36).fill(0),prices);
assert(stressed.ok === false || stressed.optimised.audit.worst<1e-6);
console.log('High-load stress:',stressed.ok ? 'feasible' : stressed.reason);
const infeasible=engine.compare({...c,soc:20},s,new Array(36).fill(0),prices);
assert.equal(infeasible.ok,false);
assert.equal(engine.dayShift('2026-03-01',-1),'2026-02-28');
const irr=new Map();for(const z of s){const hourEnd=Math.ceil((z.at.getTime()+900000)/3600000)*3600000;irr.set(hourEnd,400)}
assert.equal(engine.historicalSolar(s,irr,c).length,36);
assert.throws(()=>engine.historicalSolar(s,new Map(),c),/missing/);
console.log('ALL TESTS PASS');
