/* Pre-hardware connector health diagnostics. Pure and READ-ONLY.
   A green diagnostic is never permission to dispatch battery commands.
   No API secrets, network, storage, command paths or automatic retries. */
(function(root){
'use strict';
const node=typeof module!=='undefined'&&module.exports;
const REQUIRED=Object.freeze(['homeAssistant','foxEss','octopus','ohme']);
const LIVE=Object.freeze(['homeAssistant','foxEss']);
const MAX_AGE_MS=Object.freeze({homeAssistant:120000,foxEss:120000,octopus:3600000,ohme:900000});
const finite=n=>typeof n==='number'&&Number.isFinite(n);
function inspect(input,now){
 const failures=[],warnings=[],sources={};
 const add=(source,message)=>failures.push(source+': '+message);
 if(!finite(now)||now<0){
  return {ready:false,status:'INVALID_CLOCK',failures:['Invalid current clock'],
   warnings:[],sources:{},accountingApproved:false,dispatchApproved:false,
   nextStep:'Restore trustworthy time and connection state'};
 }
 if(!input||typeof input!=='object'||Array.isArray(input))
  return {ready:false,status:'NO_CONNECTIONS',failures:['No connector status supplied'],
   warnings:[],sources:{},accountingApproved:false,dispatchApproved:false,
   nextStep:'Install and configure hardware and authenticated integrations'};
 for(const key of REQUIRED){
  const c=input[key];
  if(!c||typeof c!=='object'||Array.isArray(c)){
   add(key,'not configured');sources[key]={status:'NOT_CONFIGURED'};continue;
  }
  // Only boolean connection metadata is accepted; never accept credentials
  // or arbitrary claims of independently verified measurement provenance.
  if(c.configured!==true){add(key,'not configured');sources[key]={status:'NOT_CONFIGURED'};continue;}
  if(c.authenticated!==true){add(key,'authentication not confirmed');sources[key]={status:'AUTH_REQUIRED'};continue;}
  if(c.connected!==true){add(key,'connection unavailable');sources[key]={status:'DISCONNECTED'};continue;}
  if(c.error===true){add(key,'connector error');sources[key]={status:'ERROR'};continue;}
  if(!finite(c.lastSeenAt)||c.lastSeenAt<0||c.lastSeenAt>now){
   add(key,'missing or future-dated heartbeat');sources[key]={status:'INVALID_HEARTBEAT'};continue;
  }
  const ageMs=now-c.lastSeenAt;
  if(ageMs>MAX_AGE_MS[key]){
   add(key,'stale heartbeat');sources[key]={status:'STALE',ageMs};continue;
  }
  sources[key]={status:'RESPONDING',ageMs};
 }
 if(input.clockSynchronized!==true)add('system','clock synchronisation not independently confirmed');
 if(input.readOnlyMode!==true)add('system','read-only safety mode not confirmed');
 if(input.tariffEligibilityConfirmed!==true)
  add('octopus','account tariff and smart-charge eligibility not confirmed');
 if(input.meterPointsValidated!==true)
  add('meter','measurement points and CT polarity not validated');
 if(input.socSourceValidated!==true)
  add('foxEss','SOC source not independently validated');
 if(input.instantaneousLimitsValidated!==true)
  add('safety','3.5 kW export and 8.3 kW provisional import power limits not independently validated');
 if(input.siteExportCapKw!==3.5)
  add('safety','site export limit must match 3.5 kW DNO restriction');
 if(input.operatorCommissioned!==true)
  add('safety','operator commissioning not completed');
 if(input.controlAcknowledgementVerified!==true)
  add('safety','inverter command acknowledgement and fail-safe stop not verified');
 if(input.localFailSafeVerified!==true)
  add('safety','independent local fail-safe and watchdog not verified');
 if(input.solarOpeningInventoryVerified!==true)
  warnings.push('Solar/grid battery opening energy inventory still needs independent verification for payback');
 const ready=failures.length===0;
 return {ready,status:ready?'PRECOMMISSIONING_CHECKS_PRESENT':'BLOCKED',
  failures,warnings,sources,
  // Readiness only indicates asserted metadata is internally consistent.
  // It does not independently prove claims or authorise physical action.
  accountingApproved:false,dispatchApproved:false,
  recommendedExportKw:0,
  nextStep:ready?
   'Independently commission hardware and fail-safe controls before any live dispatch; do not treat this diagnostic as authorisation':
   'Resolve all connection and safety blockers before commissioning'};
}
const api={inspect,REQUIRED,LIVE,MAX_AGE_MS};
if(node)module.exports=api;else root.FoxConnectionReadiness=api;
})(typeof window!=='undefined'?window:globalThis);
