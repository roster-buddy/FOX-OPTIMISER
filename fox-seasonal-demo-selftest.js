'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const core=require('./fox-seasonal-demo-core.js');
const low=core.calculate('low'),mid=core.calculate('typical'),high=core.calculate('high');
assert.equal(mid.type,'SIMULATION_ONLY');
assert.equal(mid.targetGbp,4800);
assert.equal(mid.monthly.length,12);
assert.equal(mid.startingMonth,'2026-11');
assert(mid.monthly[5].solarFactor>mid.monthly[11].solarFactor,'Summer example must differ from winter');
assert(mid.monthly.some(r=>r.storedSolarGbp<0),'Negative stored-solar gain must be retained');
for(const scenario of [low,mid,high]){
 assert.equal(scenario.monthly.reduce((n,r)=>n+r.days,0),365);
 const sum=scenario.monthly.reduce((n,r)=>n+r.benefitGbp,0);
 assert(Math.abs(sum-scenario.annualBenefitGbp)<=.01,'Annual sum must match monthly rows');
 for(const r of scenario.monthly){
  assert(Math.abs(r.houseGbp+r.storedSolarGbp+r.directSolarGbp-r.benefitGbp)<=.02,
   'No hidden or double-counted gross export in monthly recovery');
  assert(r.directSolarGbp>=0);
 }
 assert(scenario.annualBenefitGbp>0);
 assert(scenario.paybackMonth>='2026-11');
 assert(scenario.monthsToPayback>0);
}
assert(high.annualBenefitGbp>low.annualBenefitGbp);
assert(high.monthsToPayback<=low.monthsToPayback);
const comparison=core.compare();
assert.equal(comparison.type,'SIMULATION_ONLY');
assert.equal(comparison.scenarios.length,3);
assert.equal(comparison.monthly.length,12);
for(let i=0;i<12;i++){
 const month=comparison.monthly[i];
 assert.equal(month.name,mid.monthly[i].name);
 assert.equal(month.low,low.monthly[i].benefitGbp);
 assert.equal(month.typical,mid.monthly[i].benefitGbp);
 assert.equal(month.high,high.monthly[i].benefitGbp);
}
assert.throws(()=>core.calculate('actual'));
const ui=fs.readFileSync('fox-seasonal-demo-ui.js','utf8');
assert(ui.includes('NOT actual Fox ESS data'));
assert(ui.includes('foxSeasonalCompareRows'));
assert(ui.includes('foxSeasonalBars'));
assert(ui.includes('foxDemoContent'),'Seasonal demo must be nested in the opt-in demonstration');
for(const file of ['fox-seasonal-demo-core.js','fox-seasonal-demo-ui.js']){
 const source=fs.readFileSync(file,'utf8');
 for(const forbidden of ['FoxCalendarPnl','FoxActualReport','localStorage','fetch(','recordDay(','forceDischarge(','forceCharge('])
  assert(!source.includes(forbidden),file+' must not touch live data or controls: '+forbidden);
}
for(const page of ['index.html','preview-v2.html']){
 const html=fs.readFileSync(page,'utf8');
 for(const script of ['fox-seasonal-demo-core.js','fox-seasonal-demo-ui.js'])
  assert(new RegExp(script.replaceAll('.','\\.')+'\\?v=[0-9]+').test(html),page+' must include '+script);
 assert(html.indexOf('fox-financial-demo-core.js')<html.indexOf('fox-seasonal-demo-core.js'));
 assert(html.indexOf('fox-seasonal-demo-core.js')<html.indexOf('fox-seasonal-demo-ui.js'));
}
console.log('SEASONAL DEMO PASS: synthetic-only seasonal sensitivities, monthly/annual totals, investment recovery and isolation');
