'use strict';
const assert=require('node:assert/strict');
const uplift=require('./fox-direct-solar-uplift.js');
const payback=require('./fox-battery-payback-core.js');
const demo=require('./fox-financial-demo-core.js');
const interval=(i,kwh,rate)=>({start:i*1800000,end:(i+1)*1800000,
 verified:true,directSolarExportVerified:true,directSolarExportKwh:kwh,
 achievedExportRateGbpPerKwh:rate,directExportRateGbpPerKwh:.12});
const sample=[interval(0,2,.298),interval(1,3,.10),interval(2,1,.12)];
const r=uplift.calculate(sample);
assert(r.available,r.reason);
assert(Math.abs(r.value-.356)<1e-10,'2kWh at 29.8p versus 12p adds 35.6p');
assert.equal(r.totalDirectSolarKwh,6);
assert.equal(uplift.calculate([interval(0,1,.10)]).value,0,'Below 12p must count zero, not a loss');
assert.equal(uplift.calculate([interval(0,1,.12)]).value,0);
assert(!uplift.calculate([{...sample[0],verified:false}]).available);
assert(!uplift.calculate([{...sample[0],directSolarExportVerified:false}]).available);
assert(!uplift.calculate([{...sample[0],achievedExportRateGbpPerKwh:NaN}]).available);
assert(!uplift.calculate([{...sample[0],directExportRateGbpPerKwh:.11}]).available);
const entries=[{date:'2026-10-28',verified:true,batterySavingGbp:2,solarStorageGainGbp:.1,
 directSolarUpliftGbp:.356,incrementalForceProfitGbp:null}];
const p=payback.analyse(entries,4800,'2026-10-28');
assert(p.available,p.reason);
assert(Math.abs(p.totalBenefitGbp-2.456)<1e-9);
assert(Math.abs(p.remainingGbp-4797.544)<1e-9);
assert.equal(p.directSolarUpliftGbp,.356);
assert(!payback.analyse([{...entries[0],directSolarUpliftGbp:-.2}],4800,'2026-10-28').available);
const report={day:'2026-10-28',savings:{available:true,batteryOnlySavingGbp:2},
 solarStorage:{available:true,houseSolarOpportunityGbp:.1,solarExportGainGbp:.05},
 directSolarUplift:{available:true,value:.356}};
assert.equal(payback.extract([report])[0].directSolarUpliftGbp,.356);
assert.equal(payback.extract([{...report,directSolarUplift:{available:false,value:null}}]).length,0);
const d=demo.makeMonth();
const sum=d.days.reduce((n,day)=>n+day.directSolarUpliftGbp,0);
assert(Math.abs(sum-d.totals.directSolarUpliftGbp)<.0001);
for(const day of d.days){
 assert(day.directSolarUpliftGbp>=0);
 assert(Math.abs(day.directSolarUpliftGbp-
  Math.round(day.solarExportKwh*Math.max(0,day.exportRateGbp-.12)*1e6)/1e6)<.000002);
 assert(Math.abs(day.batteryPaybackGainGbp-
  (day.batteryPaybackSavingGbp+day.solarStorage.solarExportGainGbp+day.directSolarUpliftGbp))<.00001);
}
console.log('DIRECT SOLAR UPLIFT PASS: verified half-hour 12p floor, no double count, payback and sample figures');
