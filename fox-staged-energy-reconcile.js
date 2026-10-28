/* Future-only reconciliation of UNVERIFIED staged readings.
   This is a physical consistency precheck, NOT independent meter verification,
   not solar-origin attribution, and never an accounting or dispatch approval. */
(function(root){
'use strict';
const node=typeof module!=='undefined'&&module.exports;
const adapter=node?require('./fox-adapter-staging.js'):root.FoxAdapterStaging;
const REQUIRED=Object.freeze([
 'gridImport','gridExport','genLoadSolar','solarToBatteryAc','solarStoredDc',
 'gridStoredDc','batteryDischargeDc','batteryHouseDc','batteryGridDc',
 'batteryHouseAc','batteryExport','solarExport','batteryGridCharge',
 'evGridCharge','houseGrid'
]);
const EPS=1e-5;
const fail=(reason,extra={})=>({ready:false,reason,accountingApproved:false,
  physicalDispatchApproved:false,status:'STAGED_ONLY_NOT_ACTUAL',...extra});
function reconcile(batches,window,now){
 if(!Array.isArray(batches))return fail('Adapter batches required');
 const byStream={};
 for(const batch of batches){
  if(batch?.stream&&Object.hasOwn(byStream,batch.stream))
   return fail('Duplicate staged stream: '+batch.stream);
  const result=adapter.stage(batch,window,now);
  if(!result.ready)return fail((batch?.stream||'Unknown stream')+': '+result.reason);
  byStream[batch.stream]=result;
 }
 const missing=REQUIRED.filter(key=>!byStream[key]);
 if(missing.length)return fail('Missing independently measured paths: '+missing.join(', '),
  {missing,stagedStreams:Object.keys(byStream)});
 const base=byStream.gridExport.candidates;
 for(const key of REQUIRED){
  const rows=byStream[key].candidates;
  if(rows.length!==base.length||rows.some((r,i)=>r.start!==base[i].start||r.end!==base[i].end))
   return fail('Mismatched timestamps between '+key+' and grid export');
 }
 const violations=[];
 const totals=Object.fromEntries(REQUIRED.map(key=>[key,0]));
 let maxAverageGridExportKw=0,maxAverageGridImportKw=0;
 for(let i=0;i<base.length;i++){
  const r=Object.fromEntries(REQUIRED.map(key=>[key,byStream[key].candidates[i].value]));
  for(const key of REQUIRED)totals[key]+=r[key];
  const check=(ok,reason)=>{if(!ok)violations.push({index:i,start:base[i].start,
   end:base[i].end,reason});};
  check(r.solarToBatteryAc+r.solarExport<=r.genLoadSolar+EPS,
   'Solar battery charging plus direct solar export exceeds generation');
  check(r.solarStoredDc<=r.solarToBatteryAc+EPS,
   'Solar stored DC exceeds solar charging AC input');
  check(Math.abs(r.batteryHouseDc+r.batteryGridDc-r.batteryDischargeDc)<=EPS,
   'Battery discharge DC does not split into house and grid paths');
  check(r.batteryHouseAc<=r.batteryHouseDc+EPS,
   'Battery house AC exceeds allocated DC');
  check(r.batteryExport<=r.batteryGridDc+EPS,
   'Battery grid AC exceeds allocated DC');
  check(Math.abs(r.batteryExport+r.solarExport-r.gridExport)<=EPS,
   'Solar and battery export do not equal Octopus grid export');
  check(r.houseGrid+r.evGridCharge+r.batteryGridCharge<=r.gridImport+EPS,
   'Allocated house, EV and battery grid imports exceed Octopus import');
  // Half-hourly energy can bound AVERAGE power only; not instantaneous spikes.
  const hours=(base[i].end-base[i].start)/3600000;
  maxAverageGridExportKw=Math.max(maxAverageGridExportKw,r.gridExport/hours);
  maxAverageGridImportKw=Math.max(maxAverageGridImportKw,r.gridImport/hours);
 }
 if(violations.length)return fail('Staged energy-flow conflicts: '+violations.length,
  {violations:violations.slice(0,20),violationCount:violations.length,
   checkedIntervals:base.length,missing:[]});
 return {ready:true,reason:null,checkedIntervals:base.length,missing:[],
  accountingApproved:false,physicalDispatchApproved:false,
  status:'STAGED_CONSISTENT_NOT_VERIFIED',
  totals,maxAverageGridExportKw,maxAverageGridImportKw,
  // No inference about compliance with 3.5 kW instantaneous export or 8.3 kW import.
  instantaneousLimitVerified:false,solarOriginVerified:false,
  nextStep:'Independently validate measurement points, battery opening energy origin, utility meters, real-time power limits and tariff eligibility'};
}
const api={reconcile,REQUIRED};
if(node)module.exports=api;else root.FoxStagedEnergyReconcile=api;
})(typeof window!=='undefined'?window:globalThis);
