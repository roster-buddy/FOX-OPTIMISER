'use strict';
const assert=require('node:assert/strict');
const {run}=require('./fox-forecast-v23.js');
const {createWatchdog}=require('./fox-watchdog-v26.js');

function scenario(kind,newPlanOnRecovery){
 const watchdog=createWatchdog();
 const events=[];
 const origin=100000000;

 const result=run('adaptive',1,1,x=>{
  const now=origin+x.clock*3600000;
  const outage=x.clock>=16&&x.clock<17;
  const recovered=x.clock>=17;
  const readings={
   soc:{value:x.soc,at:now},
   solarKW:{value:0,at:now},
   homeKW:{value:.3,at:now}
  };

  if(outage){
   if(kind==='missing')readings.soc=null;
   else readings.soc.at=now-180000;
  }

  // These are deliberately synthetic candidate requests.
  // A fresh plan identity is issued only after recovery.
  const renewed=recovered&&newPlanOnRecovery;
  const plan={
   id:renewed?'replanned-after-outage':'original-plan',
   kw:x.requestedKW,
   createdAt:origin,
   expiresAt:origin+24*3600000
  };

  const decision=watchdog.tick(now,readings,plan);
  events.push({clock:x.clock,...decision});
  return decision;
 });

 return {result,events};
}

for(const kind of ['missing','stale']){
 const renewed=scenario(kind,true);

 assert(renewed.result.trace
  .filter(x=>x.clock>=16&&x.clock<17)
  .every(x=>x.forced===0),
  'No forced export during outage');

 assert(renewed.result.trace
  .some(x=>x.clock>=17&&x.clock<19&&x.forced>0),
  'A fresh plan should allow exports after recovery');

 assert(renewed.result.pass,
  'Recovery scenario must preserve the modelled reserve');

 assert(renewed.result.residual<1e-8);

 const retained=scenario(kind,false);
 assert(retained.result.trace
  .filter(x=>x.clock>=17)
  .every(x=>x.forced===0),
  'Fresh readings must not restart the interrupted plan');

 console.log(
  kind.toUpperCase()+': PASS — outage blocks export; '+
  'old plan stays stopped; new plan resumes; renewed-plan '+
  '19:00 SOC '+renewed.result.at19.toFixed(2)+'%'
 );
}

console.log(
 'COMBINED CHAIN PASS. Synthetic battery state remains known '+
 'to the planner; this does not test state estimation or hardware.'
);
