'use strict';
const assert=require('node:assert/strict');
const {monthBenefits}=require('./fox-calendar-pnl.js');
const map=new Map([
 ['2026-10-01',{savings:{available:true,value:1.5},forceExport:{available:true,value:2}}],
 ['2026-10-02',{savings:{available:true,value:-.5},forceExport:{available:false,value:null}}],
 ['2026-10-03',{savings:{available:false,value:null},forceExport:{available:true,value:0}}],
 ['2026-11-01',{savings:{available:true,value:100},forceExport:{available:true,value:100}}]
]);
let m=monthBenefits(map,2026,9);
assert.equal(m.days,31);
assert.equal(m.savings,1);
assert.equal(m.savingsDays,2);
assert.equal(m.forced,2);
assert.equal(m.forcedDays,2);
assert.equal(monthBenefits(new Map(),2026,9).forced,null);
assert.equal(monthBenefits(new Map(),2026,9).savings,null);
assert.equal(monthBenefits(new Map(),2028,1).days,29);
assert.equal(monthBenefits(new Map([['2026-10-07',{savings:{available:true,value:0},forceExport:{available:true,value:0}}]]),2026,9).savings,0);
const solarCases=new Map([
 ['2026-10-01',{solarStorage:{available:true,value:.15}}],
 ['2026-10-02',{solarStorage:{available:true,value:-.03}}],
 ['2026-10-03',{solarStorage:{available:false,value:null}}]
]);
const sg=monthBenefits(solarCases,2026,9);
assert.equal(sg.solarDays,2);
assert(Math.abs(sg.solarGain-.12)<1e-10,'Monthly solar gain must include negative days, not just earnings');
assert.equal(monthBenefits(new Map(),2026,9).solarGain,null);
console.log('MONTH BENEFIT PASS: independent complete-day subtotals, losses/zero, empty and DST-month coverage');
