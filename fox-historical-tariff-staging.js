/* Untrusted historical tariff staging for future Octopus adapters.
   This validates shape and half-hour coverage, NOT account-specific applicability.
   It NEVER promotes a rate to confirmed historical billing status. */
(function(root){
'use strict';
const node=typeof module!=='undefined'&&module.exports;
const fail=reason=>({ready:false,reason,candidates:[],accountingApproved:false});
const finite=x=>typeof x==='number'&&Number.isFinite(x);
function stage(batch,window,now){
 if(!window||!finite(window.start)||!finite(window.end)||window.start>=window.end||
    !finite(now)||window.end>now)return fail('Completed accounting window required');
 if(!batch||!['import','export'].includes(batch.direction))
  return fail('Historical import or export direction required');
 if(batch.source!=='octopus'||batch.origin!=='provider-api')
  return fail('Octopus API provenance required');
 if(typeof batch.tariffCode!=='string'||!/^[-A-Z0-9_]{5,100}$/.test(batch.tariffCode))
  return fail('Valid tariff identifier required');
 if(batch.unit!=='p/kWh'||batch.vatIncluded!==true)
  return fail('Explicit VAT-inclusive p/kWh rates required');
 if(!Array.isArray(batch.rows)||!batch.rows.length||batch.rows.length>1000)
  return fail('Historical half-hourly rates missing or excessive');
 const candidates=[];let cursor=window.start;
 const sorted=[...batch.rows].sort((a,b)=>a?.start-b?.start);
 for(const [index,r] of sorted.entries()){
  if(!r||!finite(r.start)||!finite(r.end)||r.start!==cursor||
     r.end-r.start!==1800000||r.end>window.end)
   return fail('Missing, duplicate, overlapping or non-half-hour tariff at row '+(index+1));
  if(!finite(r.pence)||r.pence< -100||r.pence>500)
   return fail('Invalid p/kWh value at row '+(index+1));
  if(r.origin!=='provider-api'||r.quality!=='historical-published-rate')
   return fail('Historical published rate provenance required at row '+(index+1));
  if(r.confirmed===true||r.accountApplicable===true||r.smartChargeConfirmed===true)
   return fail('Untrusted tariff must not claim billing or smart-charge confirmation');
  candidates.push(Object.freeze({start:r.start,end:r.end,pence:r.pence,
   direction:batch.direction,tariffCode:batch.tariffCode,source:'octopus',
   confirmed:false,accountApplicable:false,status:'AWAITING_ACCOUNT_TARIFF_AND_SMART_CHARGE_VALIDATION'}));
  cursor=r.end;
 }
 if(cursor!==window.end)return fail('Historical rate coverage incomplete');
 return {ready:true,reason:null,direction:batch.direction,tariffCode:batch.tariffCode,
  intervalCount:candidates.length,candidates,accountingApproved:false,
  status:'STAGED_ONLY_NOT_BILLING',
  nextStep:'Confirm active tariff, VAT, account-specific Intelligent Octopus smart-charge periods and import/export eligibility independently'};
}
function readiness(batches,window,now){
 if(!Array.isArray(batches))return fail('Import and export rate batches required');
 const byDirection={};
 for(const batch of batches){
  if(batch?.direction&&Object.hasOwn(byDirection,batch.direction))
   return fail('Duplicate tariff direction '+batch.direction);
  const result=stage(batch,window,now);
  if(!result.ready)return fail((batch?.direction||'Unknown tariff')+': '+result.reason);
  byDirection[batch.direction]=result;
 }
 const missing=['import','export'].filter(x=>!byDirection[x]);
 return {ready:missing.length===0,missing,reason:missing.length?
  'Missing historical '+missing.join(' and ')+' rates':null,
  accountingApproved:false,status:'STAGED_ONLY_NOT_BILLING',
  nextStep:'Confirm exact account applicability and Intelligent Octopus smart-charge rates before actual accounting'};
}
const api={stage,readiness};
if(node)module.exports=api;else root.FoxHistoricalTariffStaging=api;
})(typeof window!=='undefined'?window:globalThis);
