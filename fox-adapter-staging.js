/* Future connector staging boundary. Deliberately NEVER authorises accounting.
   Raw device/API payloads are untrusted even when a caller labels them verified.
   No network, persistence, credentials, financial report or inverter commands. */
(function(root){
'use strict';
const node=typeof module!=='undefined'&&module.exports;
const STREAM_SOURCES=Object.freeze({
 gridImport:'octopus',gridExport:'octopus',
 genLoadSolar:'fox',solarToBatteryAc:'fox',solarStoredDc:'fox',gridStoredDc:'fox',
 batteryDischargeDc:'fox',batteryHouseDc:'fox',batteryGridDc:'fox',
 batteryHouseAc:'fox',batteryExport:'fox',solarExport:'fox',
 batteryGridCharge:'fox',batteryDischargeDC:'fox',batteryDeliveredAC:'fox',
 houseDemand:'fox',houseGrid:'fox',houseDirectSolar:'fox',houseBattery:'fox',
 forcedGridExport:'fox',evGridCharge:'ohme'
});
const fail=(reason,details={})=>({ready:false,reason,candidates:[],...details});
const finite=n=>typeof n==='number'&&Number.isFinite(n);
function stage(batch,window,now){
 if(!window||!finite(window.start)||!finite(window.end)||window.start>=window.end||
    !finite(now)||window.end>now)return fail('Completed accounting window required');
 if(!batch||typeof batch!=='object'||!Object.hasOwn(STREAM_SOURCES,batch.stream))
  return fail('Unknown or missing meter stream');
 const source=STREAM_SOURCES[batch.stream];
 if(batch.source!==source)return fail('Stream source mismatch: '+batch.stream+' requires '+source);
 if(!Array.isArray(batch.rows)||batch.rows.length===0||batch.rows.length>10000)
  return fail('No readings or excessive interval count');
 let cursor=window.start,energy=0;
 const candidates=[];
 const sorted=[...batch.rows].sort((a,b)=>a?.start-b?.start);
 for(const [index,r] of sorted.entries()){
  if(!r||!finite(r.start)||!finite(r.end)||r.end<=r.start||
    r.start!==cursor||r.end>window.end||r.end-r.start>1800000)
   return fail('Missing, overlapping or boundary-crossing intervals at row '+(index+1));
  if(r.unit!=='kWh'||!finite(r.value)||r.value<0||r.value>100)
   return fail('Invalid energy unit or value at row '+(index+1));
  if(r.quality!=='raw-device-reading'||r.origin!=='provider-api')
   return fail('Untrusted interval provenance at row '+(index+1));
  if(r.measured===true||r.verified===true||r.source&&r.source!==source)
   return fail('Incoming record attempts to assert trusted accounting provenance');
  energy+=r.value;
  if(!finite(energy)||energy>10000)return fail('Implausible energy total');
  // Not compatible with FoxRecordedData.inspect: requires measured:true.
  candidates.push(Object.freeze({start:r.start,end:r.end,value:r.value,
   source,stream:batch.stream,unit:'kWh',measured:false,verified:false,
   status:'AWAITING_INDEPENDENT_PROVENANCE_AND_RECONCILIATION'}));
  cursor=r.end;
 }
 if(cursor!==window.end)return fail('Missing readings at end of window');
 return {ready:true,reason:null,source,stream:batch.stream,intervalCount:candidates.length,
  stagedKwh:energy,candidates,accountingApproved:false,
  status:'STAGED_ONLY_NOT_ACTUAL',nextStep:'Verify provider identity, measurement point, time alignment, tariffs and independent meter reconciliation'};
}
function readiness(batches,window,now){
 if(!Array.isArray(batches))return fail('Adapter batches required');
 const byStream={};
 for(const batch of batches){
  if(batch?.stream&&Object.hasOwn(byStream,batch.stream))
   return fail('Duplicate stream batch: '+batch.stream);
  const result=stage(batch,window,now);
  if(!result.ready)return fail((batch?.stream||'Unknown stream')+': '+result.reason);
  byStream[batch.stream]=result;
 }
 const required=['gridImport','gridExport','genLoadSolar','batteryDischargeDC','batteryDeliveredAC'];
 const missing=required.filter(key=>!byStream[key]);
 return {ready:missing.length===0,reason:missing.length?'Missing staged streams: '+missing.join(', '):null,
  stagedStreams:Object.keys(byStream),missing,accountingApproved:false,
  status:'STAGED_ONLY_NOT_ACTUAL',
  nextStep:'Connect authenticated provider adapters and independently validate measurement boundaries before enabling accounting'};
}
const api={stage,readiness,STREAM_SOURCES};
if(node)module.exports=api;else root.FoxAdapterStaging=api;
})(typeof window!=='undefined'?window:globalThis);
