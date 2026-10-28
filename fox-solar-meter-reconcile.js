/* Verifies an actual 23:30-to-23:30 solar/battery/grid electricity day.
   No Gen Load -> battery shortcut: Gen Load is upstream generation; solar
   charging must be separately validated against inverter battery charging.
   All power values below are measured *energy* per matching meter interval.
   SOC delta is NOT used to infer grid export or discharge losses. */
(function(root){
'use strict';
const node=typeof module!=='undefined'&&module.exports;
const recorded=node?require('./fox-recorded-data.js'):root.FoxRecordedData;
const fail=reason=>({available:false,reason,rows:null,losses:null});
const EPS=1e-5;
const REQUIRED=[
 'genLoadSolar','solarToBatteryAc','solarStoredDc','gridStoredDc',
 'batteryDischargeDc','batteryHouseDc','batteryGridDc',
 'batteryHouseAc','batteryExport','solarExport','gridExport'
];
const kwh=r=>r.value;
function fromMeters(input,window,now,day){
 const streams=input?.streams||{},tariffs=input?.tariffs||{};
 const reads={};
 for(const key of REQUIRED){
  reads[key]=recorded.inspect(streams[key],window,now);
  if(!reads[key].available)return fail(key+': '+reads[key].reason);
 }
 const base=reads.gridExport.intervals;
 for(const key of REQUIRED.slice(0,-1)){
  const aligned=reads[key].intervals;
  if(aligned.length!==base.length||aligned.some((r,i)=>r.start!==base[i].start||r.end!==base[i].end))
   return fail(key+' does not align with the utility grid-export meter intervals');
 }
 if(!tariffs.export||!tariffs.directExport)return fail('Verified sale and direct-export alternative tariffs required');
 if(!Array.isArray(input?.solarExportOpportunityIntervals)||input.solarExportOpportunityIntervals.length!==base.length)
  return fail('Verified direct solar export feasibility and DNO headroom per interval required');
 const rows=[];
 let chargeLoss=0,dischargeLoss=0,batteryDc=0,batteryAc=0,metered=0;
 for(let i=0;i<base.length;i++){
  const r=Object.fromEntries(REQUIRED.map(k=>[k,reads[k].intervals[i]]));
  for(const key of REQUIRED)if(r[key].verified!==true)return fail(key+' has no independently verified interval provenance');
  if(r.gridExport.source!=='octopus')return fail('Utility export must be sourced from the Octopus smart meter');
  if(REQUIRED.filter(k=>k!=='gridExport').some(k=>r[k].source!=='fox'))
   return fail('Solar and battery measurements must originate from validated Fox ESS sensors');
  const origin=input.solarExportOpportunityIntervals[i];
  if(origin?.start!==r.gridExport.start||origin?.end!==r.gridExport.end||
   origin.verified!==true||(kwh(r.solarToBatteryAc)>0&&origin.directExportFeasible!==true))
   return fail('Direct export alternative at the charge time is not verified within the site export limit');
  if(r.solarToBatteryAc.measurementPoint!=='verified-solar-to-battery-ac'||
    r.genLoadSolar.measurementPoint!=='third-party-solar-generation-ac')
   return fail('Gen Load is generation, not a measured solar-to-battery charge flow');
  if(kwh(r.solarToBatteryAc)+kwh(r.solarExport)>kwh(r.genLoadSolar)+EPS)
   return fail('Solar to battery plus direct solar export exceeds measured Gen Load generation');
  if(kwh(r.solarStoredDc)>kwh(r.solarToBatteryAc)+EPS)
   return fail('Solar battery charge stored DC exceeds solar charging input');
  if(Math.abs(kwh(r.batteryHouseDc)+kwh(r.batteryGridDc)-kwh(r.batteryDischargeDc))>EPS)
   return fail('Total battery discharge does not reconcile to house and export paths');
  if(kwh(r.batteryHouseAc)>kwh(r.batteryHouseDc)+EPS||
     kwh(r.batteryExport)>kwh(r.batteryGridDc)+EPS)
   return fail('Battery AC delivered exceeds source-attributed battery DC energy');
  if(Math.abs(kwh(r.batteryExport)+kwh(r.solarExport)-kwh(r.gridExport))>EPS)
   return fail('Actual Octopus grid export must reconcile with Fox battery and solar export on the same interval');
  if(kwh(r.gridExport)>0&&kwh(r.batteryGridDc)===0&&kwh(r.batteryExport)>0)
   return fail('Cannot attribute battery grid export without battery discharge');
  const interval={start:r.gridExport.start,end:r.gridExport.end};
  const pExport=recorded.price([r.gridExport],tariffs.export,interval,now);
  const pDirect=recorded.price([r.solarToBatteryAc],tariffs.directExport,interval,now);
  if(!pExport.available||!pDirect.available)
   return fail('Unverified actual/alternative historical export rate: '+(pExport.reason||pDirect.reason));
  const match=t=>t.filter(rate=>rate.start<=interval.start&&rate.end>=interval.end);
  const exportRate=match(tariffs.export),directRate=match(tariffs.directExport);
  if(exportRate.length!==1||directRate.length!==1)
   return fail('Ambiguous export price attribution');
  const batteryChargeLoss=Math.max(0,kwh(r.solarToBatteryAc)-kwh(r.solarStoredDc));
  const batteryDischargeLoss=Math.max(0,kwh(r.batteryDischargeDc)-kwh(r.batteryHouseAc)-kwh(r.batteryExport));
  chargeLoss+=batteryChargeLoss;
  dischargeLoss+=batteryDischargeLoss;
  batteryDc+=kwh(r.batteryDischargeDc);
  batteryAc+=kwh(r.batteryHouseAc)+kwh(r.batteryExport);
  metered+=kwh(r.gridExport);
  rows.push({
   day,start:interval.start,end:interval.end,
   solarInputAcKwh:kwh(r.solarToBatteryAc),
   solarStoredDcKwh:kwh(r.solarStoredDc),
   gridStoredDcKwh:kwh(r.gridStoredDc),
   houseDischargedDcKwh:kwh(r.batteryHouseDc),
   exportDischargedDcKwh:kwh(r.batteryGridDc),
   houseDeliveredAcKwh:kwh(r.batteryHouseAc),
   exportToGridAcKwh:kwh(r.batteryExport),
   directExportRateGbpPerKwh:directRate[0].pence/100,
   achievedExportRateGbpPerKwh:exportRate[0].pence/100,
   wearGbpPerExportKwh:input?.wearGbpPerExportKwh??0,
   verified:true,exportAttributionVerified:true,
   solarInputVerified:true,directRateVerified:true,
   directExportOpportunityVerified:true,chargingOriginVerified:true
  });
 }
 return {available:true,reason:null,rows,losses:{
  batteryChargingKwh:chargeLoss,batteryDischargingKwh:dischargeLoss,
  batteryDischargedDcKwh:batteryDc,batteryDeliveredAcKwh:batteryAc,
  batteryDcToAcEfficiency:batteryDc>0?batteryAc/batteryDc:null,
  meteredGridExportKwh:metered
 },scope:'Verified intervals. Gen Load is upstream generation, battery DC-to-AC losses do not include the house. Solar charge origin is model-attributed.'};
}
const api={fromMeters,REQUIRED};
if(node)module.exports=api;else root.FoxSolarMeterReconcile=api;
})(typeof window!=='undefined'?window:globalThis);
