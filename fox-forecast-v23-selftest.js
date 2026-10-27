
const assert=require('node:assert/strict');
const {run}=require('./fox-forecast-v23.js');

for(const pv of [0,.5,1]){
 for(const load of [1,2,5]){
  for(const mode of ['fixed','adaptive']){
   const r=run(mode,pv,load);
   assert(Number.isFinite(r.at19));
   assert(r.end>=.512-1e-8);
   assert(r.end<=10.24+1e-8);
   assert(r.residual<1e-8);
   assert(Number.isFinite(r.actualForced));
   assert(r.actualForced>=0);
   assert(r.actualNatural>=0);
  }
 }
}

for(const [pv,h] of [[1,1],[.5,1],[1,2],[.5,2]]){
 assert(run('adaptive',pv,h).pass);
}

const matchedFixed=run('fixed',1,1);
const matchedAdaptive=run('adaptive',1,1);
assert(Math.abs(
 matchedFixed.actualForced-matchedAdaptive.actualForced
)<1e-8,'Matching forecasts should deliver equal total forced export');

assert(!run('fixed',.5,2).pass);
const extreme=run('adaptive',0,5);
assert(!extreme.pass,'Extreme scenario must report a missed target');
assert(extreme.at19<20);
assert(extreme.grid>0);

console.log(
 'V2.3.1 TESTS PASS: export totals, energy accounting, '+
 'adaptive scenarios and extreme reserve miss'
);

// v2.3.3 shortfall regression
{
 const stressed=run('adaptive',0,5);
 assert(stressed.shortfallIntervals>0);
 assert.equal(stressed.exportDuringShortfall,0);
 assert.equal(stressed.pass,false);

 const normal=run('adaptive',1,1);
 assert.equal(normal.shortfallIntervals,0);
 assert.equal(normal.pass,true);

 console.log('PASS: shortfall detection and export-stop regression');
}
