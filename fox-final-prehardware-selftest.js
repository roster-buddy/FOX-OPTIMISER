'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const calendar=require('./fox-calendar-session-rollup.js');
const stress=require('./fox-stress-suite.js');
const setup=require('./fox-setup-guide.js');
const entries={
 '2026-10-01':{'2026-10-01T12:00':{type:'happy'},'2026-10-01T12:30':{type:'happy'}},
 '2026-10-02':{'2026-10-02T18:30':{type:'powerup'},'2026-10-02T19:00':{type:'legacy'}},
 '2026-11-01':{'2026-11-01T12:00':{type:'happy'}}
};
const month=calendar.countMonth(day=>entries[day]||{},2026,9);
assert.equal(month.days,31);assert.equal(month.daysWithSelections,2);
assert.equal(month.happyHours,1);assert.equal(month.powerupHours,.5);
assert.equal(month.legacyHours,.5);assert.equal(month.actualEnergyBenefitGbp,null);
assert.equal(month.confirmedWithOctopus,false);
assert.equal(calendar.countMonth(()=>({}),2028,1).days,29);
assert.equal(calendar.countMonth(()=>({}),2026,12),null);
const results=stress.run();assert.equal(results.length,6);
assert(results[0].feasible&&results[0].simulatedExportKwh>0);
assert(results[1].feasible&&results[1].at19Pct>=20);
assert(results[2].feasible===false||results[2].simulatedExportKwh<=results[0].simulatedExportKwh);
assert.equal(results[3].simulatedExportKwh,0);
assert.equal(results[4].feasible,false);
assert.equal(results[5].feasible,false);
assert(results.every(r=>r.dispatchApproved===false&&r.accountingApproved===false));
assert.equal(setup.items.length,8);
assert.equal(setup.readiness().liveControlApproved,false);
assert.equal(setup.readiness(Array(8).fill(true)).prepared,8);
assert.equal(setup.readiness(Array(8).fill(true)).hardwareConnected,false);
for(const page of ['index.html','preview-v2.html']){
 const html=fs.readFileSync(page,'utf8');
 for(const name of ['fox-calendar-session-rollup.js?v=498','fox-stress-suite.js?v=498','fox-setup-guide.js?v=498'])
  assert(html.includes(name),page+' missing '+name);
}
const layout=fs.readFileSync('fox-dashboard-layout.js','utf8');
assert(layout.includes('foxStressPanel')&&layout.includes('foxSetupGuide'));
for(const name of ['fox-calendar-session-rollup.js','fox-stress-suite.js','fox-setup-guide.js']){
 const src=fs.readFileSync(name,'utf8');
 for(const forbidden of ['fetch(','localStorage','forceDischarge(','forceCharge('])
  assert(!src.includes(forbidden),name+' contains forbidden active integration '+forbidden);
}
console.log('PREHARDWARE FINAL PASS: monthly manual sessions, stress scenarios, no-credentials commissioning and no dispatch');
