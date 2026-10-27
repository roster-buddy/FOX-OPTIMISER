
const assert=require('node:assert/strict');
const {createWatchdog,demonstration}=require('./fox-watchdog-v26.js');
for(const r of demonstration())assert(r.pass,r.name);

const start=1000000;
const readings={
 soc:{value:80,at:start},
 solarKW:{value:0,at:start},
 homeKW:{value:.3,at:start}
};
const plan={
 id:'clock-test',kw:2,createdAt:start-1000,
 expiresAt:start+600000
};
const w=createWatchdog();
assert.equal(w.tick(start,readings,plan).kw,2);
assert.equal(w.tick(start-1,readings,plan).kw,0);
assert.equal(w.tick(start+1,readings,plan).kw,0);

assert.equal(createWatchdog().tick(start,readings,null).kw,0);
assert.equal(createWatchdog().tick(start,readings,{
 ...plan,kw:NaN
}).kw,0);
assert.equal(createWatchdog().tick(start,readings,{
 ...plan,createdAt:start+1
}).kw,0);

console.log(
 'V2.6 TESTS PASS: stale readings, plan expiry, recovery, '+
 'interruption latch and backwards clock'
);
