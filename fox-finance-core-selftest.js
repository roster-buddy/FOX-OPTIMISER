
'use strict';
const assert=require('node:assert/strict');
const {settle,compare}=require('./fox-finance-core.js');
const c={capacity:10,eff:.9,refillP:7,wearP:5};
const b={importCost:.2,revenue:.1,end:8,dischargeStored:2};
const o={importCost:.3,revenue:.8,end:5,dischargeStored:5};
const close=(a,b)=>assert(Math.abs(a-b)<1e-10,`${a} != ${b}`);

const r=compare(b,o,c);
close(r.base.refillKWh,2/.9);
close(r.opt.refillCost,5/.9*.07);
close(r.gross,.3666666666666667);
close(r.wearCost,.15);
close(r.net,.2166666666666667);
close(compare(b,b,c).net,0);
close(settle(
 {...b,importCost:.35,revenue:0,end:10},
 {...c,wearP:0}
).cost,.35);
close(settle(
 {...b,importCost:0,revenue:-.5,end:10},
 {...c,wearP:0}
).cost,.5);
close(compare(b,o,{...c,wearP:0}).net,r.gross);
close(compare(o,b,c).wearCost,0);
assert.throws(()=>settle({...b,end:11},c));
assert.throws(()=>settle(b,{...c,eff:0}));
assert.throws(()=>settle(b,{...c,wearP:NaN}));
console.log(
 'FINANCE CORE PASS: refill losses, no double charging, '+
 'negative revenue and optional wear'
);
