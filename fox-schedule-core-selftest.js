
'use strict';
const assert=require('node:assert/strict');
const core=require('./fox-schedule-core.js');
const c={
 capacity:10,eff:.9,min:.5,initial:8,target:2,forcedFloor:2,
 chargeKW:5,dischargeKW:5,exportKW:3.5,refillP:7,wearP:0
};
const slots=Array.from({length:14},(_,i)=>({
 utc:new Date(Date.UTC(2026,9,27,12)+i*1800000).toISOString(),
 clock:12+i/2,solar:0,house:.1,
 price:i===10?50:i===9?40:10,importP:28,
 allowExport:true,checkpoint:i===13
}));
const base=core.replay(c,slots);
const opt=core.solve(c,slots);
assert(opt.ok&&opt.valid);
assert(opt.financial.cost<base.financial.cost);
assert(opt.steps[10].forced>0);
assert(opt.at19>=2-1e-7);
const replay=core.replay(c,slots,opt.steps.map(s=>s.forced));
assert(Math.abs(replay.end-opt.end)<1e-8);
assert(Math.abs(replay.financial.cost-opt.financial.cost)<1e-8);
assert.equal(core.solve({...c,wearP:100},slots).forced,0);
assert.equal(core.solve(c,slots.map(s=>({
 ...s,checkpoint:false
}))).forced,0);
assert.throws(()=>core.solve(c,slots.filter((_,i)=>i!==3)),/gaps/);
assert.throws(()=>core.solve(c,[
 ...slots.slice(0,3),slots[2],...slots.slice(3)
]),/duplicate/);
const night=core.replay({...c,initial:1},[{
 ...slots[0],cheap:true,solar:0,house:.3
}]);
assert(Math.abs(night.end-3.25)<1e-8);
assert(Math.abs(night.grid-2.8)<1e-8);
console.log('SCHEDULE PASS: reserve, prices, wear, replay and gaps');

const historical=require('./fox-backtest-v22.js');
const hc={
 capacity:10.24,load:.3,chargeKW:5,dischargeKW:5,exportKW:3.5,
 pv:2.01,inverterKW:1.5,pr:.82,eff:.95,importP:28,nightP:7,
 min:5,target:20,soc:100,derate:0,tilt:35,bearing:110,
 scenario:'low',wearP:5
};
const hs=historical.slotsFor('2026-10-18');
const pv=hs.map(()=>0);
const rates=hs.map(s=>s.clock>=16&&s.clock<19?40:8);
const h=historical.simulate(hc,hs,pv,rates,true);
const shared=core.solve({
 ...hc,min:.512,initial:10.24,target:2.048,
 forcedFloor:.512,refillP:7
},hs.map((s,i)=>({
 ...s,solar:0,house:.15,price:rates[i],importP:28,
 allowExport:s.clock<19,checkpoint:s.clock===18.5
})));
assert(h.ok&&shared.ok);
assert.deepEqual(
 h.steps.map(s=>s.forced),shared.steps.map(s=>s.forced)
);
console.log('ADAPTER PASS: historical and shared scheduler agree');

const fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('app.js','utf8');
const code=source.slice(
 source.indexOf('function simulateV2('),
 source.indexOf('function renderFinancialComparison(')
);
const status={textContent:''};
const context={
 window:{
  FoxScheduleCore:core,
  FoxEnergyCore:require('./fox-energy-core.js'),
  FoxFinanceCore:require('./fox-finance-core.js')
 },
 settings:{
  capacity:10,soc:80,efficiency:90,cheapImport:7,peakImport:28
 },
 V2:{
  eveningMinimum:.05,eveningTarget:.2,estimatedChargeKw:5,
  batteryDischargeKw:5,gridExportLimitKw:3.5
 },
 financialWearP:0,
 prices:slots.map(s=>({start:Date.parse(s.utc),rate:s.price})),
 priceSource:'sample',lastPlan:[],
 hour:t=>new Date(t).getUTCHours(),
 mins:t=>new Date(t).getUTCMinutes(),
 cheap:()=>false,solarKwh:()=>0,loadKwh:()=>.1,
 document:{getElementById:()=>status},$:()=>status,
 render:()=>{},renderEmpty:()=>{},
 renderFinancialComparison:()=>{}
};
vm.createContext(context);
vm.runInContext(code+';plan();',context,{timeout:2000});
assert(context.lastPlan.some(s=>s.action==='Export'));
context.financialWearP=100;
vm.runInContext('plan()',context,{timeout:2000});
assert(!context.lastPlan.some(s=>s.action==='Export'));
context.prices.splice(2,1);
vm.runInContext('plan()',context,{timeout:2000});
assert.equal(context.lastPlan.length,0);
assert.match(status.textContent,/gaps/);
console.log('DASHBOARD PASS: wear changes selection; gaps clear plans');
