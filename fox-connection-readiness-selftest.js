'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const health=require('./fox-connection-readiness.js');
const now=Date.parse('2026-10-28T16:00:00Z');
const base=()=>({
 homeAssistant:{configured:true,authenticated:true,connected:true,lastSeenAt:now},
 foxEss:{configured:true,authenticated:true,connected:true,lastSeenAt:now},
 octopus:{configured:true,authenticated:true,connected:true,lastSeenAt:now},
 ohme:{configured:true,authenticated:true,connected:true,lastSeenAt:now},
 clockSynchronized:true,readOnlyMode:true,tariffEligibilityConfirmed:true,
 meterPointsValidated:true,socSourceValidated:true,instantaneousLimitsValidated:true,
 siteExportCapKw:3.5,operatorCommissioned:true,controlAcknowledgementVerified:true,
 localFailSafeVerified:true,solarOpeningInventoryVerified:true
});
const good=health.inspect(base(),now);
assert.equal(good.ready,true);
assert.equal(good.status,'PRECOMMISSIONING_CHECKS_PRESENT');
assert.equal(good.accountingApproved,false);
assert.equal(good.dispatchApproved,false);
assert.equal(good.recommendedExportKw,0);
assert.equal(good.failures.length,0);
assert.equal(health.inspect({},now).ready,false);
assert.equal(health.inspect(null,now).ready,false);
assert.equal(health.inspect(base(),NaN).status,'INVALID_CLOCK');
function check(change,match){
 const x=base();change(x);
 const result=health.inspect(x,now);
 assert.equal(result.ready,false,JSON.stringify(result));
 assert.equal(result.dispatchApproved,false);
 assert.equal(result.recommendedExportKw,0);
 assert(result.failures.some(s=>s.includes(match)),JSON.stringify(result));
}
check(x=>{delete x.homeAssistant},'homeAssistant: not configured');
check(x=>{x.foxEss.authenticated=false},'authentication');
check(x=>{x.octopus.connected=false},'connection unavailable');
check(x=>{x.ohme.error=true},'connector error');
check(x=>{x.foxEss.lastSeenAt=now-120001},'stale heartbeat');
check(x=>{x.foxEss.lastSeenAt=now+1},'future-dated heartbeat');
check(x=>{x.octopus.lastSeenAt=now-3600001},'stale heartbeat');
check(x=>{x.ohme.lastSeenAt=now-900001},'stale heartbeat');
check(x=>{x.clockSynchronized=false},'clock synchronisation');
check(x=>{x.readOnlyMode=false},'read-only safety mode');
check(x=>{x.tariffEligibilityConfirmed=false},'smart-charge eligibility');
check(x=>{x.meterPointsValidated=false},'CT polarity');
check(x=>{x.socSourceValidated=false},'SOC source');
check(x=>{x.instantaneousLimitsValidated=false},'power limits');
check(x=>{x.siteExportCapKw=4.72},'DNO restriction');
check(x=>{x.operatorCommissioned=false},'operator commissioning');
check(x=>{x.controlAcknowledgementVerified=false},'acknowledgement');
check(x=>{x.localFailSafeVerified=false},'fail-safe');
const warning=base();warning.solarOpeningInventoryVerified=false;
assert.equal(health.inspect(warning,now).ready,true);
assert.equal(health.inspect(warning,now).warnings.length,1);
assert.equal(health.inspect(base(),now+120000).ready,true);
assert.equal(health.inspect(base(),now+120001).ready,false);
const src=fs.readFileSync('fox-connection-readiness.js','utf8');
for(const forbidden of ['fetch(','localStorage','forceCharge(','forceDischarge('])
 assert(!src.includes(forbidden),'Readiness must be read-only: '+forbidden);
for(const page of ['index.html','preview-v2.html']){
 const html=fs.readFileSync(page,'utf8');
 assert(html.includes('fox-connection-readiness.js?v=491'));
 assert(html.indexOf('fox-staged-energy-reconcile.js')<html.indexOf('fox-connection-readiness.js'));
}
console.log('CONNECTION READINESS PASS: stale and missing connections, safety interlocks, no dispatch');
