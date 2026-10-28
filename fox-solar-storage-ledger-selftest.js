'use strict';
const assert=require('node:assert/strict');
const ledger=require('./fox-solar-storage-ledger.js');
const approx=(value,want,what)=>assert(Math.abs(value-want)<0.000002,what+' '+value+' != '+want);
const solarOne={
 day:'2026-10-28',solarInputAcKwh:1.1,
 solarStoredDcKwh:1.024,gridStoredDcKwh:0,
 houseDischargedDcKwh:0,exportDischargedDcKwh:5.12,
 houseDeliveredAcKwh:0,exportToGridAcKwh:4.7,
 directExportRateGbpPerKwh:0.12,achievedExportRateGbpPerKwh:0.25,
 wearGbpPerExportKwh:0.05,verified:true,
 exportAttributionVerified:true,solarInputVerified:true,directRateVerified:true,
 directExportOpportunityVerified:true,chargingOriginVerified:true
};
let res=ledger.trace([solarOne],{simulation:true,initial:{
 solarDcKwh:0,gridDcKwh:9.216,solarOpportunityGbp:0
}});
assert(res.available,res.reason);
const d=res.days[0];
// A 90% grid-origin battery filled with 10% solar isn't a 100% solar battery.
approx(d.solarDischargeDcToGridKwh,.512,'10% solar of 5.12 DC');
approx(d.solarGridExportAcKwh,.47,'solar attributable share of metered export');
approx(d.solarGridRevenueGbp,.1175,'gross solar origin revenue');
approx(d.exportSolarOpportunityGbp,.066,'allocate half initial 1.1 kWh @12p opportunity');
approx(d.solarExportWearGbp,.0235,'wear applies only to solar-attributed AC grid export');
approx(d.solarExportGainBeforeWearGbp,.0515,'gain after forgone direct export');
approx(d.solarExportGainGbp,.028,'after wear');
approx(d.solarChargeLossKwh,.076,'solar charge loss');
approx(d.solarExportDischargeLossKwh,.042,'solar attributed DC-to-grid difference');
approx(res.closing.solarDcKwh,.512,'solar left in store');
approx(res.closing.solarOpportunityGbp,.066,'remaining 12p opportunity cost carried forward');
approx(res.closing.gridDcKwh,4.608,'grid origin left in store');
assert.equal(d.provenance,'SIMULATED');
// Next day, discharge remaining stored solar and carry yesterday's opportunity.
const day2={...solarOne,day:'2026-10-29',solarInputAcKwh:0,solarStoredDcKwh:0,
 exportDischargedDcKwh:5.12,exportToGridAcKwh:4.7};
res=ledger.trace([solarOne,day2],{simulation:true,initial:{solarDcKwh:0,gridDcKwh:9.216,solarOpportunityGbp:0}});
assert(res.available,res.reason);
approx(res.totals.solarGridExportAcKwh,.94,'solar originated export total across days');
approx(res.totals.exportSolarOpportunityGbp,.132,'whole 1.1 kWh direct export alternative allocated after full output');
approx(res.closing.solarDcKwh,0,'solar emptied');
approx(res.closing.solarOpportunityGbp,0,'no double-count of foregone solar');
// Solar used by the house must diminish house savings, not claim to have been grid exported.
const house={...solarOne,houseDischargedDcKwh:5.12,houseDeliveredAcKwh:4.7,
 exportDischargedDcKwh:0,exportToGridAcKwh:0};
res=ledger.trace([house],{simulation:true,initial:{solarDcKwh:0,gridDcKwh:9.216,solarOpportunityGbp:0}});
assert(res.available,res.reason);
approx(res.totals.solarGridRevenueGbp,0,'No solar export when house consumed it');
approx(res.totals.houseSolarOpportunityGbp,.066,'House solar opportunity deducted from payback');
// Fail closed without verified source and export provenance; SOC alone is not enough.
assert(!ledger.trace([solarOne],{}).available,'No actual sensor verification: no ROI');
assert(!ledger.trace([{...solarOne,exportAttributionVerified:false}],{verified:true,initial:{
 solarDcKwh:0,gridDcKwh:9.216,solarOpportunityGbp:0}}).available);
assert(!ledger.trace([{...solarOne,directExportOpportunityVerified:false}],{verified:true,initial:{
 solarDcKwh:0,gridDcKwh:9.216,solarOpportunityGbp:0}}).available,'Do not invent 12p export availability when solar would have been curtailed');
assert(ledger.trace([solarOne],{verified:true,initial:{solarDcKwh:0,gridDcKwh:9.216,solarOpportunityGbp:0}}).available);
assert(!ledger.trace([{...solarOne,exportToGridAcKwh:5.2}],{simulation:true,initial:{
 solarDcKwh:0,gridDcKwh:9.216,solarOpportunityGbp:0}}).available);
assert(!ledger.trace([{...solarOne,solarStoredDcKwh:2}],{simulation:true,initial:{
 solarDcKwh:0,gridDcKwh:9.216,solarOpportunityGbp:0}}).available);
assert(!ledger.trace([day2],{simulation:true,initial:{
 solarDcKwh:0,gridDcKwh:0,solarOpportunityGbp:0}}).available);
assert(!ledger.trace([solarOne],{verified:true,initial:{
 solarDcKwh:.5,gridDcKwh:8.7,solarOpportunityGbp:.06}}).available,
 'Historic opening solar origin must be independently supported');

// Separate conditional calculation: if ALL of 1.024 kWh originated from solar,
// and exactly 80% is metered into the grid, the extra over immediate 12p
// direct export is 12.12416 pence. This does NOT follow from SOC alone.
const solarOnly={...solarOne,solarInputAcKwh:1.024,solarStoredDcKwh:1.024,
 exportDischargedDcKwh:1.024,exportToGridAcKwh:.8192,
 directExportRateGbpPerKwh:.12,achievedExportRateGbpPerKwh:.298,
 wearGbpPerExportKwh:0};
const example=ledger.trace([solarOnly],{simulation:true,
 initial:{solarDcKwh:0,gridDcKwh:0,solarOpportunityGbp:0}});
assert(example.available,example.reason);
approx(example.totals.solarGridRevenueGbp,.8192*.298,'Example paid export');
approx(example.totals.exportSolarOpportunityGbp,1.024*.12,'Example direct export alternative');
approx(example.totals.solarExportGainGbp,.1212416,'Exact extra profit pounds before wear');

console.log('SOLAR STORAGE ROI PASS: 90->100->50% attribution, 12p foregone export, both losses, carryover and missing-data gates');
