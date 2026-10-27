
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('app.js','utf8');
const code=source.slice(
 source.indexOf('function chargingPolicyV420('),
 source.indexOf('function renderFinancialComparison(')
);
const now=Date.parse('2026-10-27T12:00:00Z');
const elements={};
const el=id=>elements[id]||(elements[id]={textContent:''});
class Clock extends Date { static now(){return now;} }
const c={
 Date:Clock,
 window:{
  FoxScheduleCore:require('./fox-schedule-core.js'),
  FoxEnergyCore:require('./fox-energy-core.js'),
  FoxFinanceCore:require('./fox-finance-core.js')
 },
 settings:{capacity:10,soc:80,efficiency:90,cheapImport:7,peakImport:28},
 V2:{eveningMinimum:.05,eveningTarget:.2,estimatedChargeKw:5,
     batteryDischargeKw:5,gridExportLimitKw:3.5},
 financialWearP:0,prices:[],priceSource:'live',lastPlan:[],
 v4LastPriceCheck:now,v4LastSolarCheck:now,
 solarForecastActive:false,solarForecastHours:new Map(),
 hour:t=>new Date(t).getUTCHours(),
 mins:t=>new Date(t).getUTCMinutes(),
 cheap:()=>false,solarKwh:()=>0,loadKwh:()=>.1,
 document:{getElementById:el},$:el,
 render:()=>{},renderEmpty:()=>{},
 renderFinancialComparison:()=>{}
};
c.window.FoxChargeAdapter=require('./fox-charge-adapter.js');
vm.createContext(c);
vm.runInContext(code,c);
const fresh=c.forecastFreshV320;
assert(fresh(now,now));
assert(fresh(now-3599999,now));
for(const t of [null,undefined,NaN,now+1,now-3600000])
 assert.equal(fresh(t,now),false);

function reset(){
 c.prices=Array.from({length:14},(_,i)=>({
  start:now+i*1800000,rate:i===10?50:10
 }));
 c.lastPlan=[];
 c.v4LastPriceCheck=now;
 c.v4LastSolarCheck=now;
 c.solarForecastActive=false;
 c.priceSource='live';
}
reset();
c.plan();
assert(c.lastPlan.some(x=>x.action==='Export'));
const checkpoint=c.lastPlan.find(x=>x.start+1800000===
 Date.parse('2026-10-27T19:00:00Z'));
assert(checkpoint.socEnd>=20-1e-7);

c.v4LastPriceCheck=now-3600000;
c.plan();
assert.equal(c.lastPlan.length,0);
assert.match(el('priceStatus').textContent,/STALE/);

reset();
c.prices=[{start:now-1800000,rate:100}];
c.plan();
assert.equal(c.lastPlan.length,0);
assert.match(el('priceStatus').textContent,/COVERAGE EXPIRED/);

reset();
c.prices.unshift({start:now-1800000,rate:100});
c.plan();
assert(c.lastPlan.every(x=>x.start>=now));

for(const stale of [true,false]){
 reset();
 c.solarForecastActive=true;
 c.solarForecastHours=new Map(Array.from({length:24},(_,i)=>[
  now+i*3600000,0
 ]));
 if(stale)c.v4LastSolarCheck=now-3600000;
 else c.solarForecastHours.delete(now+8*3600000);
 c.plan();
 assert.equal(c.solarForecastActive,false);
 assert.equal(c.solarForecastHours.size,0);
 assert.equal(c.v4LastSolarCheck,stale?now-3600000:now);
 assert.match(el('solarForecastStatus').textContent,/estimated solar curve/);
}
reset();
c.solarForecastActive=true;
c.solarForecastHours=new Map(Array.from({length:24},(_,i)=>[
 now+i*3600000,0
]));
c.plan();
assert.equal(c.solarForecastActive,true);
console.log('FRESHNESS PASS: expiry, future timestamps, started slots, solar fallback, recovery and 19:00 reserve');
