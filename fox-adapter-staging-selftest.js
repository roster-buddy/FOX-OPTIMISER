'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const stage=require('./fox-adapter-staging.js');
const recorded=require('./fox-recorded-data.js');
const start=Date.parse('2026-10-26T23:30:00Z'),end=start+24*3600000,now=end+1000;
const window={start,end};
function batch(stream='gridImport',source='octopus'){
 const rows=Array.from({length:48},(_,i)=>({
  start:start+i*1800000,end:start+(i+1)*1800000,value:.25,unit:'kWh',
  origin:'provider-api',quality:'raw-device-reading'
 }));
 return {stream,source,rows};
}
const good=stage.stage(batch(),window,now);
assert.equal(good.ready,true);
assert.equal(good.accountingApproved,false);
assert.equal(good.stagedKwh,12);
assert.equal(good.intervalCount,48);
assert(good.candidates.every(r=>r.measured===false&&r.verified===false));
assert.equal(recorded.inspect(good.candidates,window,now).available,false,
 'Staged readings must never become actual accounting data');
assert.equal(stage.stage(batch('gridImport','fox'),window,now).ready,false);
assert.equal(stage.stage(batch('unknown','fox'),window,now).ready,false);
assert.equal(stage.stage(batch(),window,end-1).ready,false);
function changed(edit){const b=batch();edit(b);return stage.stage(b,window,now);}
assert.equal(changed(b=>b.rows[1].start+=1).ready,false);
assert.equal(changed(b=>b.rows.pop()).ready,false);
assert.equal(changed(b=>b.rows[0].value=-1).ready,false);
assert.equal(changed(b=>b.rows[0].unit='W').ready,false);
assert.equal(changed(b=>b.rows[0].quality='simulation').ready,false);
assert.equal(changed(b=>b.rows[0].origin='user-input').ready,false);
assert.equal(changed(b=>b.rows[0].measured=true).ready,false);
assert.equal(changed(b=>b.rows[0].verified=true).ready,false);
assert.equal(changed(b=>b.rows[0].source='ohme').ready,false);
assert.equal(changed(b=>b.rows[0].end+=1800000).ready,false);
const req=[
 batch('gridImport','octopus'),batch('gridExport','octopus'),
 batch('genLoadSolar','fox'),batch('batteryDischargeDC','fox'),
 batch('batteryDeliveredAC','fox')
];
const ready=stage.readiness(req,window,now);
assert.equal(ready.ready,true);
assert.equal(ready.accountingApproved,false,'Staged streams do not imply validated accounts');
assert.equal(stage.readiness(req.slice(0,2),window,now).ready,false);
assert.equal(stage.readiness([req[0],req[0]],window,now).ready,false);
const source=fs.readFileSync('fox-adapter-staging.js','utf8');
for(const forbidden of ['fetch(','localStorage','FoxActualReport','recordDay(','forceDischarge(','forceCharge(','measured:true','verified:true'])
 assert(!source.includes(forbidden),'Staging must not authorise or write: '+forbidden);
for(const page of ['index.html','preview-v2.html']){
 const html=fs.readFileSync(page,'utf8');
 assert(html.includes('fox-adapter-staging.js?v=488'));
}
console.log('ADAPTER STAGING PASS: stream provenance, coverage, no promoted readings, invalid intervals, readiness and read-only isolation');
