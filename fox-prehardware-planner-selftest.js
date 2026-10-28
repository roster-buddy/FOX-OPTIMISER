'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const core=require('./fox-prehardware-planner.js');
const fmt=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
function config(day='2026-10-28'){
 let start=Date.parse(day+'T05:30:00Z');
 // In summer UK local time is UTC+1.
 if(fmt.format(new Date(start))!=='05:30')start-=3600000;
 const slots=Array.from({length:27},(_,i)=>({
  start:start+i*1800000,end:start+(i+1)*1800000,
  houseKwh:.1,exportPence:i===9?60:i===16?50:10,headroomKw:3.5
 }));
 return {slots,capacityKwh:10,socPct:90,dischargeEfficiency:.9,
  forecastQuality:'SCENARIO_VALIDATED',peakImportPence:23.2995,
  cheapImportPence:3.4965,wearPence:5,solarOpportunityPence:12,
  batteryPowerKw:5,solarOriginVerified:true,
  tariffApplicableVerified:true,instantaneousHeadroomVerified:true};
}
const c=config(),r=core.planDay(c);
assert.equal(r.ok,true,JSON.stringify(r));
assert.equal(r.rows.length,27);
assert.equal(r.requiredReserveKwh,2);
assert(r.at19Kwh>=2-1e-8);
assert.equal(r.dispatchApproved,false);
assert.equal(r.accountingApproved,false);
assert.equal(r.instantaneousEnforcementActive,false);
assert(r.rows[9].simulatedExportKwh>0);
assert(r.rows[16].simulatedExportKwh>0);
assert.equal(r.rows[0].simulatedExportKwh,0);
assert(Math.abs(r.exportKwh-3.5)<1e-8);
assert.equal(r.rows.every(x=>x.solarCreditKwh===0),true);
assert.equal(core.forecastQuality({source:'synthetic',slots:c.slots}).quality,'SCENARIO_VALIDATED');
assert.equal(core.forecastQuality({source:'unknown',slots:c.slots}).quality,'UNVERIFIED');
assert.equal(core.forecastQuality({slots:[]}).quality,'UNVERIFIED');
for(const day of ['2026-03-29','2026-10-25','2026-06-15']){
 const result=core.planDay(config(day));
 assert.equal(result.ok,true,day+': '+result.reason);
 assert.equal(result.rows.length,27);
 assert.equal(fmt.format(new Date(result.rows[0].start)),'05:30');
 assert.equal(fmt.format(new Date(result.rows.at(-1).end)),'19:00');
}
function bad(change){
 const x=structuredClone(c);change(x);
 const result=core.planDay(x);
 assert.equal(result.ok,false,JSON.stringify(result));
}
bad(x=>x.slots.pop());
bad(x=>x.slots[2].start+=1);
bad(x=>x.slots[0].start+=1800000);
bad(x=>x.slots[1].houseKwh=-1);
bad(x=>x.slots[1].headroomKw=4.72);
bad(x=>x.forecastQuality='UNVERIFIED');
bad(x=>x.socPct=101);
const low=config();low.socPct=20;
const lowResult=core.planDay(low);
assert.equal(lowResult.ok,false,'Insufficient energy for home should not be called feasible');
const noPrice=config();noPrice.slots.forEach(s=>s.exportPence=10);
assert.equal(core.planDay(noPrice).exportKwh,0);
const combined=core.fullSimulation({day:c});
assert.equal(combined.ok,true);
assert.equal(combined.dispatchApproved,false);
const now=Date.parse('2026-10-28T12:00:00Z');
const links=at=>({
 homeAssistant:{configured:true,authenticated:true,connected:true,lastSeenAt:at},
 foxEss:{configured:true,authenticated:true,connected:true,lastSeenAt:at},
 octopus:{configured:true,authenticated:true,connected:true,lastSeenAt:at},
 ohme:{configured:true,authenticated:true,connected:true,lastSeenAt:at},
 clockSynchronized:true,readOnlyMode:true,tariffEligibilityConfirmed:true,
 meterPointsValidated:true,socSourceValidated:true,instantaneousLimitsValidated:true,
 siteExportCapKw:3.5,operatorCommissioned:true,controlAcknowledgementVerified:true,
 localFailSafeVerified:true,solarOpeningInventoryVerified:true
});
const activePlan={id:'simulated-test',kw:2,createdAt:now,expiresAt:now+600000};
const gated=core.fullSimulation({day:c,recovery:{
 now,connections:links(now),plan:activePlan,acknowledged:true
}});
assert.equal(gated.ok,true,JSON.stringify(gated.diagnostics));
const outage=links(now);outage.foxEss.connected=false;
const blocked=core.fullSimulation({day:c,recovery:{
 now,connections:outage,plan:activePlan,acknowledged:true
}});
assert.equal(blocked.ok,false);
assert.equal(blocked.dispatchApproved,false);
const overnightSettings={
 evPercent:0,evCapacity:61.7,evKw:6.63,evEfficiency:90,
 gridKw:8.3,houseKw:.4,batteryKw:5,batteryEfficiency:90,
 capacity:10,soc:5,target:100,evConnect:'01:00',evDeadline:'05:30'
};
const combinedNight=core.fullSimulation({day:c,overnight:{
 now:Date.parse('2026-10-27T18:00:00Z'),settings:overnightSettings
}});
assert.equal(combinedNight.ok,true,JSON.stringify(combinedNight.diagnostics));
assert(combinedNight.overnight.predictedSoc>=99.9);
const impossible=core.fullSimulation({day:c,overnight:{
 now:Date.parse('2026-10-27T18:00:00Z'),
 settings:{...overnightSettings,evPercent:100,evConnect:'23:30'}
}});
assert.equal(impossible.ok,false);
const src=fs.readFileSync('fox-prehardware-planner.js','utf8');
for(const prohibited of ['fetch(','localStorage','forceCharge(','forceDischarge('])
 assert(!src.includes(prohibited),'No hardware control');
for(const page of ['index.html','preview-v2.html'])
 assert(fs.readFileSync(page,'utf8').includes('fox-prehardware-planner.js?v=494'));
console.log('PREHARDWARE PLANNER PASS: ranked prices, reserve, demand, UK DST, missing data and no commands');
