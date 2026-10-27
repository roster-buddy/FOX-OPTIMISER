
'use strict';
const assert=require('node:assert/strict');
const {flow}=require('./fox-energy-core.js');
const c={
 capacity:10.24,eff:.95,min:.512,
 chargeKW:5,dischargeKW:5,exportKW:3.5
};
const near=(a,b)=>assert(Math.abs(a-b)<1e-8,`${a} != ${b}`);

for(const energy of [c.min,2,5,c.capacity])
 for(const solar of [0,.2,2,6])
  for(const home of [0,.15,2,6])
   for(const requested of [0,1,10]){
    const r=flow(c,energy,solar,home,requested);
    near(solar,r.solarHome+r.charge+r.natural+r.curtail);
    near(home,r.solarHome+r.batteryHome+r.grid);
    near(
     energy+r.solarStored-(r.batteryHome+r.forced)/c.eff,
     r.end
    );
    assert(r.end>=c.min-1e-8&&r.end<=c.capacity+1e-8);
    assert(r.charge<=c.chargeKW*.5+1e-8);
    assert(
     (r.batteryHome+r.forced)/c.eff<=c.dischargeKW*.5+1e-8
    );
    assert(r.natural+r.forced<=c.exportKW*.5+1e-8);
    if(r.solarStored>1e-9)assert.equal(r.forced,0);
   }

assert.throws(()=>flow(c,5,NaN,0,0));
assert.throws(()=>flow(c,5,0,0,-1));
assert.equal(flow(c,2,0,0,10,2).forced,0);
console.log('SHARED CORE PASS: 192 energy-balance and power-limit cases');
