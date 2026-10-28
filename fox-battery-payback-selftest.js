'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const payback=require('./fox-battery-payback-core.js');
const demo=require('./fox-financial-demo-core.js').makeMonth();
const {makeMonth}=require('./fox-financial-demo-core.js');
const eq=(a,b,caption,tol=0.00008)=>assert(Math.abs(a-b)<=tol,caption+' '+a+' vs '+b);
assert.equal(payback.DEFAULT_TARGET_GBP,4800);
assert.equal(payback.analyse([],4800,'2026-10-28').available,false);
assert.equal(payback.analyse([{date:'2026-10-01',batterySavingGbp:50,verified:false}],4800,'2026-10-28').available,false);
assert.equal(payback.analyse([],0,'2026-10-28').available,false);
const verified=[...Array(75)].map((_,i)=>({
 date:new Date(Date.UTC(2026,7,1+i)).toISOString().slice(0,10),verified:true,
 batterySavingGbp:1.5,incrementalForceProfitGbp:null
}));
let state=payback.analyse(verified,4800,'2026-10-15');
assert(state.available);
assert.equal(state.completeDays,75);
eq(state.batterySavedGbp,112.5,'battery only');
assert.equal(state.netForceProfitGbp,0,'Unknown export profits not counted');
eq(state.totalBenefitGbp,state.batterySavedGbp,'Avoid gross export double count');
eq(state.remainingGbp,4687.5,'Investment balance');
assert(state.forecast.available,'Sufficient continuous history qualifies for preliminary learning trend');
assert.equal(state.forecast.kind,'preliminary trend');
assert(state.forecast.date>='2026-10-15');
assert(state.forecast.earliest<state.forecast.date);
assert(state.forecast.latest>state.forecast.date);
const withNet=verified.map((r,i)=>({...r,incrementalForceProfitGbp:i<10?.2:null}));
state=payback.analyse(withNet,4800,'2026-10-15');
eq(state.netForceProfitGbp,2,'Only verified incremental profit counts');
assert.equal(state.confirmedForceDays,10);
const sparse=verified.filter((r,i)=>i%2===0);
assert(!payback.analyse(sparse,4800,'2026-10-15').forecast.available);
assert(!payback.analyse(verified.slice(0,20),4800,'2026-10-15').forecast.available);
assert(!payback.analyse(verified,4800,'2027-01-30').forecast.available,'Stale measurements cannot make forecasts');
const losses=verified.map(r=>({...r,batterySavingGbp:-.2}));
assert(!payback.analyse(losses,4800,'2026-10-15').forecast.available,'Do not forecast profit when running loss');
const achieved=payback.analyse(verified.map(r=>({...r,batterySavingGbp:100})),4800,'2026-10-15');
assert.equal(achieved.remainingGbp,0);
assert.equal(achieved.progressPct,100);
const duplicates=[verified[0],verified[0],verified[1]];
assert.equal(payback.analyse(duplicates,4800,'2026-10-15').completeDays,2);
const validExtract=payback.extract([
 {day:'2026-10-01',savings:{available:true,batteryOnlySavingGbp:1.1,value:3.5},solarStorage:{available:true,houseSolarOpportunityGbp:.1,solarExportGainGbp:.12},forceNet:{available:false,value:null}},
 {day:'2026-10-02',savings:{available:false,batteryOnlySavingGbp:2},forceNet:{available:true,value:10}},
 {day:'2026-10-03',savings:{available:true,batteryOnlySavingGbp:-.5,value:4},solarStorage:{available:true,houseSolarOpportunityGbp:.03,solarExportGainGbp:-.05},forceNet:{available:true,value:.25,excludesSolarOrigin:true}}
]);
assert.equal(validExtract.length,2);
const overlapping=payback.extract([{day:'2026-10-04',savings:{available:true,batteryOnlySavingGbp:1},solarStorage:{available:true,houseSolarOpportunityGbp:.1,solarExportGainGbp:.15},forceNet:{available:true,value:.25}}]);
assert.equal(overlapping[0].incrementalForceProfitGbp,null,'Generic force profit cannot double count solar ROI');
eq(validExtract[0].batterySavingGbp,1.0,'Battery-only after solar house opportunity');
eq(validExtract[0].solarStorageGainGbp,.12,'Solar-origin net export arbitrage counted');
assert.equal(validExtract[0].incrementalForceProfitGbp,null);
eq(validExtract[1].incrementalForceProfitGbp,.25,'Real confirmed non-solar increment');
assert.equal(demo.days.length,31);
let monthBattery=0;
for(const d of demo.days){
 eq(d.baselineWithoutBatteryGbp-d.houseActualSupplyGbp,d.batteryOnlySavingGbp,'Battery saving identity');
 eq(d.houseSavingGbp-d.batteryOnlySavingGbp,d.houseSolarKwh*demo.params.peakImportGbp,'Direct solar removed from battery-only saving');
 monthBattery+=d.batteryOnlySavingGbp;
}
eq(demo.totals.batteryOnlySavingGbp,monthBattery,'Monthly battery-only savings');
assert(demo.totals.batteryOnlySavingGbp<demo.totals.houseSavingGbp);
const noEv=makeMonth({includeEV:false});
eq(demo.totals.batteryOnlySavingGbp,noEv.totals.batteryOnlySavingGbp,'EV exclusion');
for(const path of ['index.html','preview-v2.html']){
 const html=fs.readFileSync(path,'utf8');
 for(const file of ['fox-battery-payback-core.js','fox-battery-payback-ui.js'])
  assert(new RegExp(file.replaceAll('.','\\.')+'\\?v=[0-9]+').test(html),path+' missing '+file);
}
const ui=fs.readFileSync('fox-battery-payback-ui.js','utf8');
assert(ui.includes('£4,800'));
assert(ui.includes('foxPaybackRemaining'));
assert(ui.includes('foxPaybackDate'));
assert(!/\bFoxFinancialDemoCore\b/.test(ui));
assert(!/\brecordDay\s*\(/.test(ui));
assert(!/\blocalStorage\s*[.(\[]/.test(ui));
assert(!ui.includes('fetch('));
assert(!ui.includes('forceDischarge('));
assert(fs.readFileSync('fox-financial-demo-ui.js','utf8').includes('foxDemoMonthRemaining'));
console.log('BATTERY PAYBACK PASS: £4800 target, EV/direct solar exclusion, verified incremental only, trend data gates, confidence bands and scenario isolation');
