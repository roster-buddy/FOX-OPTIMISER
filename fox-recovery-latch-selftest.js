'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const recovery=require('./fox-recovery-latch.js');
const start=1000000;
const healthy=at=>({
 homeAssistant:{configured:true,authenticated:true,connected:true,lastSeenAt:at},
 foxEss:{configured:true,authenticated:true,connected:true,lastSeenAt:at},
 octopus:{configured:true,authenticated:true,connected:true,lastSeenAt:at},
 ohme:{configured:true,authenticated:true,connected:true,lastSeenAt:at},
 clockSynchronized:true,readOnlyMode:true,tariffEligibilityConfirmed:true,
 meterPointsValidated:true,socSourceValidated:true,instantaneousLimitsValidated:true,
 siteExportCapKw:3.5,operatorCommissioned:true,controlAcknowledgementVerified:true,
 localFailSafeVerified:true,solarOpeningInventoryVerified:true
});
const plan=(id,createdAt=start)=>({id,createdAt,expiresAt:createdAt+600000,kw:2});
const a=recovery.create();
function noDispatch(r){
 assert.equal(r.dispatchApproved,false);
 assert.equal(r.accountingApproved,false);
 assert.equal(r.recommendedExportKw,0);
 assert.equal(r.physicalStopConfirmed,false);
 return r;
}
assert.equal(noDispatch(a.tick(start,healthy(start),plan('A'))).simulationEligible,false);
assert.equal(noDispatch(a.acknowledgeNewPlan(start,healthy(start),plan('A'),false)).simulationEligible,false);
assert.equal(noDispatch(a.acknowledgeNewPlan(start,healthy(start),plan('A'),true)).simulationEligible,true);
assert.equal(noDispatch(a.tick(start+1000,healthy(start+1000),plan('A'))).simulationEligible,true);
const stale=healthy(start+120001);
stale.foxEss.lastSeenAt=start;
assert.equal(noDispatch(a.tick(start+120001,stale,plan('A'))).simulationEligible,false);
assert.equal(noDispatch(a.tick(start+120002,healthy(start+120002),plan('A'))).simulationEligible,false);
assert.equal(noDispatch(a.acknowledgeNewPlan(start+120002,healthy(start+120002),plan('A'),true)).simulationEligible,false);
assert.equal(noDispatch(a.acknowledgeNewPlan(start+120002,healthy(start+120002),plan('B',start+120002),false)).simulationEligible,false);
assert.equal(noDispatch(a.acknowledgeNewPlan(start+120002,healthy(start+120002),plan('B',start+120002),true)).simulationEligible,true);
assert.equal(noDispatch(a.tick(start+120001,healthy(start+120001),plan('B',start+120002))).simulationEligible,false);
assert.equal(noDispatch(a.tick(start+120003,healthy(start+120003),plan('B',start+120002))).simulationEligible,false);
const b=recovery.create();
assert.equal(noDispatch(b.acknowledgeNewPlan(start,healthy(start),plan('X'),true)).simulationEligible,true);
assert.equal(noDispatch(b.tick(start+600000,healthy(start+600000),plan('X'))).simulationEligible,false);
assert.equal(noDispatch(b.acknowledgeNewPlan(start+600001,healthy(start+600001),plan('X'),true)).simulationEligible,false);
const c=recovery.create();
assert.equal(noDispatch(c.acknowledgeNewPlan(start,healthy(start),plan('C'),true)).simulationEligible,true);
assert.equal(noDispatch(c.interrupt('Connection lost')).simulationEligible,false);
assert.equal(noDispatch(c.acknowledgeNewPlan(start+1,healthy(start+1),plan('C'),true)).simulationEligible,false);
assert.equal(noDispatch(c.acknowledgeNewPlan(start+1,healthy(start+1),plan('D',start+1),true)).simulationEligible,true);
assert.equal(noDispatch(c.tick(start+2,healthy(start+2),{...plan('D',start+1),kw:1})).simulationEligible,false);
const d=recovery.create();
assert.equal(noDispatch(d.acknowledgeNewPlan(start,healthy(start),{...plan('E'),kw:4},true)).simulationEligible,false);
assert.equal(noDispatch(d.acknowledgeNewPlan(start,healthy(start),{...plan('E'),expiresAt:start+3600001},true)).simulationEligible,false);
assert.equal(noDispatch(d.acknowledgeNewPlan(start,healthy(start),plan('E'),true)).simulationEligible,true);
const invalid=healthy(start+1);invalid.ohme.connected=false;
assert.equal(noDispatch(d.tick(start+1,invalid,plan('E'))).simulationEligible,false);
const source=fs.readFileSync('fox-recovery-latch.js','utf8');
for(const forbidden of ['fetch(','localStorage','forceCharge(','forceDischarge('])
 assert(!source.includes(forbidden),'Recovery simulation must not control hardware');
for(const page of ['index.html','preview-v2.html']){
 const html=fs.readFileSync(page,'utf8');
 assert(html.includes('fox-recovery-latch.js?v=492'));
 assert(html.indexOf('fox-connection-readiness.js')<html.indexOf('fox-recovery-latch.js'));
}
console.log('RECOVERY LATCH PASS: stale and lost links, backwards clock, expiry, plan reuse, explicit rearm and no dispatch');
