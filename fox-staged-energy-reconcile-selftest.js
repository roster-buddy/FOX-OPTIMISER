'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const dates=require('./fox-actual-costs.js');
const adapter=require('./fox-adapter-staging.js');
const flow=require('./fox-staged-energy-reconcile.js');
const recorded=require('./fox-recorded-data.js');
const amounts={gridImport:.8,gridExport:.29,genLoadSolar:.5,
 solarToBatteryAc:.2,solarStoredDc:.18,gridStoredDc:.18,
 batteryDischargeDc:.3,batteryHouseDc:.2,batteryGridDc:.1,
 batteryHouseAc:.18,batteryExport:.09,solarExport:.2,
 batteryGridCharge:.2,evGridCharge:.1,houseGrid:.2};
function scenario(day){
 const window=dates.windowFor(day);
 const batches=Object.entries(amounts).map(([stream,value])=>({
  stream,source:adapter.STREAM_SOURCES[stream],
  rows:Array.from({length:(window.end-window.start)/1800000},(_,i)=>({
   start:window.start+i*1800000,end:window.start+(i+1)*1800000,
   value,unit:'kWh',quality:'raw-device-reading',origin:'provider-api'
  }))
 }));
 return {window,batches,now:window.end};
}
for(const day of ['2026-10-26','2026-10-25','2026-03-29']){
 const {window,batches,now}=scenario(day);
 const r=flow.reconcile(batches,window,now);
 assert.equal(r.ready,true,JSON.stringify(r));
 assert.equal(r.accountingApproved,false);
 assert.equal(r.physicalDispatchApproved,false);
 assert.equal(r.solarOriginVerified,false);
 assert.equal(r.instantaneousLimitVerified,false);
 assert.equal(r.checkedIntervals,(window.end-window.start)/1800000);
 assert(Math.abs(r.maxAverageGridExportKw-.58)<1e-8);
 const meter=adapter.stage(batches[0],window,now);
 assert.equal(recorded.inspect(meter.candidates,window,now).available,false);
 const mutate=(stream,value)=>{
  const copy=structuredClone(batches);
  const b=copy.find(x=>x.stream===stream);
  b.rows[0].value=value;
  return flow.reconcile(copy,window,now);
 };
 for(const [stream,value,expected] of [
  ['gridExport',.4,'export'],['solarToBatteryAc',.4,'Solar'],
  ['solarStoredDc',.3,'Solar stored'],
  ['gridStoredDc',.3,'Grid stored'],
  ['batteryHouseDc',.1,'discharge'],
  ['batteryHouseAc',.25,'house AC'],
  ['batteryExport',.2,'grid AC'],
  ['evGridCharge',.6,'grid imports']
 ]){
  const invalid=mutate(stream,value);
  assert.equal(invalid.ready,false,stream);
  assert(invalid.violations?.some(v=>v.reason.includes(expected)),stream+': '+JSON.stringify(invalid));
 }
 assert.equal(flow.reconcile(batches.slice(1),window,now).ready,false);
 assert.equal(flow.reconcile([...batches,batches[0]],window,now).ready,false);
 const broken=structuredClone(batches);
 broken[1].rows[0].start+=1;
 assert.equal(flow.reconcile(broken,window,now).ready,false);
 const forged=structuredClone(batches);
 forged[0].rows[0].verified=true;
 assert.equal(flow.reconcile(forged,window,now).ready,false);
}
const src=fs.readFileSync('fox-staged-energy-reconcile.js','utf8');
for(const forbidden of ['fetch(','localStorage','FoxActualReport','forceCharge(','forceDischarge(','measured:true','verified:true'])
 assert(!src.includes(forbidden),'Staged precheck must never authorise real accounting: '+forbidden);
for(const page of ['index.html','preview-v2.html']){
 const html=fs.readFileSync(page,'utf8');
 assert(html.includes('fox-staged-energy-reconcile.js?v=490'));
 assert(html.indexOf('fox-adapter-staging.js')<html.indexOf('fox-staged-energy-reconcile.js'));
}
console.log('STAGED ENERGY RECONCILIATION PASS: aligned energy paths, 23/24/25-hour days, conflicts, provenance and no actual promotion');
