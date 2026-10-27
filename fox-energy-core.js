
/* Shared half-hour energy accounting. No device commands.
Solar, home and requested export: AC kWh.
Stored energy and minimum reserve: battery kWh.
Charge power: AC input. Discharge power: battery-side output.
Efficiency applies separately in each direction. */
(function(root){
'use strict';
function flow(c,energy,solar,home,request=0,floor=c.min){
 const dt=.5;
 const numbers=[
  c.capacity,c.eff,c.min,c.chargeKW,c.dischargeKW,c.exportKW,
  energy,solar,home,request,floor
 ];
 if(!numbers.every(Number.isFinite)||
    c.capacity<=0||c.eff<=0||c.eff>1||
    c.min<0||c.min>c.capacity||
    c.chargeKW<0||c.dischargeKW<0||c.exportKW<0||
    energy<0||energy>c.capacity+1e-7||
    solar<0||home<0||request<0||
    floor<0||floor>c.capacity)
  throw Error('Invalid shared energy input');

 const solarHome=Math.min(solar,home);
 const deficit=home-solarHome,surplus=solar-solarHome;

 const batteryHome=Math.min(
  deficit,c.dischargeKW*dt*c.eff,
  Math.max(0,(energy-c.min)*c.eff)
 );
 const grid=deficit-batteryHome;
 const afterHome=energy-batteryHome/c.eff;

 const charge=Math.min(
  surplus,c.chargeKW*dt,
  Math.max(0,(c.capacity-afterHome)/c.eff)
 );
 const solarStored=charge*c.eff;
 const afterSolar=afterHome+solarStored;

 const natural=Math.min(
  c.exportKW*dt,Math.max(0,surplus-charge)
 );
 const curtail=Math.max(0,surplus-charge-natural);

 const forced=solarStored>1e-9?0:Math.min(
  request,
  Math.max(0,c.exportKW*dt-natural),
  Math.max(0,c.dischargeKW*dt-batteryHome/c.eff)*c.eff,
  Math.max(0,(afterSolar-Math.max(c.min,floor))*c.eff)
 );
 const end=afterSolar-forced/c.eff;

 return {
  end,solarHome,batteryHome,grid,charge,solarStored,
  natural,curtail,forced,afterSolar
 };
}
const api={flow};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
else root.FoxEnergyCore=api;
})(typeof window!=='undefined'?window:globalThis);
