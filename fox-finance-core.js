
/* All money is in pounds.
Both strategies finish with an assumed refill to the same full battery.
Wear is optional, per battery kWh discharged—not AC export. */
(function(root){
'use strict';
function settle(p,c){
 const values=[
  p.importCost,p.revenue,p.end,p.dischargeStored,
  c.capacity,c.eff,c.refillP,c.wearP
 ];
 if(!values.every(Number.isFinite)||
    c.capacity<=0||c.eff<=0||c.eff>1||
    c.refillP<0||c.wearP<0||c.wearP>100||
    p.end<0||p.end>c.capacity+1e-7||p.dischargeStored<0)
  throw Error('Invalid financial inputs');

 const refillKWh=Math.max(0,(c.capacity-p.end)/c.eff);
 const refillCost=refillKWh*c.refillP/100;
 const wearCost=p.dischargeStored*c.wearP/100;
 const beforeWear=p.importCost+refillCost-p.revenue;
 return {
  importCost:p.importCost,revenue:p.revenue,
  refillKWh,refillCost,wearCost,beforeWear,
  cost:beforeWear+wearCost
 };
}
function compare(base,opt,c){
 const b=settle(base,c),o=settle(opt,c);
 const gross=b.beforeWear-o.beforeWear;
 const extraDischarge=Math.max(
  0,opt.dischargeStored-base.dischargeStored
 );
 const wearCost=extraDischarge*c.wearP/100;
 return {
  base:b,opt:o,gross,extraDischarge,wearCost,
  net:gross-wearCost
 };
}
const api={settle,compare};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
else root.FoxFinanceCore=api;
})(typeof window!=='undefined'?window:globalThis);
