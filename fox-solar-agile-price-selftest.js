'use strict';
const assert=require('node:assert/strict');
const dates=require('./fox-actual-costs.js');
const meters=require('./fox-solar-meter-reconcile.js');
const ledger=require('./fox-solar-storage-ledger.js');
const day='2026-10-26',window=dates.windowFor(day);
const interval=i=>({start:window.start+i*1800000,end:window.start+(i+1)*1800000});
const amounts={
 genLoadSolar:{0:2},solarToBatteryAc:{0:2},solarStoredDc:{0:2},
 batteryDischargeDc:{1:1,2:1,3:1},batteryHouseDc:{1:1},batteryGridDc:{2:1,3:1},
 batteryHouseAc:{1:1},batteryExport:{2:.8,3:.8},solarExport:{},gridExport:{2:.8,3:.8},
 gridStoredDc:{}
};
const streams=Object.fromEntries(meters.REQUIRED.map(key=>[key,Array.from({length:48},(_,i)=>({
 ...interval(i),value:amounts[key][i]??0,source:key==='gridExport'?'octopus':'fox',
 measured:true,verified:true,...(key==='genLoadSolar'?{measurementPoint:'third-party-solar-generation-ac'}:{}),
 ...(key==='solarToBatteryAc'?{measurementPoint:'verified-solar-to-battery-ac'}:{})
}))]));
const exportRates=Array.from({length:48},(_,i)=>({
 ...interval(i),pence:i===2?29.8:i===3?8:12,confirmed:true
}));
const input={
 streams,tariffs:{export:exportRates,directExport:[{...window,pence:12,confirmed:true}]},
 wearGbpPerExportKwh:0,
 solarExportOpportunityIntervals:Array.from({length:48},(_,i)=>({
 ...interval(i),verified:true,directExportFeasible:true
 }))
};
const metered=meters.fromMeters(input,window,window.end,day);
assert(metered.available,metered.reason);
assert.equal(metered.rows.length,48);
assert.equal(metered.rows[2].achievedExportRateGbpPerKwh,.29800000000000004);
assert.equal(metered.rows[3].achievedExportRateGbpPerKwh,.08);
const held=ledger.trace(metered.rows,{verified:true,allocationMethod:ledger.RETAIN_SOLAR,
 initial:{solarDcKwh:0,gridDcKwh:9.216,solarOpportunityGbp:0,sourceHistoryVerified:true}});
assert(held.available,held.reason);
const near=(a,b,label)=>assert(Math.abs(a-b)<1e-8,label+' '+a+' != '+b);
near(held.totals.solarGridExportAcKwh,1.6,'Solar credited AC exports');
near(held.totals.solarGridRevenueGbp,.8*.298+.8*.08,'Exact measured Agile rate per slot');
near(held.totals.exportSolarOpportunityGbp,2*.12,'Solar direct-export opportunity');
near(held.totals.solarExportGainGbp,.8*.298+.8*.08-2*.12,'No daily-average profit overclaim');
input.tariffs.export[3].confirmed=false;
assert(!meters.fromMeters(input,window,window.end,day).available,
 'Missing Octopus half-hour confirmation must not be filled from other slots');
input.tariffs.export[3].confirmed=true;
input.tariffs.export[3].start+=60000;
assert(!meters.fromMeters(input,window,window.end,day).available,
 'Price that starts inside a meter interval cannot be used as if it covered the whole interval');
console.log('OCTOPUS PRICE MATCH PASS: exact UTC half-hour export meter, 29.8p and 8p distinct rates, 12p solar benchmark and missing-rate rejection');
