'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const engine=require('./fox-financial-demo-core.js');
const eq=(a,b,label,tol=.00002)=>assert(Math.abs(a-b)<=tol,label+': '+a+' ≠ '+b);
const demo=engine.makeMonth();
const again=engine.makeMonth();
const noEV=engine.makeMonth({includeEV:false});
assert.equal(demo.type,'SIMULATION_ONLY');
assert.equal(demo.month,'2026-10');
assert.equal(demo.days.length,31);
assert.deepEqual(demo,again,'Same month always generates the same hypothetical ledger');
assert(demo.days.some(d=>d.evGridKwh>0));
assert(demo.days.some(d=>d.evGridKwh===0));
let prev=null;
for(const [index,d] of demo.days.entries()){
 assert.equal(d.date,'2026-10-'+String(index+1).padStart(2,'0'));
 assert(d.houseDemandKwh>0 && d.solarGeneratedKwh>0 && d.forceGridExportKwh>0);
 eq(d.houseDemandKwh,d.houseGridKwh+d.houseSolarKwh+d.houseBatteryKwh,'House energy balance');
 eq(d.houseNightKwh+d.houseDayKwh,d.houseDemandKwh,'Total demand');
 eq(d.solarGeneratedKwh,d.houseSolarKwh+d.solarBatteryInputKwh+d.solarExportKwh,'Solar routing');
 eq(d.batteryDcDischargeKwh-d.batteryAcDeliveredKwh,d.batteryDischargeLossKwh,'Discharge losses');
 eq(d.chargeInputKwh*(1-demo.params.chargeEfficiency),d.batteryChargeLossKwh,'Charging losses');
 eq(d.openingStoredKwh+d.chargeInputKwh*demo.params.chargeEfficiency-d.batteryDcDischargeKwh,d.closingStoredKwh,'Battery DC inventory');
 eq(d.openingStoredCostGbp+d.gridBatteryChargeCostGbp-d.houseBatteryCostGbp-d.forceBatteryCostGbp,d.closingStoredCostGbp,'Stored purchased cost carryover',.00003);
 eq(d.meteredGridExportKwh,d.forceGridExportKwh+d.solarExportKwh,'Metered export sources');
 eq(d.gridImportKwh,d.houseGridKwh+d.batteryGridChargeKwh+d.evGridKwh,'Grid meter source totals');
 eq(d.houseBaselineGbp-d.houseActualSupplyGbp,d.houseSavingGbp,'House bill savings');
 eq(d.houseActualSupplyGbp,d.houseGridCostGbp+d.houseBatteryCostGbp,'House supply cost');
 eq(d.forcedExportReceiptsGbp,d.forceGridExportKwh*d.exportRateGbp,'Actual paid force revenue is synthetic ONLY');
 eq(d.totalExportReceiptsGbp,d.solarExportReceiptsGbp+d.forcedExportReceiptsGbp,'Gross export included once');
 eq(d.netGridCashGbp,d.totalExportReceiptsGbp-d.totalGridImportCostGbp,'Total grid cash');
 eq(d.forceMarginBeforeAlternativeGbp,d.forcedExportReceiptsGbp-d.forceBatteryCostGbp-d.forceWearGbp,'Force margin before opportunity');
 assert(d.openingStoredKwh>0 && d.closingStoredKwh>=0 && d.closingStoredKwh<=demo.params.capacityKwh);
 assert(d.closingStoredCostGbp>=0);
 const noEvDay=noEV.days[index];
 eq(d.houseSavingGbp,noEvDay.houseSavingGbp,'EV excluded from house saving',1e-10);
 eq(d.houseActualSupplyGbp,noEvDay.houseActualSupplyGbp,'EV excluded from house supply',1e-10);
 eq(d.forcedExportReceiptsGbp,noEvDay.forcedExportReceiptsGbp,'EV excluded from forced export',1e-10);
 eq(d.netGridCashGbp+ d.evImportCostGbp,noEvDay.netGridCashGbp,'EV correctly appears in grid cash');
 eq(noEvDay.evGridKwh,0,'EV off');
 if(prev){
  eq(prev.closingStoredKwh,d.openingStoredKwh,'Battery energy carried between days');
  eq(prev.closingStoredCostGbp,d.openingStoredCostGbp,'Stored purchase cost carried between days');
 }
 prev=d;
}
for(const key of engine.KEYS){
 eq(demo.totals[key],demo.days.reduce((n,d)=>n+d[key],0),'Month '+key,.0001);
}
assert(demo.totals.houseSavingGbp>0);
assert(demo.totals.forcedExportReceiptsGbp>0);
assert(demo.totals.batteryChargeLossKwh>0);
assert(demo.totals.batteryDischargeLossKwh>0);
assert(demo.totals.evImportCostGbp>0);
const ui=fs.readFileSync('fox-financial-demo-ui.js','utf8');
const core=fs.readFileSync('fox-financial-demo-core.js','utf8');
assert(ui.includes('DEMO · SIMULATED DATA ONLY'));
assert(ui.includes('SAMPLE DATA — NOT ACTUAL FINANCIAL RESULTS'));
assert(ui.includes('Open sample figures'));
assert(ui.includes('foxDemoIncludeEV'));
assert(ui.includes('content.hidden=!content.hidden'));
assert(ui.includes('foregone solar export') || ui.includes('foregone alternatives') || ui.includes('foregone solar export'));
assert(!ui.includes('FoxCalendarPnl') && !ui.includes('FoxActualReport'));
for(const source of [ui,core]){
 assert(!/\blocalStorage\s*[.\[]/.test(source), 'No browser persisted demo data');
 assert(!source.includes('fetch('), 'No network calls in the demo');
 assert(!source.includes('recordDay('), 'No synthetic readings enter actual calendar');
 assert(!source.includes('forceCharge(') && !source.includes('forceDischarge('));
}
for(const file of ['index.html','preview-v2.html']){
 const html=fs.readFileSync(file,'utf8');
 assert(/fox-financial-demo-core\.js\?v=[0-9]+/.test(html));
 assert(/fox-financial-demo-ui\.js\?v=[0-9]+/.test(html));
 assert(html.indexOf('fox-actual-costs.js')<html.indexOf('fox-financial-demo-ui.js'));
 assert(html.indexOf('fox-financial-demo-core.js')<html.indexOf('fox-financial-demo-ui.js'));
}
console.log('FINANCIAL DEMO PASS: 31 sample days, battery charge/discharge losses, carried costs, solar flows, export receipts, EV exclusion, cash and strict actual-data isolation');
