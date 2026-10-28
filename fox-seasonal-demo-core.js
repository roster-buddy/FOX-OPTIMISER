/* DEMO ONLY: illustrative seasonal sensitivity applied to the fictional October ledger.
   NOT a physical solar forecast, historical Agile rates or a battery dispatch model. */
(function(root){
'use strict';
const node=typeof module!=='undefined'&&module.exports;
const demo=node?require('./fox-financial-demo-core.js'):root.FoxFinancialDemoCore;
const MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAYS=[31,28,31,30,31,30,31,31,30,31,30,31];
// Deliberately hypothetical relative solar opportunity multipliers; October=1.
// These are NOT forecasts for the user's postcode, roof, shading or weather.
const SOLAR_FACTORS=[.32,.47,.78,1.17,1.53,1.7,1.64,1.39,1.13,1,.57,.32];
const SCENARIOS=Object.freeze({low:.7,typical:1,high:1.3});
const TARGET=4800;
const DEFAULTS=Object.freeze({
 solarKwp:2.01,cheapImportPence:3.4965,peakImportPence:23.2995
});
const round=n=>Math.round(n*100)/100;
function settings(options={}){
 if(options===null||typeof options!=='object'||Array.isArray(options))throw Error('Invalid illustrative assumptions');
 const values={...DEFAULTS,...options};
 for(const [key,min,max] of [['solarKwp',.1,20],['cheapImportPence',0,100],['peakImportPence',0,100]]){
  if(typeof values[key]!=='number'||!Number.isFinite(values[key])||values[key]<min||values[key]>max)
   throw Error('Invalid illustrative '+key);
 }
 return values;
}
function calculate(kind='typical',options={}){
 if(!Object.hasOwn(SCENARIOS,kind))throw Error('Unknown illustrative solar scenario');
 const assumptions=settings(options);
 const t=demo.makeMonth({includeEV:false}).totals;
 const solarSizeRatio=assumptions.solarKwp/DEFAULTS.solarKwp;
 // First-order price sensitivity of the synthetic October house-battery ledger:
 // avoided peak imports less the purchase cost of battery energy used by home.
 // No physical rescheduling or price-based change to battery dispatch is claimed.
 const housePriceAdjustmentGbp=t.houseBatteryKwh*
  (assumptions.peakImportPence-DEFAULTS.peakImportPence)/100-
  t.houseBatteryCostGbp*(assumptions.cheapImportPence/DEFAULTS.cheapImportPence-1);
 const rows=MONTHS.map((name,i)=>{
  const days=DAYS[i],dayRatio=days/31;
  const solarFactor=SOLAR_FACTORS[i]*SCENARIOS[kind]*solarSizeRatio;
  // Most battery-house saving is modelled as cheap-grid arbitrage; a small
  // synthetic variation is assigned to solar conditions for sensitivity only.
  const house=dayRatio*(t.batteryPaybackSavingGbp*(1+.1*(solarFactor-1))+
   housePriceAdjustmentGbp);
  const stored=dayRatio*t.solarStorageExportGainGbp*solarFactor;
  const direct=dayRatio*t.directSolarUpliftGbp*solarFactor;
  return {name,month:i+1,days,solarFactor,houseGbp:round(house),
   storedSolarGbp:round(stored),directSolarGbp:round(direct),
   benefitGbp:round(house+stored+direct)};
 });
 const annual=round(rows.reduce((n,r)=>n+r.benefitGbp,0));
 // Forecast from November 2026. Repeat identical hypothetical monthly values,
 // no price inflation, real degradation or investment costs beyond target.
 let remaining=TARGET,date=null,elapsedMonths=0;
 for(let n=0;n<60*12;n++){
  const monthIndex=(10+n)%12;
  remaining-=rows[monthIndex].benefitGbp;
  if(remaining<=0){elapsedMonths=n+1;
   const year=2026+Math.floor((10+n)/12);
   const month=(10+n)%12+1;
   date=year+'-'+String(month).padStart(2,'0');break;}
 }
 return {type:'SIMULATION_ONLY',scenario:kind,targetGbp:TARGET,assumptions,
  annualBenefitGbp:annual,monthly:rows,paybackMonth:date,monthsToPayback:date?elapsedMonths:null,
  startingMonth:'2026-11',basis:'Synthetic October 2026 financial ledger, hypothetical seasonal factors and first-order tariff/solar size sensitivities; not actual readings, validated solar/weather forecast or physical dispatch'};
}
function compare(options={}){
 const scenarios=['low','typical','high'].map(kind=>calculate(kind,options));
 return {type:'SIMULATION_ONLY',scenarios,
  monthly:MONTHS.map((name,i)=>({name,month:i+1,
   low:scenarios[0].monthly[i].benefitGbp,
   typical:scenarios[1].monthly[i].benefitGbp,
   high:scenarios[2].monthly[i].benefitGbp}))};
}
const api={calculate,compare,settings,DEFAULTS,SCENARIOS,MONTHS,SOLAR_FACTORS};
if(node)module.exports=api;else root.FoxSeasonalDemoCore=api;
})(typeof window!=='undefined'?window:globalThis);
