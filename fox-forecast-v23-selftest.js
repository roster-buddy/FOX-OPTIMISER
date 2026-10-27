
const assert=require('node:assert/strict');
const {run}=require('./fox-forecast-v23.js');
for(const pv of [0,.5,1])
 for(const load of [1,2,5])
  for(const mode of ['fixed','adaptive']){
   const r=run(mode,pv,load);
   assert(Number.isFinite(r.at19));
   assert(r.end>=.512-1e-8);
   assert(r.residual<1e-8);
  }
for(const [pv,h] of [[1,1],[.5,1],[1,2],[.5,2]])
 assert(run('adaptive',pv,h).pass);
assert(!run('fixed',.5,2).pass);
console.log('V2.3 TESTS PASS');
