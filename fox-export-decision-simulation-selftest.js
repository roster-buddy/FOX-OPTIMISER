'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const sim=require('./fox-export-decision-simulation.js');
const base=()=>({
 now:Date.parse('2026-10-28T12:00:00Z'),readOnlySimulation:true,
 socPct:80,capacityKwh:10,demandUntil19Kwh:3,
 exportPence:40,peakImportPence:23.2995,cheapImportPence:3.4965,
 wearPence:5,efficiency:.85,solarOpportunityPence:12,
 exportHeadroomKw:3.5,batteryPowerKw:5,
 solarOriginVerified:true,demandForecastVerified:true,
 tariffApplicableVerified:true,instantaneousHeadroomVerified:true
});
const good=sim.evaluate(base());
assert.equal(good.eligible,true);
assert.equal(good.simulatedKw,3.5);
assert.equal(good.simulatedKwh,1.75);
assert.equal(good.availableKwh,3);
assert.equal(good.reserveKwh,2);
assert.equal(good.dispatchApproved,false);
assert.equal(good.accountingApproved,false);
function reject(fn){
 const x=base();fn(x);
 const r=sim.evaluate(x);
 assert.equal(r.eligible,false,JSON.stringify(r));
 assert.equal(r.simulatedKw,0);
 assert.equal(r.dispatchApproved,false);
}
reject(x=>{x.readOnlySimulation=false});
reject(x=>{x.socPct=50});
reject(x=>{x.socPct=101});
reject(x=>{x.demandUntil19Kwh=6});
reject(x=>{x.exportPence=28.2995});
reject(x=>{x.solarOpportunityPence=50});
reject(x=>{x.solarOriginVerified=false});
reject(x=>{x.demandForecastVerified=false});
reject(x=>{x.tariffApplicableVerified=false});
reject(x=>{x.instantaneousHeadroomVerified=false});
reject(x=>{x.exportHeadroomKw=0});
reject(x=>{x.exportHeadroomKw=4.72});
reject(x=>{x.efficiency=0});
reject(x=>{x.now=Date.parse('2026-10-28T19:00:00Z')});
reject(x=>{x.now=Date.parse('2026-10-28T05:29:00Z')});
const low=base();low.socPct=55;low.demandUntil19Kwh=2;
assert.equal(sim.evaluate(low).simulatedKw,3);
const cap=base();cap.exportHeadroomKw=.6;
assert.equal(sim.evaluate(cap).simulatedKw,.6);
const dst=base();dst.now=Date.parse('2026-10-25T17:30:00Z');
assert.equal(sim.evaluate(dst).eligible,true);
dst.now=Date.parse('2026-10-25T19:00:00Z');
assert.equal(sim.evaluate(dst).eligible,false);
const src=fs.readFileSync('fox-export-decision-simulation.js','utf8');
for(const forbidden of ['fetch(','localStorage','forceCharge(','forceDischarge('])
 assert(!src.includes(forbidden),'Simulation must not control hardware');
for(const page of ['index.html','preview-v2.html'])
 assert(fs.readFileSync(page,'utf8').includes('fox-export-decision-simulation.js?v=493'));
console.log('EXPORT DECISION SIMULATION PASS');
