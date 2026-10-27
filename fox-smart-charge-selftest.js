'use strict';
const assert=require('node:assert/strict');
const core=require('./fox-smart-charge-core.js');
const t=x=>Date.parse(x);
const base={
 mode:'smart',confirmed:true,cheapP:7,peakP:28,
 gridKW:8.3,houseKW:.3,evMaxKW:11,
 evSchedule:[],smartWindows:[]
};
const run=(start,end,extra={})=>
 core.segments(t(start),t(end),{...base,...extra});
const noon='2026-10-27T12:00:00Z';
const finish='2026-10-27T12:30:00Z';
const window={start:noon,end:finish};

let rows=run(noon,finish,{smartWindows:[window]});
assert.equal(rows[0].importP,7);
assert.equal(rows[0].hold,true);
assert.equal(rows[0].flexCharge,true);
assert.equal(rows[0].allowExport,false);

rows=run(noon,finish,{
 mode:'max',confirmed:false,
 evSchedule:[{...window,kw:7}]
});
assert.equal(rows[0].importP,28);
assert.equal(rows[0].hold,true);
assert.equal(rows[0].flexCharge,false);

rows=run(noon,finish,{
 mode:'unknown',confirmed:false,
 evSchedule:[{...window,kw:7}]
});
assert.equal(rows[0].cheap,false);
assert.equal(rows[0].hold,true);

assert.throws(()=>run(noon,finish,{
 confirmed:false,smartWindows:[window]
}),/confirmed/);
assert.throws(()=>run(noon,finish,{
 mode:'max',smartWindows:[window]
}),/confirmed/);

rows=run(noon,finish,{evSchedule:[{
 start:'2026-10-27T12:10:00Z',
 end:'2026-10-27T12:20:00Z',kw:9
}]});
assert.equal(rows.length,3);
assert.equal(rows[1].evKW,9);
assert.equal(rows[1].gridConflict,true);
assert.equal(rows[1].gridHeadroomKW,0);
assert.ok(Math.abs(rows.reduce((s,x)=>s+x.evKWh,0)-1.5)<1e-9);
assert.equal(rows[0].hold,false);
assert.equal(rows[2].hold,false);

assert.equal(core.regular(t('2026-07-01T22:30:00Z')),true);
assert.equal(core.regular(t('2026-07-02T04:30:00Z')),false);
assert.equal(core.regular(t('2026-12-01T23:30:00Z')),true);
assert.equal(core.regular(t('2026-12-02T05:30:00Z')),false);

rows=run('2026-10-27T23:30:00Z','2026-10-28T00:00:00Z',{
 mode:'max',confirmed:false
});
assert.equal(rows[0].cheap,true);
assert.equal(rows[0].hold,true);
assert.equal(rows[0].flexCharge,false);

console.log('SMART POLICY PASS: confirmed entitlement, Max/unknown protection, regular UK window, partial EV intervals and explicit grid conflicts');
