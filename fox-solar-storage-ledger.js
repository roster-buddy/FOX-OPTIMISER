/* Source-attributed stored solar economic value.
   Actual input must come from independently verified battery/grid measurements.
   The unit of charging is AC solar diverted (before charge loss); export is AC
   actually delivered to the grid (after all losses and house demand).
   A pool with separate solar/grid inventories carries solar opportunity cost
   across day boundaries. PRO-RATA origin attribution is a MODEL, not a sensor.
*/
(function(root){
'use strict';
const node=typeof module!=='undefined'&&module.exports;
const finite=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0;
const fail=reason=>({available:false,reason,days:[],totals:null});
const n0=Object.freeze({solarDcKwh:0,gridDcKwh:0,solarOpportunityGbp:0});
function trace(rows,opts={}){
 if(!Array.isArray(rows)||!rows.length)return fail('No verified solar and battery source-flow history');
 const verified=opts.verified===true;
 if(!verified&&opts.simulation!==true)return fail('Source splits and historic direct-export rates must be verified');
 if(opts.initial && (!finite(opts.initial.solarDcKwh)||!finite(opts.initial.gridDcKwh)||
    !finite(opts.initial.solarOpportunityGbp)))return fail('Invalid opening battery source inventory');
 let solarDc=opts.initial?.solarDcKwh??0;
 let gridDc=opts.initial?.gridDcKwh??0;
 let solarOpp=opts.initial?.solarOpportunityGbp??0;
 if(solarDc===0&&solarOpp>1e-9)return fail('Opening solar opportunity cost without stored solar');
 if(solarDc>0&&!opts.initial?.sourceHistoryVerified&&!opts.simulation)
  return fail('Opening solar battery inventory must have verified origin and opportunity value');
 const days=[];
 let previous='';
 for(const row of rows){
  if(!row||typeof row.day!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(row.day)||
    row.day<=previous||Number.isNaN(Date.parse(row.day+'T12:00:00Z')))
   return fail('Daily flow records must be in chronological order with valid distinct dates');
  previous=row.day;
  if(!opts.simulation&&row.verified!==true)return fail('Unverified solar and battery source-flow day '+row.day);
  const fields=['solarInputAcKwh','solarStoredDcKwh','gridStoredDcKwh','houseDischargedDcKwh',
   'exportDischargedDcKwh','houseDeliveredAcKwh','exportToGridAcKwh',
   'directExportRateGbpPerKwh','achievedExportRateGbpPerKwh','wearGbpPerExportKwh'];
  if(fields.some(k=>!finite(row[k])))return fail('Missing or invalid source/price/energy data on '+row.day);
  if(row.solarStoredDcKwh>row.solarInputAcKwh+1e-6)return fail('Solar storage exceeds diverted solar before charging losses');
  if(row.houseDeliveredAcKwh>row.houseDischargedDcKwh+1e-6||
    row.exportToGridAcKwh>row.exportDischargedDcKwh+1e-6)
   return fail('Delivered battery AC exceeds its DC discharge on '+row.day);
  if(!opts.simulation && (row.exportAttributionVerified!==true||
    row.solarInputVerified!==true||row.directRateVerified!==true))
   return fail('Solar input, metered battery-origin export and alternative tariff must be verified');
  const previousSolar=solarDc;
  solarDc+=row.solarStoredDcKwh;
  gridDc+=row.gridStoredDcKwh;
  solarOpp+=row.solarInputAcKwh*row.directExportRateGbpPerKwh;
  const pool=solarDc+gridDc;
  const output=row.houseDischargedDcKwh+row.exportDischargedDcKwh;
  if(output>pool+1e-6)return fail('Battery discharge exceeds stored source inventory on '+row.day);
  const solarShare=pool>1e-9?solarDc/pool:0;
  const solarHouseDc=row.houseDischargedDcKwh*solarShare;
  const solarExportDc=row.exportDischargedDcKwh*solarShare;
  const houseSolarOpportunityGbp=solarDc>1e-9?solarOpp*(solarHouseDc/solarDc):0;
  const exportSolarOpportunityGbp=solarDc>1e-9?solarOpp*(solarExportDc/solarDc):0;
  const solarGridExportAcKwh=row.exportDischargedDcKwh>1e-9?
    row.exportToGridAcKwh*(solarExportDc/row.exportDischargedDcKwh):0;
  const solarGridRevenueGbp=solarGridExportAcKwh*row.achievedExportRateGbpPerKwh;
  const solarExportWearGbp=solarGridExportAcKwh*row.wearGbpPerExportKwh;
  const solarExportGainBeforeWearGbp=solarGridRevenueGbp-exportSolarOpportunityGbp;
  const solarExportGainGbp=solarExportGainBeforeWearGbp-solarExportWearGbp;
  solarDc-=solarHouseDc+solarExportDc;
  gridDc-=(row.houseDischargedDcKwh-solarHouseDc)+(row.exportDischargedDcKwh-solarExportDc);
  solarOpp-=houseSolarOpportunityGbp+exportSolarOpportunityGbp;
  if(solarDc < -1e-5||gridDc < -1e-5||solarOpp < -1e-5)
   return fail('Battery source inventory reconciliation failed on '+row.day);
  solarDc=Math.max(0,solarDc);gridDc=Math.max(0,gridDc);solarOpp=Math.max(0,solarOpp);
  const data={
   day:row.day,solarChargeInputAcKwh:row.solarInputAcKwh,
   solarChargeLossKwh:row.solarInputAcKwh-row.solarStoredDcKwh,
   solarGridExportAcKwh,solarDischargeDcToGridKwh:solarExportDc,
   solarHouseDischargeDcKwh:solarHouseDc,
   exportSolarOpportunityGbp,houseSolarOpportunityGbp,
   solarGridRevenueGbp,solarExportWearGbp,solarExportGainBeforeWearGbp,solarExportGainGbp,
   closingSolarDcKwh:solarDc,closingGridDcKwh:gridDc,
   closingSolarOpportunityGbp:solarOpp,
   provenance:opts.simulation?'SIMULATED':'VERIFIED_INPUTS_WITH_MODELLED_ORIGIN_ALLOCATION',
   // Solar baseline includes all solar input later allocated to this export,
   // including the input lost in charging and discharging.
   solarExportDischargeLossKwh:solarExportDc-solarGridExportAcKwh,
   openingSolarDcKwh:previousSolar
  };
  days.push(data);
 }
 const sum=key=>days.reduce((n,d)=>n+d[key],0);
 return {available:true,reason:null,days,
  totals:{solarChargeInputAcKwh:sum('solarChargeInputAcKwh'),
   solarGridExportAcKwh:sum('solarGridExportAcKwh'),
   solarGridRevenueGbp:sum('solarGridRevenueGbp'),
   exportSolarOpportunityGbp:sum('exportSolarOpportunityGbp'),
   houseSolarOpportunityGbp:sum('houseSolarOpportunityGbp'),
   solarExportWearGbp:sum('solarExportWearGbp'),
   solarExportGainBeforeWearGbp:sum('solarExportGainBeforeWearGbp'),
   solarExportGainGbp:sum('solarExportGainGbp')},
  closing:{solarDcKwh:solarDc,gridDcKwh:gridDc,solarOpportunityGbp:solarOpp},
  method:'Pro-rata model of measured solar/grid battery inventory. Cannot directly sense electron origin.'};
}
const api={trace};
if(node)module.exports=api;else root.FoxSolarStorageLedger=api;
})(typeof window!=='undefined'?window:globalThis);
