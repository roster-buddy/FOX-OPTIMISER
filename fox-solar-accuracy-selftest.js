'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const core=require('./fox-solar-accuracy-core.js');
const csv=['date,forecast_kwh,actual_kwh',
 '2026-10-01,4,3','2026-10-02,4,4','2026-10-03,5,3',
 '2026-10-04,3,2','2026-10-05,2,3','2026-10-06,6,5','2026-10-07,5,4'].join('\n');
const rows=core.parse(csv);
assert.equal(rows.length,7);
const stats=core.analyse(rows,{today:'2026-10-28'});
assert.equal(stats.type,'USER_SUPPLIED_UNVERIFIED_COMPARISON');
assert.equal(stats.days,7);
assert.equal(stats.forecastKwh,29);
assert.equal(stats.actualKwh,24);
assert.equal(stats.biasKwhPerDay,.71);
assert.equal(stats.maeKwhPerDay,1);
assert.equal(stats.weightedAbsolutePercentError,29.17);
assert.equal(stats.illustrativeAdjustment,.83);
assert.equal(core.analyse(core.parse(csv.replace('date,','\uFEFFdate,')),{today:'2026-10-28'}).days,7);
assert.throws(()=>core.parse(csv.replace('2026-10-07','2026-10-01')),/Duplicate/);
assert.throws(()=>core.parse(csv.replace('2026-10-07','2026-02-30')),/invalid date/);
assert.throws(()=>core.parse(csv.replace('2026-10-07,5,4','2026-10-07,5,NaN')),/invalid energy/);
assert.throws(()=>core.parse(csv.replace('2026-10-07,5,4','2026-10-07,5,-4')),/invalid energy/);
assert.throws(()=>core.parse(csv.replace('2026-10-07,5,4','2026-10-07,5,101')),/0–100/);
assert.throws(()=>core.parse(csv.replace('date,forecast_kwh,actual_kwh','date,actual_kwh,forecast_kwh')),/Use CSV/);
assert.throws(()=>core.analyse(rows.slice(0,6),{today:'2026-10-28'}),/At least 7/);
assert.throws(()=>core.analyse(rows,{today:'2026-09-30'}),/future/);
const high=core.analyse(core.parse(csv.replaceAll(',4',',1')),{today:'2026-10-28'});
assert(high.illustrativeAdjustment<=1.3);
const ui=fs.readFileSync('fox-solar-accuracy-ui.js','utf8');
for(const id of ['foxSolarAccuracyCsv','foxSolarAccuracyCheck','foxSolarAccuracyClear',
 'foxSolarAccuracyStatus','foxSolarAccuracyResult'])assert(ui.includes(id));
assert(ui.includes('result.hidden=true'));
assert(ui.includes('Not verified actual generation'));
for(const src of [ui,fs.readFileSync('fox-solar-accuracy-core.js','utf8')])
 for(const forbidden of ['FoxCalendarPnl','FoxActualReport','localStorage','fetch(','recordDay(','forceDischarge(','forceCharge('])
  assert(!src.includes(forbidden),'Comparison must remain read-only: '+forbidden);
for(const page of ['index.html','preview-v2.html']){
 const html=fs.readFileSync(page,'utf8');
 for(const name of ['fox-solar-accuracy-core.js','fox-solar-accuracy-ui.js'])
  assert(html.includes(name+'?v=487'),page+' must load '+name);
 assert(html.indexOf('fox-roof-weather-ui.js')<html.indexOf('fox-solar-accuracy-core.js'));
 assert(html.indexOf('fox-solar-accuracy-core.js')<html.indexOf('fox-solar-accuracy-ui.js'));
}
console.log('SOLAR ACCURACY PASS: paired-date validation, error metrics, missing/future rejection, capped suggestion and read-only isolation');
