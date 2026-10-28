/* Read-only solar choice evaluator. No real meter, learning or inverter access.
   Estimates *incremental value of one kWh of currently available solar*
   against immediate export, battery-to-house use, and later grid export.
   The current winner is a scenario comparison, not a control instruction. */
(function(root){
'use strict';
const node=typeof module!=='undefined'&&module.exports;
const fail=reason=>({available:false,reason});
const finite=(x)=>typeof x==='number'&&Number.isFinite(x);
const near=1e-9;
function compare(s){
 if(!s||!['simulation','verified-forecast'].includes(s.source))
  return fail('Labelled simulation or verified forecast inputs required');
 const keys=['solarKwh','directRateGbp','laterRateGbp','houseAvoidedImportRateGbp',
  'chargeEfficiency','dischargeEfficiency','wearGbpPerAcKwh',
  'batteryFreeKwh','gridExportHeadroomKw','laterSlotHours',
  'batteryDischargeHeadroomKwh','protectedReserveKwh','projectedSocAt19Kwh'];
 if(keys.some(k=>!finite(s[k])))return fail('Missing price, energy, efficiency, export headroom or 19:00 reserve forecast');
 if(s.solarKwh<=0||s.batteryFreeKwh<0||s.gridExportHeadroomKw<0||
  s.laterSlotHours<=0||s.batteryDischargeHeadroomKwh<0||
  s.protectedReserveKwh<0||s.projectedSocAt19Kwh<0||
  s.chargeEfficiency<=0||s.chargeEfficiency>1||
  s.dischargeEfficiency<=0||s.dischargeEfficiency>1||
  s.wearGbpPerAcKwh<0)return fail('Invalid physical or economic scenario');
 if(s.directExportFeasible!==true)return fail('Direct solar export baseline is not confirmed feasible within the DNO limit');
 if(s.priceTimeAligned!==true)return fail('Actual or forecast Agile rate must match the intended export half-hour');
 if(s.reserveForecastVerified!==true)return fail('No validated 19:00 reserve forecast; do not recommend battery export');
 if(s.houseValueVerified!==true)return fail('Household import avoidance and expected usage not validated');
 const stored=s.solarKwh*s.chargeEfficiency;
 const delivered=stored*s.dischargeEfficiency;
 const direct={id:'export-now',label:'Export solar immediately',valueGbp:s.solarKwh*s.directRateGbp,
  solarInputKwh:s.solarKwh,deliveredKwh:s.solarKwh,feasible:true};
 const batteryFits=stored<=s.batteryFreeKwh+near;
 const reserveOk=s.projectedSocAt19Kwh>=s.protectedReserveKwh- near;
 const dischargeFits=stored<=s.batteryDischargeHeadroomKwh+near;
 const headroomOk=delivered<=s.gridExportHeadroomKw*s.laterSlotHours+near;
 const laterFeasible=batteryFits&&reserveOk&&dischargeFits&&headroomOk&&s.laterExportForecastAvailable===true;
 const houseFeasible=batteryFits&&reserveOk&&s.houseDemandForecastAvailable===true&&
  (s.houseNeedKwh===undefined||finite(s.houseNeedKwh)&&s.houseNeedKwh>=delivered-near);
 const exportLater={id:'store-export',label:'Store solar for later Agile export',
  valueGbp:laterFeasible?delivered*(s.laterRateGbp-s.wearGbpPerAcKwh):null,
  solarInputKwh:s.solarKwh,deliveredKwh:delivered,feasible:laterFeasible,
  reason:laterFeasible?null:!batteryFits?'Not enough battery charging headroom':
   !reserveOk?'Would breach protected 19:00 reserve':
   !dischargeFits?'Not enough battery energy available to export':
   !headroomOk?'Would exceed instantaneous net grid export headroom for this slot':
   'Later Agile export price not forecast'};
 const useHouse={id:'store-house',label:'Store solar for household use',
  valueGbp:houseFeasible?delivered*(s.houseAvoidedImportRateGbp-s.wearGbpPerAcKwh):null,
  solarInputKwh:s.solarKwh,deliveredKwh:delivered,feasible:houseFeasible,
  reason:houseFeasible?null:!batteryFits?'Not enough battery charging headroom':'House demand not confirmed'};
 const choices=[direct,useHouse,exportLater];
 const eligible=choices.filter(c=>c.feasible);
 const winner=eligible.reduce((a,b)=>b.valueGbp>a.valueGbp+near?b:a);
 return {available:true,source:s.source,solarKwh:s.solarKwh,
  options:choices,bestId:winner.id,bestLabel:winner.label,
  expectedValueGbp:winner.valueGbp,
  incrementalVsImmediateGbp:winner.valueGbp-direct.valueGbp,
  conversionEfficiency:s.chargeEfficiency*s.dischargeEfficiency,
  explanation:winner.id==='export-now'?
   'Storing this solar is not expected to beat immediate export under the supplied assumptions.':
   winner.id==='store-export'?
   'Expected later Agile export revenue after losses and wear exceeds immediate solar export and household use.':
   'Expected avoided household import after losses and wear exceeds both export alternatives.',
  warning:'Scenario comparison only. No live Fox ESS or Ohme connection, no dispatch commands, no trained AI. Solar origin is an accounting model. Price forecasts and household demand can change.'};
}
const api={compare};
if(node)module.exports=api;else root.FoxSolarChoiceCore=api;
})(typeof window!=='undefined'?window:globalThis);
