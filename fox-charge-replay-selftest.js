'use strict';
const assert=require('node:assert/strict');
const core=require('./fox-schedule-core.js');
const c={
 capacity:10,initial:5,eff:.9,min:.5,target:2,
 forcedFloor:2,chargeKW:5,dischargeKW:5,exportKW:3.5,
 refillP:7,wearP:0
};
const slot={
 utc:'2026-10-27T12:00:00Z',clock:12,
 solar:0,house:.15,price:30,importP:7,
 cheap:true,hold:true,flexCharge:true,allowExport:true,
 ev:3.5,gridHeadroomKWh:.5,checkpoint:true
};
let r=core.replay(c,[slot],[1],[0]);
assert.equal(r.end,5);
assert.equal(r.forced,0);
assert.equal(r.steps[0].batteryHome,0);
assert.equal(r.grid,3.65);
r=core.replay(c,[slot],[1],[2]);
assert.equal(r.steps[0].chargeGrid,.5);
assert.ok(Math.abs(r.end-5.45)<1e-9);
assert.ok(Math.abs(r.grid-4.15)<1e-9);

// Max Charge protects battery without granting cheap charging.
r=core.replay(c,[{
 ...slot,cheap:false,flexCharge:false,importP:28
}],[1],[2]);
assert.equal(r.end,5);
assert.equal(r.steps[0].chargeGrid,0);
assert.ok(Math.abs(r.importCost-3.65*.28)<1e-9);

// Supplied EV demand remains intact when the ceiling is exceeded.
r=core.replay(c,[{
 ...slot,ev:5,gridHeadroomKWh:0,gridConflict:true
}],[],[2]);
assert.equal(r.steps[0].ev,5);
assert.equal(r.steps[0].chargeGrid,0);
assert.equal(r.gridConflict,true);
assert.equal(r.valid,false);

// Regular overnight charging remains automatic and starts immediately.
r=core.replay(c,[{
 ...slot,ev:0,flexCharge:false,gridHeadroomKWh:2
}]);
assert.equal(r.steps[0].chargeGrid,2);
assert.ok(Math.abs(r.end-6.8)<1e-9);
assert.throws(()=>core.replay(c,[slot],[],[-1]),/charging request/);
console.log('CHARGING REPLAY PASS: hold, EV costs, optional charging, headroom, conflicts and early regular charging');
