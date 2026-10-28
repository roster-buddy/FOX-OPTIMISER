'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function element(){return {children:[],style:{},value:'',textContent:'',append(x){this.children.push(x);},prepend(x){this.children.unshift(x);},replaceChildren(){this.children=[];},addEventListener(name,fn){this[name]=fn;}};}
const host=element(),panel=element(),input=element(),period=element(),rows=element();
panel.querySelector=selector=>({'#foxActualEnd':input,'#foxActualPeriod':period,'#foxActualRows':rows})[selector];
let start;
const ctx={Intl,Date,Set,window:{FoxActualReport:require('./fox-actual-report.js')},document:{readyState:'interactive',addEventListener(event,fn){assert.equal(event,'DOMContentLoaded');start=fn;},querySelector:()=>host,createElement:tag=>tag==='section'?panel:element()}};
vm.createContext(ctx);vm.runInContext(fs.readFileSync('fox-actual-costs.js','utf8'),ctx);
assert.equal(host.children.length,0,'Wait until report dependency has loaded');start();
assert.equal(host.children.length,1);assert.equal(rows.children.length,10);
assert(rows.children.every(row=>row.children[1].textContent==='Data unavailable'));
assert(rows.children.every(row=>row.children[2].textContent==='Data unavailable'));
assert(rows.children.some(row=>row.children[3].textContent==='No recorded readings'));
input.value='2026-10-25';input.change();
assert.match(period.textContent,/25 hours/);
assert.equal(rows.children.length,10,'Changing date replaces rows');
console.log('ACTUAL DASHBOARD PASS: dependency startup, unavailable costs, reasons and DST date changes');


input.value='2026-02-30';input.change();
assert.equal(rows.children.length,0,'Invalid date clears the previous report');
assert.match(period.textContent,/valid end date/);
input.value='2026-10-25';input.change();
assert.equal(rows.children.length,10,'Valid date restores report rows');
