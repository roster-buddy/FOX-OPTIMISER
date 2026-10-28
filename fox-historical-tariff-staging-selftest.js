'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const dates=require('./fox-actual-costs.js');
const tariff=require('./fox-historical-tariff-staging.js');
const recorded=require('./fox-recorded-data.js');
const make=(day,direction='import')=>{
 const window=dates.windowFor(day);
 return {window,batch:{direction,source:'octopus',origin:'provider-api',
  tariffCode:direction==='import'?'E-1R-INTELLI-VAR-22-10-14-A':'E-1R-AGILE-OUTGOING-19-05-13-E',
  unit:'p/kWh',vatIncluded:true,
  rows:Array.from({length:(window.end-window.start)/1800000},(_,i)=>({
   start:window.start+i*1800000,end:window.start+(i+1)*1800000,
   pence:i%2?3.4965:23.2995,origin:'provider-api',quality:'historical-published-rate'
  }))}};
};
for(const day of ['2026-10-26','2026-10-25','2026-03-29']){
 const {window,batch}=make(day),now=window.end;
 const staged=tariff.stage(batch,window,now);
 assert.equal(staged.ready,true,day);
 assert.equal(staged.accountingApproved,false);
 assert.equal(staged.intervalCount,(window.end-window.start)/1800000);
 assert(staged.candidates.every(x=>x.confirmed===false&&x.accountApplicable===false));
 const measured=Array.from({length:staged.intervalCount},(_,i)=>({
  start:window.start+i*1800000,end:window.start+(i+1)*1800000,
  value:.5,source:'octopus',measured:true
 }));
 assert.equal(recorded.price(measured,staged.candidates,window,now).available,false,
  'Staged tariffs must not be accepted for actual accounting');
 const invalid=edit=>{const b=structuredClone(batch);edit(b);return tariff.stage(b,window,now);};
 assert.equal(invalid(b=>b.rows[0].pence=NaN).ready,false);
 assert.equal(invalid(b=>b.rows[0].pence=501).ready,false);
 assert.equal(invalid(b=>b.rows[0].start+=1).ready,false);
 assert.equal(invalid(b=>b.rows[0].end-=1).ready,false);
 assert.equal(invalid(b=>b.rows.pop()).ready,false);
 assert.equal(invalid(b=>b.rows[0].confirmed=true).ready,false);
 assert.equal(invalid(b=>b.rows[0].smartChargeConfirmed=true).ready,false);
 assert.equal(invalid(b=>b.rows[0].quality='forecast').ready,false);
 assert.equal(invalid(b=>b.vatIncluded=false).ready,false);
 assert.equal(invalid(b=>b.source='fox').ready,false);
 assert.equal(invalid(b=>b.tariffCode='').ready,false);
 assert.equal(tariff.stage(batch,window,now-1).ready,false);
 const exp=make(day,'export').batch;
 const readiness=tariff.readiness([batch,exp],window,now);
 assert.equal(readiness.ready,true);
 assert.equal(readiness.accountingApproved,false);
 assert.equal(tariff.readiness([batch],window,now).ready,false);
 assert.equal(tariff.readiness([batch,batch],window,now).ready,false);
}
const source=fs.readFileSync('fox-historical-tariff-staging.js','utf8');
for(const forbidden of ['fetch(','localStorage','FoxActualReport','forceCharge(','forceDischarge('])
 assert(!source.includes(forbidden),'Tariff staging must be pure: '+forbidden);
for(const page of ['index.html','preview-v2.html'])
 assert(fs.readFileSync(page,'utf8').includes('fox-historical-tariff-staging.js?v=489'));
console.log('HISTORICAL TARIFF STAGING PASS: 23/24/25-hour days, complete rates, unconfirmed account eligibility, no billing promotion');
