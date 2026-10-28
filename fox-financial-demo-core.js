/* DEMONSTRATION ONLY. Deterministic hypothetical cash/energy ledger.
   This module never reads/writes actual reports, meter readings, browser storage,
   API credentials or inverter controls. All figures are synthetic examples. */
(function(root){
'use strict';
const node=typeof module!=='undefined'&&module.exports;
const storage=node?require('./fox-solar-storage-ledger.js'):root.FoxSolarStorageLedger;
const MONTH='2026-10';
const PARAMS=Object.freeze({
 month:MONTH,days:31,chargeEfficiency:0.94,dischargeEfficiency:0.92,
 cheapImportGbp:0.034965,peakImportGbp:0.232995,
 wearGbpPerExportKwh:0.05,capacityKwh:10,
 openingStoredKwh:2
});
const KEYS=[
 'houseDemandKwh','houseNightKwh','houseDayKwh','houseSolarKwh',
 'houseBatteryKwh','houseGridKwh','evGridKwh','solarGeneratedKwh',
 'solarBatteryInputKwh','solarExportKwh','batteryGridChargeKwh',
 'batteryChargeLossKwh','batteryDcDischargeKwh','batteryAcDeliveredKwh',
 'batteryDischargeLossKwh','forceGridExportKwh','meteredGridExportKwh',
 'gridImportKwh','houseBaselineGbp','houseActualSupplyGbp',
 'houseSavingGbp','batteryOnlySavingGbp','baselineWithoutBatteryGbp','houseGridCostGbp','houseBatteryCostGbp',
 'gridBatteryChargeCostGbp','evImportCostGbp',
 'forcedExportReceiptsGbp','solarExportReceiptsGbp',
 'totalExportReceiptsGbp','totalGridImportCostGbp','netGridCashGbp',
 'forceBatteryCostGbp','forceWearGbp','forceMarginBeforeAlternativeGbp'
];
const round=(v,n=6)=>Number(v.toFixed(n));
function makeMonth(options={}){
 const includeEV=options.includeEV!==false;
 let stored=PARAMS.openingStoredKwh;
 let storedCost=stored*PARAMS.cheapImportGbp/PARAMS.chargeEfficiency;
 const days=[];
 for(let day=1;day<=PARAMS.days;day++){
  const date=MONTH+'-'+String(day).padStart(2,'0');
  const houseNightKwh=1.45+(day%3)*.16;
  const houseDayKwh=6.15+(day%6)*.33;
  const houseDemandKwh=houseNightKwh+houseDayKwh;
  const solarGeneratedKwh=Math.max(.85,2.5+1.07*Math.sin(day*1.7)+.56*Math.cos(day*.53));
  const houseSolarKwh=Math.min(houseDayKwh*.31,solarGeneratedKwh*.53);
  const solarBatteryInputKwh=Math.min(.95,Math.max(0,solarGeneratedKwh-houseSolarKwh)*.58);
  const solarExportKwh=Math.max(0,solarGeneratedKwh-houseSolarKwh-solarBatteryInputKwh);
  const openingStoredKwh=stored,openingStoredCostGbp=storedCost;
  // Illustrative target energy, not an actual charging schedule or dispatch instruction.
  const batteryGridChargeKwh=Math.max(0,Math.min(7.5,
   (9.35-stored-solarBatteryInputKwh*PARAMS.chargeEfficiency)/PARAMS.chargeEfficiency));
  const chargeInputKwh=batteryGridChargeKwh+solarBatteryInputKwh;
  const batteryChargeLossKwh=chargeInputKwh*(1-PARAMS.chargeEfficiency);
  const newStoredKwh=chargeInputKwh*PARAMS.chargeEfficiency;
  const gridBatteryChargeCostGbp=batteryGridChargeKwh*PARAMS.cheapImportGbp;
  const availableKwh=stored+newStoredKwh;
  const availableCostGbp=storedCost+gridBatteryChargeCostGbp;
  const costPerStoredKwh=availableCostGbp/availableKwh;
  const houseBatteryKwh=Math.min(houseDayKwh-houseSolarKwh,2.75+(day%4)*.24);
  const houseBatteryDcKwh=houseBatteryKwh/PARAMS.dischargeEfficiency;
  const requestedForceExportKwh=1.75+(day%5)*.34;
  const forceGridExportKwh=Math.min(requestedForceExportKwh,
   Math.max(0,(availableKwh-houseBatteryDcKwh-1.1)*PARAMS.dischargeEfficiency));
  const forceBatteryDcKwh=forceGridExportKwh/PARAMS.dischargeEfficiency;
  const batteryDcDischargeKwh=houseBatteryDcKwh+forceBatteryDcKwh;
  const batteryAcDeliveredKwh=houseBatteryKwh+forceGridExportKwh;
  const batteryDischargeLossKwh=batteryDcDischargeKwh-batteryAcDeliveredKwh;
  const closingStoredKwh=availableKwh-batteryDcDischargeKwh;
  const houseBatteryCostGbp=houseBatteryDcKwh*costPerStoredKwh;
  const forceBatteryCostGbp=forceBatteryDcKwh*costPerStoredKwh;
  const closingStoredCostGbp=availableCostGbp-houseBatteryCostGbp-forceBatteryCostGbp;
  stored=closingStoredKwh;
  storedCost=closingStoredCostGbp;
  const houseDayGridKwh=houseDayKwh-houseSolarKwh-houseBatteryKwh;
  const houseGridKwh=houseNightKwh+houseDayGridKwh;
  const evGridKwh=includeEV&&day%3===0?8.5+(day%4):0;
  const houseBaselineGbp=houseNightKwh*PARAMS.cheapImportGbp+
   houseDayKwh*PARAMS.peakImportGbp;
  const houseGridCostGbp=houseNightKwh*PARAMS.cheapImportGbp+
   houseDayGridKwh*PARAMS.peakImportGbp;
  const houseActualSupplyGbp=houseGridCostGbp+houseBatteryCostGbp;
  const houseSavingGbp=houseBaselineGbp-houseActualSupplyGbp;
  // Battery payback assumes solar remains installed without the battery.
  // Never claim direct solar-to-house savings as a battery benefit.
  const baselineWithoutBatteryGbp=houseNightKwh*PARAMS.cheapImportGbp+
   (houseDayKwh-houseSolarKwh)*PARAMS.peakImportGbp;
  const batteryOnlySavingGbp=baselineWithoutBatteryGbp-houseActualSupplyGbp;
  const evImportCostGbp=evGridKwh*PARAMS.cheapImportGbp;
  const gridImportKwh=houseGridKwh+batteryGridChargeKwh+evGridKwh;
  const totalGridImportCostGbp=houseGridCostGbp+gridBatteryChargeCostGbp+evImportCostGbp;
  // Synthetic export rate, NOT actual Octopus historical Agile prices.
  const exportRateGbp=0.11+0.07*(1+Math.sin(day*1.09))/2;
  const forcedExportReceiptsGbp=forceGridExportKwh*exportRateGbp;
  const solarExportReceiptsGbp=solarExportKwh*exportRateGbp;
  const meteredGridExportKwh=forceGridExportKwh+solarExportKwh;
  const totalExportReceiptsGbp=forcedExportReceiptsGbp+solarExportReceiptsGbp;
  const forceWearGbp=forceGridExportKwh*PARAMS.wearGbpPerExportKwh;
  const forceMarginBeforeAlternativeGbp=forcedExportReceiptsGbp-forceBatteryCostGbp-forceWearGbp;
  const netGridCashGbp=totalExportReceiptsGbp-totalGridImportCostGbp;
  days.push({date,day,openingStoredKwh,openingStoredCostGbp,closingStoredKwh,
   closingStoredCostGbp,costPerStoredKwh,exportRateGbp,houseBatteryDcKwh,forceBatteryDcKwh,
   houseDayGridKwh,chargeInputKwh,newStoredKwh,...Object.fromEntries(
     Object.entries({houseDemandKwh,houseNightKwh,houseDayKwh,houseSolarKwh,
      houseBatteryKwh,houseGridKwh,evGridKwh,solarGeneratedKwh,
      solarBatteryInputKwh,solarExportKwh,batteryGridChargeKwh,
      batteryChargeLossKwh,batteryDcDischargeKwh,batteryAcDeliveredKwh,
      batteryDischargeLossKwh,forceGridExportKwh,meteredGridExportKwh,
      gridImportKwh,houseBaselineGbp,houseActualSupplyGbp,houseSavingGbp,batteryOnlySavingGbp,baselineWithoutBatteryGbp,
      houseGridCostGbp,houseBatteryCostGbp,gridBatteryChargeCostGbp,
      evImportCostGbp,forcedExportReceiptsGbp,solarExportReceiptsGbp,
      totalExportReceiptsGbp,totalGridImportCostGbp,netGridCashGbp,
      forceBatteryCostGbp,forceWearGbp,forceMarginBeforeAlternativeGbp})
     .map(([k,v])=>[k,round(v)]))});
 }
 // Source attribution is a separate illustrative ledger. Historical stored
 // solar must remain distinguishable from grid-charged battery energy.
 const rows=days.map(d=>({
  day:d.date,solarInputAcKwh:d.solarBatteryInputKwh,
  solarStoredDcKwh:d.solarBatteryInputKwh*PARAMS.chargeEfficiency,
  gridStoredDcKwh:d.batteryGridChargeKwh*PARAMS.chargeEfficiency,
  houseDischargedDcKwh:d.houseBatteryDcKwh,
  exportDischargedDcKwh:d.forceBatteryDcKwh,
  houseDeliveredAcKwh:d.houseBatteryKwh,
  exportToGridAcKwh:d.forceGridExportKwh,
  directExportRateGbpPerKwh:.12,
  achievedExportRateGbpPerKwh:d.exportRateGbp,
  wearGbpPerExportKwh:PARAMS.wearGbpPerExportKwh
 }));
 const solarLedger=storage.trace(rows,{simulation:true,allocationMethod:storage.RETAIN_SOLAR,
  initial:{solarDcKwh:0,gridDcKwh:PARAMS.openingStoredKwh,solarOpportunityGbp:0}});
 if(!solarLedger.available)throw Error('SIMULATED solar origin ledger cannot reconcile: '+solarLedger.reason);
 for(let i=0;i<days.length;i++){
  const attribution=solarLedger.days[i];
  const d=days[i];
  d.solarStorage=attribution;
  d.batteryPaybackSavingGbp=round(d.batteryOnlySavingGbp-attribution.houseSolarOpportunityGbp);
  d.batteryPaybackGainGbp=round(d.batteryPaybackSavingGbp+attribution.solarExportGainGbp);
 }
 const totals=Object.fromEntries(KEYS.map(key=>[key,round(
  days.reduce((n,d)=>n+d[key],0))]));
 totals.batteryPaybackSavingGbp=round(days.reduce((n,d)=>n+d.batteryPaybackSavingGbp,0));
 totals.solarStorageExportGainGbp=round(solarLedger.totals.solarExportGainGbp);
 totals.solarStorageHouseOpportunityGbp=round(solarLedger.totals.houseSolarOpportunityGbp);
 totals.batteryPaybackGainGbp=round(days.reduce((n,d)=>n+d.batteryPaybackGainGbp,0));
 return {type:'SIMULATION_ONLY',month:MONTH,params:PARAMS,includeEV,
  days,totals,openingStoredKwh:PARAMS.openingStoredKwh,
  openingStoredCostGbp:PARAMS.openingStoredKwh*PARAMS.cheapImportGbp/PARAMS.chargeEfficiency,
  closingStoredKwh:stored,closingStoredCostGbp:storedCost,solarLedger};
}
const api={makeMonth,PARAMS,KEYS};
if(node)module.exports=api;
else root.FoxFinancialDemoCore=api;
})(typeof window!=='undefined'?window:globalThis);
