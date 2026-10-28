'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const calendar=fs.readFileSync('fox-calendar-pnl.js','utf8');
const payback=fs.readFileSync('fox-battery-payback-ui.js','utf8');
const daily=fs.readFileSync('fox-daily-breakdown.js','utf8');
const actual=fs.readFileSync('fox-actual-costs.js','utf8');
for(const file of [calendar,payback,daily,actual])assert(file.includes('Awaiting readings'));
assert(calendar.includes('solarStorage:entry[1].solarStorage,directSolarUplift:entry[1].directSolarUplift'),
 'Verified direct-solar-only Agile uplift must be passed to investment tracker');
assert(!payback.includes('FoxFinancialDemoCore'),'Actual payback must not use demonstration');
assert(!daily.includes("data.imported==='—'?'£0"),'Missing actual import must not become zero');
for(const page of ['index.html','preview-v2.html']){
 const html=fs.readFileSync(page,'utf8');
 for(const script of ['fox-calendar-pnl.js','fox-battery-payback-ui.js','fox-daily-breakdown.js','fox-actual-costs.js'])
  assert(html.includes(script+'?v=480'),page+' must refresh '+script);
}
console.log('ACTUAL DASHBOARD WAITING STATE PASS: awaiting verified data, no fabricated zero, direct-solar payback feed');
