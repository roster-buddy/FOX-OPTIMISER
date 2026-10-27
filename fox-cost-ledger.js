/* Forecast cost ledger. Pounds and AC kWh unless labelled stored.
Opening battery energy is valued at the entered replacement import cost.
Solar generation has zero purchased-energy cost; stored costs use a weighted pool.
No meter data, device control or claim of measured profit. */
(function(root){
'use strict';
function summarise(c,steps,night,openingStored,nightEff){
 const finite=(x,label)=>{
  if(!Number.isFinite(x))throw Error('Invalid ledger '+label);
  return x;
 };
 const nonnegative=(x,label)=>{
  finite(x,label);if(x<0)throw Error('Negative ledger '+label);return x;
 };
 nonnegative(c.capacity,'capacity');
 if(!(c.eff>0&&c.eff<=1&&nightEff>0&&nightEff<=1))
  throw Error('Invalid ledger efficiency');
 nonnegative(c.refillP,'refill rate');
 nonnegative(openingStored,'opening energy');
 if(!steps.length||!night.rows?.length)throw Error('Complete ledger period required');
 const close=(a,b,label)=>{
  if(Math.abs(a-b)>1e-6)throw Error('Ledger does not balance: '+label);
 };
 const flow=()=>({solar:0,battery:0,grid:0,gridCost:0,
  avoidedCost:0,batteryCost:0,demand:0});
 const house=flow(),ev=flow();
 let nightBattery=0,nightEV=0,nightHouse=0;
 for(const row of night.rows){
  for(const s of row.segments){
   nonnegative(s.hours,'night duration');
   const battery=nonnegative(s.batteryKW,'night battery power')*s.hours;
   const car=nonnegative(s.evKW,'night EV power')*s.hours;
   const home=finite(s.gridKW,'night grid power')*s.hours-battery-car;
   if(home< -1e-7)throw Error('Invalid night household balance');
   nightBattery+=battery;nightEV+=car;nightHouse+=Math.max(0,home);
  }
 }
 close(nightBattery,night.batDelivered,'night battery import');
 const rate=c.refillP/100;
 const openingCost=openingStored*rate/nightEff;
 let stored=openingStored+nightBattery*nightEff;
 let poolCost=openingCost+nightBattery*rate;
 let dayBattery=0,dayBatteryCost=0,natural=0,forced=0,
  solarRevenue=0,batteryRevenue=0,exportBatteryCost=0,
  storedDischarge=0,solarStored=0,dayGridCost=0;
 house.grid=house.demand=nightHouse;house.gridCost=nightHouse*rate;
 ev.grid=ev.demand=nightEV;ev.gridCost=nightEV*rate;
 for(const s of steps){
  const home=nonnegative(s.house,'household energy');
  const car=nonnegative(s.ev??0,'EV energy');
  const solarUse=nonnegative(s.solarHome,'direct solar use');
  const batteryUse=nonnegative(s.batteryHome,'battery self-use');
  const batteryExport=nonnegative(s.forced,'battery export');
  const naturalExport=nonnegative(s.naturalExport,'solar export');
  const gridCharge=nonnegative(s.chargeGrid??0,'grid charge');
  const solarCharge=nonnegative(s.solarStored,'stored solar');
  const importRate=finite(s.importP,'import tariff')/100;
  const exportRate=finite(s.price,'export tariff')/100;
  // Allocation convention: direct solar serves the house before the EV.
  // This is an accounting assumption, not measured circuit attribution.
  const houseSolar=Math.min(home,solarUse);
  const evSolar=solarUse-houseSolar;
  const houseBattery=Math.min(home-houseSolar,batteryUse);
  const evBattery=batteryUse-houseBattery;
  if(evSolar+evBattery>car+1e-7)throw Error('Invalid EV source allocation');
  const discharge=(batteryUse+batteryExport)/c.eff;
  if(discharge>stored+1e-6)throw Error('Battery discharge exceeds stored energy');
  const unitCost=stored>1e-9?poolCost/stored:0;
  const houseBatteryCost=houseBattery/c.eff*unitCost;
  const evBatteryCost=evBattery/c.eff*unitCost;
  exportBatteryCost+=batteryExport/c.eff*unitCost;
  poolCost-=discharge*unitCost;
  stored-=discharge;
  for(const [item,solar,battery,batteryCost,demand] of [
   [house,houseSolar,houseBattery,houseBatteryCost,home],
   [ev,evSolar,evBattery,evBatteryCost,car]
  ]){
   const grid=Math.max(0,demand-solar-battery);
   item.solar+=solar;item.battery+=battery;item.grid+=grid;
   item.demand+=demand;item.gridCost+=grid*importRate;
   item.avoidedCost+=(solar+battery)*importRate;
   item.batteryCost+=batteryCost;
  }
  close(home+car-solarUse-batteryUse+gridCharge,s.grid,'day grid import');
  dayGridCost+=s.grid*importRate;
  dayBattery+=gridCharge;dayBatteryCost+=gridCharge*importRate;
  stored+=solarCharge+gridCharge*c.eff;
  poolCost+=gridCharge*importRate;
  close(stored,s.ending,'stored energy');
  if(stored< -1e-7||stored>c.capacity+1e-6)
   throw Error('Ledger battery capacity exceeded');
  natural+=naturalExport;forced+=batteryExport;
  solarRevenue+=naturalExport*exportRate;
  batteryRevenue+=batteryExport*exportRate;
  storedDischarge+=discharge;solarStored+=solarCharge;
 }
 const nightBatteryCost=nightBattery*rate;
 const batteryChargeCost=nightBatteryCost+dayBatteryCost;
 const exportRevenue=solarRevenue+batteryRevenue;
 const batteryCostUsed=house.batteryCost+ev.batteryCost+exportBatteryCost;
 close(openingCost+batteryChargeCost,batteryCostUsed+poolCost,'battery cost allocation');
 close(house.gridCost+ev.gridCost+dayBatteryCost,
  (nightHouse+nightEV)*rate+dayGridCost,'purchased electricity');
 for(const item of [house,ev]){
  item.supplyCost=item.batteryCost; // Direct solar has zero purchased-energy cost.
  item.saving=item.avoidedCost-item.supplyCost;
  item.gridOnlyCost=item.gridCost+item.avoidedCost;
  item.modelledSupplyCost=item.gridCost+item.supplyCost;
 }
 const exportMargin=exportRevenue-exportBatteryCost;
 const benefit=exportMargin+house.saving+ev.saving;
 const wear=storedDischarge*(c.wearP??0)/100;
 return {
  start:night.start,end:Date.parse(steps.at(-1).utc)+1800000,
  house,ev,nightBattery,nightBatteryCost,dayBattery,dayBatteryCost,
  batteryChargeCost,solarExport:natural,batteryExport:forced,
  solarRevenue,batteryRevenue,exportRevenue,exportBatteryCost,exportMargin,
  cashBalance:exportRevenue-batteryChargeCost-ev.gridCost,
  openingStored,openingCost,closingStored:stored,closingCost:poolCost,
  batteryCostUsed,solarStored,benefit,wear,benefitAfterWear:benefit-wear
 };
}
const api={summarise};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
else root.FoxCostLedger=api;
})(typeof window!=='undefined'?window:globalThis);
