'use strict';
// Synthetic forecasts only: no measured learning data or hardware commands.
const assert=require('node:assert/strict');
const scheduler=require('./fox-schedule-core.js');
const adapter=require('./fox-charge-adapter.js');
const config={
 capacity:9,initial:7.2,eff:.9,min:.45,target:1.8,forcedFloor:1.8,
 chargeKW:5,dischargeKW:5,exportKW:3.5,refillP:7,wearP:0
};
const policy={
 mode:'unknown',confirmed:false,evSchedule:[],smartWindows:[],
 cheapP:7,peakP:28,gridKW:8.3,evMaxKW:6.63
};
const start=Date.parse('2026-10-28T12:00:00Z');
const raw=Array.from({length:14},(_,i)=>{
 const clock=12+i*.5;
 return {
  utc:new Date(start+i*1800000).toISOString(),clock,
  solar:clock<16?.35:0,house:.15,
  price:clock>=16?50:10,allowExport:true,checkpoint:i===13
 };
});
const inputs=(slots,p=policy)=>slots.map(s=>adapter.apply(s,p));
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,a+' != '+b);
function checked(c,slots){
 const result=scheduler.solve(c,slots);
 assert.ok(result.ok&&result.valid&&result.reached19);
 assert.ok(result.at19>=c.target-1e-7);
 for(const step of result.steps){
  assert.ok(step.ending>=c.min-1e-7&&step.ending<=c.capacity+1e-7);
  assert.ok(step.forced+step.naturalExport<=c.exportKW*.5+1e-7);
  if(step.hold)near(step.forced,0);
 }
 const replay=scheduler.replay(c,slots,
  result.steps.map(s=>s.forced),result.steps.map(s=>s.chargeGrid));
 near(replay.end,result.end);
 near(replay.financial.cost,result.financial.cost);
 return result;
}
const baseline=checked(config,inputs(raw));
assert.ok(baseline.forced>0);
const cloudy=checked(config,inputs(raw.map(s=>({...s,solar:0}))));
assert.ok(cloudy.forced<baseline.forced-.1,
 'Removing forecast solar reduces the affordable export budget');
const busy=checked(config,inputs(raw.map(s=>({...s,house:.3}))));
assert.ok(busy.forced<baseline.forced-.1,
 'Higher household demand reduces forced battery exports');

// Revise only the unelapsed part of the day, starting at the prior simulated state.
const cut=6;
const revisedConfig={...config,initial:baseline.steps[cut-1].ending};
const revisedSlots=inputs(raw.slice(cut).map(s=>({...s,solar:0,house:.35})));
const revised=checked(revisedConfig,revisedSlots);
const previousTailExport=baseline.steps.slice(cut).reduce((n,s)=>n+s.forced,0);
assert.ok(revised.forced<previousTailExport-.1,
 'Midday replanning reduces remaining exports after worsening forecasts');

const evStart=Date.parse('2026-10-28T16:00:00Z');
const evEnd=evStart+3600000;
const evSlots=inputs(raw,{...policy,mode:'max',evSchedule:[
 {start:evStart,end:evEnd,kw:5}
]});
const ev=checked(config,evSlots);
const protectedSteps=ev.steps.filter(s=>{
 const t=Date.parse(s.utc);return t>=evStart&&t<evEnd;
});
assert.equal(protectedSteps.length,2);
near(protectedSteps.reduce((n,s)=>n+s.ev,0),5);
assert.ok(protectedSteps.every(s=>s.hold&&s.forced===0),
 'Unexpected supplied EV demand holds the battery during both intervals');
assert.ok(protectedSteps.every(s=>s.importP===28),
 'Max charging does not invent extra cheap import entitlement');

const conflict=inputs(raw,{...policy,evMaxKW:12,evSchedule:[
 {start:evStart,end:evEnd,kw:10}
]});
assert.ok(conflict.some(s=>s.gridConflict));
assert.equal(scheduler.solve(config,conflict).ok,false,
 'Demand beyond the shared import ceiling must not produce a valid plan');

const extreme=inputs(raw.map(s=>({...s,solar:0,house:.8})));
const impossible=scheduler.solve(config,extreme);
assert.equal(impossible.ok,false,
 'A physically unreachable reserve must be reported as infeasible');
console.log('STRESS PASS: lower solar, higher demand, midday replan, unexpected EV, import conflict and unreachable reserve');
