'use strict';
const assert=require('node:assert/strict');
const core=require('./fox-solar-choice-core.js');
const scenario=(overrides={})=>({
 source:'simulation',solarKwh:1.024,directRateGbp:.12,laterRateGbp:.298,
 houseAvoidedImportRateGbp:.233,chargeEfficiency:.94,dischargeEfficiency:.92,
 wearGbpPerAcKwh:.05,batteryFreeKwh:2,gridExportHeadroomKw:3.5,
 laterSlotHours:.5,batteryDischargeHeadroomKwh:3,
 protectedReserveKwh:2,projectedSocAt19Kwh:2,
 directExportFeasible:true,priceTimeAligned:true,reserveForecastVerified:true,
 houseValueVerified:true,laterExportForecastAvailable:true,
 houseDemandForecastAvailable:true,houseNeedKwh:2,...overrides
});
const near=(a,b)=>assert(Math.abs(a-b)<1e-9,a+' != '+b);
const best=core.compare(scenario());
assert(best.available,best.reason);
assert.equal(best.bestId,'store-export','29.8p later should beat 12p now and 23.3p house in this demo');
near(best.options[0].valueGbp,1.024*.12);
near(best.options[2].valueGbp,1.024*.94*.92*(.298-.05));
near(best.incrementalVsImmediateGbp,best.options[2].valueGbp-best.options[0].valueGbp);
const weak=core.compare(scenario({laterRateGbp:.13,houseAvoidedImportRateGbp:.10}));
assert.equal(weak.bestId,'export-now','Avoid losing money by storing solar at low later export prices');
const house=core.compare(scenario({laterRateGbp:.13,houseAvoidedImportRateGbp:.35}));
assert.equal(house.bestId,'store-house','Home avoided-import value may beat exports');
const reserve=core.compare(scenario({projectedSocAt19Kwh:1.99}));
assert.equal(reserve.bestId,'export-now','Protected 19:00 reserve blocks all battery uses');
assert.equal(reserve.options[2].feasible,false);
assert.equal(reserve.options[1].feasible,false);
const limit=core.compare(scenario({gridExportHeadroomKw:.1,houseAvoidedImportRateGbp:.10}));
assert.equal(limit.bestId,'export-now','DNO instantaneous headroom blocks battery export');
assert.match(limit.options[2].reason,/instantaneous/);
const capacity=core.compare(scenario({batteryFreeKwh:.2}));
assert.equal(capacity.bestId,'export-now');
assert(!core.compare(scenario({priceTimeAligned:false})).available);
assert(!core.compare(scenario({directExportFeasible:false})).available);
assert(!core.compare(scenario({reserveForecastVerified:false})).available);
assert(!core.compare(scenario({houseValueVerified:false})).available);
assert(!core.compare(scenario({source:'unverified-actual'})).available);
assert(!core.compare(scenario({solarKwh:0})).available);
assert(!core.compare(scenario({laterRateGbp:NaN})).available);
assert(!core.compare(scenario({chargeEfficiency:1.1})).available);
assert(!core.compare(scenario({laterSlotHours:0})).available);
console.log('SOLAR CHOICE ADVISER PASS: compare 12p direct vs later Agile vs house, avoid losses, reserve, DNO headroom, missing forecast and no live controls');
