'use strict';
const assert=require('node:assert/strict');
const ledger=require('./fox-solar-storage-ledger.js');
const close=(a,b,label,tol=1e-9)=>assert(Math.abs(a-b)<=tol,label+': '+a+' != '+b);
const start=Date.parse('2026-10-27T23:30:00Z');
const row=(i,values={})=>({
 day:'2026-10-28',start:start+i*1800000,end:start+(i+1)*1800000,
 solarInputAcKwh:0,solarStoredDcKwh:0,gridStoredDcKwh:0,
 houseDischargedDcKwh:0,exportDischargedDcKwh:0,
 houseDeliveredAcKwh:0,exportToGridAcKwh:0,
 directExportRateGbpPerKwh:.12,achievedExportRateGbpPerKwh:.298,
 wearGbpPerExportKwh:0,verified:true,
 exportAttributionVerified:true,solarInputVerified:true,directRateVerified:true,
 directExportOpportunityVerified:true,chargingOriginVerified:true,
 ...values
});
const initial={solarDcKwh:0,gridDcKwh:9.216,solarOpportunityGbp:0,sourceHistoryVerified:true};
// 10.24 kWh capacity: grid-charged to 90%, solar top-up 10%,
// house draws 10% of capacity, then battery discharges another 40% to grid.
const history=[
 row(0,{solarInputAcKwh:1.024,solarStoredDcKwh:1.024}),
 row(1,{houseDischargedDcKwh:1.024,houseDeliveredAcKwh:1.024}),
 row(2,{exportDischargedDcKwh:4.096,exportToGridAcKwh:3.2768})
];
const retained=ledger.trace(history,{verified:true,initial,allocationMethod:ledger.RETAIN_SOLAR});
assert(retained.available,retained.reason);
assert.equal(retained.allocationMethod,ledger.RETAIN_SOLAR);
close(retained.records[1].solarHouseDischargeDcKwh,0,'House draws grid-origin first');
close(retained.records[2].solarDischargeDcToGridKwh,1.024,'Solar energy retained for later export');
close(retained.records[2].solarGridExportAcKwh,.8192,'80% of solar stored energy delivered to grid');
close(retained.records[2].solarDischargeDcToGridKwh/4.096,.25,'25% of battery discharge allocated to solar');
close(retained.totals.solarGridRevenueGbp,.8192*.298,'Agile revenue on metered AC share');
close(retained.totals.exportSolarOpportunityGbp,1.024*.12,'Original 12p opportunity value');
close(retained.totals.solarExportGainGbp,.8192*.298-1.024*.12,'Incremental gain before wear');
close(retained.closing.solarDcKwh,0,'Solar origin exhausted by export');
close(retained.closing.gridDcKwh,5.12,'Grid-origin inventory remaining');
const pro=ledger.trace(history,{verified:true,initial,allocationMethod:ledger.PRO_RATA});
assert(pro.available);
assert(pro.totals.solarGridExportAcKwh<retained.totals.solarGridExportAcKwh);
assert(pro.totals.houseSolarOpportunityGbp>0,'Pro-rata scenario may assign some solar to house');
assert(!ledger.trace(history,{verified:true,initial,allocationMethod:'physical-electron-sensing'}).available);
// Two consecutive export half-hours: actual interval price, not daily average.
const halfHourly=[
 row(0,{solarInputAcKwh:2,solarStoredDcKwh:2}),
 row(1,{houseDischargedDcKwh:1,houseDeliveredAcKwh:1}),
 row(2,{exportDischargedDcKwh:1,exportToGridAcKwh:.8,achievedExportRateGbpPerKwh:.298}),
 row(3,{exportDischargedDcKwh:1,exportToGridAcKwh:.8,achievedExportRateGbpPerKwh:.08})
];
const two=ledger.trace(halfHourly,{verified:true,initial,allocationMethod:ledger.RETAIN_SOLAR});
assert(two.available,two.reason);
close(two.totals.solarGridRevenueGbp,.8*.298+.8*.08,'Each export interval uses its own selling price');
close(two.totals.exportSolarOpportunityGbp,2*.12,'Original solar direct-export value allocated once');
close(two.totals.solarExportGainGbp,.8*.298+.8*.08-2*.12,'Mixed half-hour Agile prices');
// Solar charged on a previous accounting day must carry to this export.
const prev=[{...row(0,{solarInputAcKwh:1.024,solarStoredDcKwh:1.024}),
 day:'2026-10-27',start:start-86400000,end:start-86400000+1800000},
 row(1,{exportDischargedDcKwh:1.024,exportToGridAcKwh:.8192})];
const carry=ledger.trace(prev,{verified:true,initial,allocationMethod:ledger.RETAIN_SOLAR});
assert(carry.available,carry.reason);
assert.equal(carry.days.length,2);
close(carry.days[0].solarExportGainGbp,0,'Prior-day solar charge does not pretend to earn export');
close(carry.days[1].solarExportGainGbp,.8192*.298-1.024*.12,'Original solar opportunity follows inventory');
console.log('SOLAR RETAINED PASS: 90→100→90→50 SOC scenario, 25% origin share, 80% metered export, half-hour Agile price changes and prior-day carried value');
