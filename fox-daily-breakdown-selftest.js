'use strict';
const assert=require('node:assert/strict');
const dates=require('./fox-actual-costs.js');
const reports=require('./fox-actual-report.js');
const summary=require('./fox-daily-breakdown.js');
const day='2026-10-26',w=dates.windowFor(day);
const records=(source,n)=>Array.from({length:48},(_,i)=>({
 start:w.start+i*1800000,end:w.start+(i+1)*1800000,source,measured:true,value:n
}));
const rates=p=>[{...w,pence:p,confirmed:true}];
const input={streams:{gridImport:records('octopus',.5),gridExport:records('octopus',.25)},
 tariffs:{import:rates(20),export:rates(10)}};
const report=reports.build(day,input,w.end);
const bookings={
 [day+'T10:00']:{type:'happy'},[day+'T10:30']:{type:'happy'},
 [day+'T13:00']:{type:'powerup'},[day+'T14:00']:{type:'legacy'}
};
let data=summary.summary(report,bookings);
assert.equal(data.imported,'£4.80');
assert.equal(data.exported,'£1.20');
assert.equal(data.net,'−£3.60');
assert.equal(data.state,'loss');
assert.match(data.sessions,/Weekend Happy Hour · 1.0h/);
assert.match(data.sessions,/Power Up reward · 0.5h/);
assert.match(data.sessions,/Earlier Free Electricity · 0.5h/);
assert.match(data.missing,/Complete recorded/);
input.streams.gridImport=records('octopus',.01);
data=summary.summary(reports.build(day,input,w.end),{});
assert.equal(data.state,'profit');
assert.equal(data.net,'£1.10');
assert.match(data.sessions,/No Happy Hour/);
input.streams.gridImport=records('octopus',.125);
data=summary.summary(reports.build(day,input,w.end),{});
assert.equal(data.state,'even');
assert.equal(data.net,'£0.00');
input.streams.gridImport=[];
data=summary.summary(reports.build(day,input,w.end),{});
assert.equal(data.state,'missing');
assert.equal(data.imported,'—');
assert.equal(data.net,'—');
assert.equal(data.exported,'£1.20');
assert.match(data.missing,/Import:/);
assert(!data.missing.includes('Export:'));
assert.equal(summary.summary(null,null).state,'missing');
assert(summary.validDay('2026-10-25'));
assert(!summary.validDay('2026-02-30'));
assert(!summary.validDay('2026-2-25'));
const incremental=summary.summary({solarStorage:{available:true,value:.1212416}},{});
assert.equal(incremental.solarGain,'£0.12');
assert.equal(summary.summary({},{}).solarGain,'—');
console.log('DAILY BREAKDOWN PASS: recorded-only green/red/neutral, missing-data and calendar sessions');
