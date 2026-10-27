'use strict';
const assert=require('node:assert/strict');
const core=require('./fox-schedule-core.js');
const c={
 capacity:10,initial:2,eff:.9,min:.5,target:2,
 forcedFloor:2,chargeKW:5,dischargeKW:5,exportKW:3.5,
 refillP:7,wearP:0
};
const slots=[
 {
  utc:'2026-10-27T18:00:00Z',clock:18,
  solar:0,house:0,price:10,importP:7,
  cheap:true,hold:true,flexCharge:true,
  gridHeadroomKWh:1,allowExport:false
 },
 {
  utc:'2026-10-27T18:30:00Z',clock:18.5,
  solar:0,house:0,price:100,importP:28,
  cheap:false,allowExport:true,checkpoint:true
 }
];
function checked(config,inputs){
 const r=core.solve(config,inputs);
 assert.equal(r.ok,true);
 assert.equal(r.valid,true);
 const replay=core.replay(config,inputs,
  r.steps.map(x=>x.forced),r.steps.map(x=>x.chargeGrid));
 assert.ok(Math.abs(replay.end-r.end)<1e-9);
 assert.ok(Math.abs(replay.financial.cost-r.financial.cost)<1e-9);
 return r;
}
let r=checked(c,slots);
assert.ok(r.steps[0].chargeGrid>.9);
assert.ok(r.forced>.7);
assert.ok(r.at19>=2-1e-7);
assert.ok(r.steps[0].chargeGrid<=1);

// Sufficient subsequent solar removes the need to buy extra energy.
r=checked(c,[slots[0],{...slots[1],solar:3,price:0}]);
assert.equal(r.steps[0].chargeGrid,0);

// Optional high wear makes the export cycle uneconomic.
r=checked({...c,wearP:100},slots);
assert.equal(r.steps[0].chargeGrid,0);
assert.equal(r.forced,0);

// Explicit grid conflict cannot become an apparently feasible plan.
r=core.solve(c,[{...slots[0],gridConflict:true},slots[1]]);
assert.equal(r.ok,false);
console.log('FLEX SOLVER PASS: economic charging, solar-aware hold, wear, reserve, headroom, conflicts and exact action replay');
