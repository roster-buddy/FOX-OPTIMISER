'use strict';
const assert=require('node:assert/strict');
const ledger=require('./fox-cost-ledger.js');
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,a+' != '+b);
const night={start:0,batDelivered:2,rows:[{segments:[
 {hours:.5,batteryKW:4,evKW:2,gridKW:7}
]}]};
const c={capacity:9,eff:1,refillP:7,wearP:0};
const steps=[
 {utc:'2026-10-28T05:30:00Z',house:2,ev:1,solarHome:1,
  batteryHome:1,forced:1,naturalExport:0,chargeGrid:0,solarStored:0,
  importP:28,price:50,grid:1,ending:2},
 {utc:'2026-10-28T06:00:00Z',house:1,ev:0,solarHome:1,
  batteryHome:0,forced:0,naturalExport:1,chargeGrid:0,solarStored:0,
  importP:28,price:10,grid:0,ending:2}
];
let r=ledger.summarise(c,steps,night,2,1);
close(r.nightBatteryCost,.14);close(r.ev.gridCost,.35);
close(r.solarExport,1);close(r.batteryExport,1);
close(r.solarRevenue,.1);close(r.batteryRevenue,.5);
close(r.cashBalance,.11);
close(r.house.solar,2);close(r.house.battery,1);
close(r.house.avoidedCost,.84);close(r.house.batteryCost,.07);
close(r.house.saving,.77);close(r.ev.battery,0);
close(r.exportMargin,.53);close(r.benefit,1.30);
close(r.openingCost+r.batteryChargeCost,r.batteryCostUsed+r.closingCost);

// Daytime solar stored in the battery dilutes its purchased-energy cost.
const solarStep={...steps[1],solarHome:0,house:0,naturalExport:0,
 solarStored:2,ending:6};
const discharge={...steps[0],house:1,ev:0,solarHome:0,
 batteryHome:1,forced:1,grid:0,ending:4};
r=ledger.summarise({...c,wearP:5},[solarStep,discharge],night,2,1);
close(r.house.batteryCost, .28/6);
close(r.exportBatteryCost,.28/6);
close(r.wear,.1);
close(r.benefitAfterWear,r.benefit-.1);

// Conversion losses belong in the cost of energy delivered from the battery.
const lossNight={start:0,batDelivered:10/ .9,rows:[{segments:[
 {hours:3,batteryKW:10/.9/3,evKW:0,gridKW:10/.9/3}
]}]};
r=ledger.summarise({...c,capacity:10,eff:.9},[
 {...steps[0],house:.9,ev:0,solarHome:0,batteryHome:.9,
 forced:.9,grid:0,ending:8}
],lossNight,0,.9);
close(r.house.batteryCost,.07/.9/.9*.9);
close(r.closingStored,8);
close(r.openingCost+r.batteryChargeCost,r.batteryCostUsed+r.closingCost);

assert.throws(()=>ledger.summarise(c,[{...steps[0],ending:3}],night,2,1),/balance/);
assert.throws(()=>ledger.summarise(c,[],night,2,1),/period/);
assert.throws(()=>ledger.summarise({...c,eff:0},steps,night,2,1),/efficiency/);
// Exercise the actual overnight model and daytime scheduler together.
const overnight=require('./fox-overnight-core.js');
const scheduler=require('./fox-schedule-core.js');
const adapter=require('./fox-charge-adapter.js');
const now=Date.parse('2026-10-27T18:00:00Z');
const cfg={capacity:9,soc:5,target:100,evPercent:15,evCapacity:61.7,
 evKw:6.63,evEfficiency:90,gridKw:8.3,houseKw:.4,batteryKw:5,
 batteryEfficiency:90,evConnect:'23:30',evDeadline:'04:00'};
const n=overnight.simulate(cfg,now);
const dc={capacity:9,initial:9,eff:.9,min:.45,target:1.8,forcedFloor:1.8,
 chargeKW:5,dischargeKW:5,exportKW:3.5,refillP:7,wearP:0};
const day=Array.from({length:35},(_,i)=>{
 const clock=5.5+i*.5;
 return adapter.apply({utc:new Date(n.end+i*1800000).toISOString(),clock,
  house:.16,solar:clock>=10&&clock<16?.125:0,price:clock>=16?40:15,
  allowExport:clock<19,checkpoint:clock===18.5},
  {mode:'unknown',confirmed:false,evSchedule:[],smartWindows:[],
   cheapP:7,peakP:28,gridKW:8.3,evMaxKW:6.63});
});
const plan=scheduler.solve(dc,day);assert.ok(plan.ok&&plan.valid);
r=ledger.summarise(dc,plan.steps,n,.45,.9);
close(r.exportRevenue,plan.revenue);
close(r.nightBattery,9.5);close(r.nightBatteryCost,.665);
close(r.ev.gridCost,61.7*.15/.9*.07);close(r.ev.battery,0);
close(r.openingCost+r.batteryChargeCost,r.batteryCostUsed+r.closingCost);
assert.ok(r.house.saving>0);
console.log('COST LEDGER PASS: charging cash flow, EV costs, export split, avoided imports, stored solar, losses and conserved battery costs');

