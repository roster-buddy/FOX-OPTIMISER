
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const overnight=require('./fox-overnight-core.js');
const source=fs.readFileSync('app.js','utf8');
const a=source.indexOf('window.foxTargetInputsV360=function(');
const b=source.indexOf('function renderForecastSocV330(',a);
assert(a>=0&&b>a);
const now=Date.parse('2026-10-27T18:00:00Z');
const night=overnight.windowFor(now);
const fmt=new Intl.DateTimeFormat('en-GB',{
 timeZone:'Europe/London',hour:'2-digit',minute:'2-digit',hourCycle:'h23'
});
const time=t=>fmt.format(new Date(t));
class Clock extends Date {static now(){return now;}}
const c={
 Date:Clock,
 window:{FoxOvernightCore:overnight},
 priceSource:'live',v4LastPriceCheck:now,
 solarForecastActive:true,v4LastSolarCheck:now,
 solarForecastHours:new Map(),prices:[],
 forecastFreshV320:(t,n)=>Number.isFinite(t)&&t<=n&&n-t<3600000,
 date:t=>new Date(t).toISOString().slice(0,10),time,
 hour:t=>Number(time(t).split(':')[0]),
 mins:t=>Number(time(t).split(':')[1]),
 solarKwh:()=>0,loadKwh:()=>.1,
 settings:{capacity:10,efficiency:90,peakImport:28,cheapImport:7},
 V2:{estimatedChargeKw:5,batteryDischargeKw:5,gridExportLimitKw:3.5},
 financialWearP:0
};
function reset(){
 c.prices=Array.from({length:36},(_,i)=>({
  start:night.end+i*1800000,rate:30
 }));
 c.solarForecastHours=new Map(c.prices.map(x=>[
  Math.floor(x.start/3600000)*3600000,0
 ]));
 c.v4LastPriceCheck=now;
 c.v4LastSolarCheck=now;
}
vm.createContext(c);
vm.runInContext(source.slice(a,b),c);
reset();
let r=c.window.foxTargetInputsV360(night);
assert(r.available);
assert.equal(r.slots.length,36);
assert.equal(r.slots.filter(x=>x.checkpoint).length,1);
assert(r.slots.every(x=>x.solar===0),'Zero solar is valid');
c.prices.splice(8,1);
r=c.window.foxTargetInputsV360(night);
assert.equal(r.available,false);
assert.match(r.reason,/Waiting for published export prices/);
assert.match(r.reason,/Europe\/London/);
reset();
c.solarForecastHours.delete(Math.floor(night.end/3600000)*3600000);
r=c.window.foxTargetInputsV360(night);
assert.equal(r.available,false);
assert.match(r.reason,/Weather forecast coverage missing/);
reset();
c.v4LastPriceCheck=now-3600000;
assert.equal(c.window.foxTargetInputsV360(night).available,false);
reset();
c.v4LastSolarCheck=now-3600000;
assert.equal(c.window.foxTargetInputsV360(night).available,false);
reset();
c.prices.push({...c.prices[0]});
assert.match(c.window.foxTargetInputsV360(night).reason,/Duplicate/);
console.log('TARGET INPUT PASS: separate price/weather gaps, zero solar, stale data and duplicate intervals');
