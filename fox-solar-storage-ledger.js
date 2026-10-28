/* Source-attributed stored solar economic value.
   Actual input must come from independently verified battery/grid measurements.
   The unit of charging is AC solar diverted (before charge loss); export is AC
   actually delivered to the grid (after all losses and house demand).
   A pool with separate solar/grid inventories carries solar opportunity cost
   across day boundaries. Origin attribution (including solar-retained mode)
   is an ACCOUNTING ASSUMPTION, not direct measurement of electrons.
*/
(function(root){
'use strict';
const node=typeof module!=='undefined'&&module.exports;
const finite=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0;
const fail=reason=>({available:false,reason,days:[],totals:null});
const RETAIN_SOLAR='grid-first-house-solar-first-export';
const PRO_RATA='pro-rata';
function trace(rows,opts={}){
 const allocationMethod=opts.allocationMethod||PRO_RATA;
 if(![RETAIN_SOLAR,PRO_RATA].includes(allocationMethod))
  return fail('Unknown solar/grid source-allocation assumption');
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
 const records=[];
 let previous='',previousEnd=null;
 for(const row of rows){
  if(!row||typeof row.day!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(row.day)||
    row.day<previous||Number.isNaN(Date.parse(row.day+'T12:00:00Z')))
   return fail('Source-flow records must be chronological with valid accounting dates');
  const intervals=Number.isFinite(row.start)&&Number.isFinite(row.end)&&row.end>row.start;
  // Repeated dates are allowed only for measured time-aligned intervals,
  // never for unordered daily summaries.
  if(row.day===previous && (!intervals||previousEnd===null||row.start<previousEnd))
   return fail('Repeated accounting day requires strictly ordered, nonoverlapping meter intervals');
  if(row.start!==undefined||row.end!==undefined){
   if(!intervals)return fail('Invalid source-flow time interval');
   if(previousEnd!==null&&row.start<previousEnd)return fail('Overlapping solar-source flow intervals');
  }
  previous=row.day;previousEnd=intervals?row.end:null;
  if(!opts.simulation&&row.verified!==true)return fail('Unverified solar and battery source-flow day '+row.day);
  const energy=['solarInputAcKwh','solarStoredDcKwh','gridStoredDcKwh','houseDischargedDcKwh',
   'exportDischargedDcKwh','houseDeliveredAcKwh','exportToGridAcKwh','wearGbpPerExportKwh'];
  if(energy.some(k=>!finite(row[k]))||
   !Number.isFinite(row.directExportRateGbpPerKwh)||
   !Number.isFinite(row.achievedExportRateGbpPerKwh))
   return fail('Missing or invalid source/price/energy data on '+row.day);
  if(row.solarStoredDcKwh>row.solarInputAcKwh+1e-6)return fail('Solar storage exceeds diverted solar before charging losses');
  if(row.houseDeliveredAcKwh>row.houseDischargedDcKwh+1e-6||
    row.exportToGridAcKwh>row.exportDischargedDcKwh+1e-6)
   return fail('Delivered battery AC exceeds its DC discharge on '+row.day);
  if(!opts.simulation && (row.exportAttributionVerified!==true||
    row.solarInputVerified!==true||row.directRateVerified!==true||
    row.directExportOpportunityVerified!==true||
    row.chargingOriginVerified!==true))
   return fail('Actual profit requires validated solar-to-battery origin, battery-to-grid export, historical direct-export rate and direct-export feasibility within the site export limit');
  const previousSolar=solarDc;
  solarDc+=row.solarStoredDcKwh;
  gridDc+=row.gridStoredDcKwh;
  solarOpp+=row.solarInputAcKwh*row.directExportRateGbpPerKwh;
  const pool=solarDc+gridDc;
  const output=row.houseDischargedDcKwh+row.exportDischargedDcKwh;
  if(output>pool+1e-6)return fail('Battery discharge exceeds stored source inventory on '+row.day);
  // House-first attribution: the house uses the grid-origin inventory
  // before drawing down stored solar. A later forced export uses any
  // remaining solar-origin inventory first. This is the user's selected
  // economic bookkeeping scenario, NOT proof of physical electron origin.
  // The default pro-rata option remains available as a comparator.
  const solarShare=pool>1e-9?solarDc/pool:0;
  const solarHouseDc=allocationMethod===RETAIN_SOLAR?
   Math.max(0,row.houseDischargedDcKwh-gridDc):
   row.houseDischargedDcKwh*solarShare;
  const solarExportDc=allocationMethod===RETAIN_SOLAR?
   Math.min(row.exportDischargedDcKwh,Math.max(0,solarDc-solarHouseDc)):
   row.exportDischargedDcKwh*solarShare;
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
   openingSolarDcKwh:previousSolar,
   allocationMethod
  };
  records.push(data);
 }
 const days=[];
 const sumKeys=['solarChargeInputAcKwh','solarChargeLossKwh','solarGridExportAcKwh',
  'solarDischargeDcToGridKwh','solarHouseDischargeDcKwh',
  'solarExportDischargeLossKwh','exportSolarOpportunityGbp','houseSolarOpportunityGbp',
  'solarGridRevenueGbp','solarExportWearGbp','solarExportGainBeforeWearGbp','solarExportGainGbp'];
 for(const record of records){
  let latest=days.at(-1);
  if(!latest||latest.day!==record.day){
   latest={day:record.day,intervalCount:0,openingSolarDcKwh:record.openingSolarDcKwh,
    provenance:record.provenance,allocationMethod:record.allocationMethod};
   for(const key of sumKeys)latest[key]=0;
   days.push(latest);
  }
  for(const key of sumKeys)latest[key]+=record[key];
  latest.intervalCount++;
  latest.closingSolarDcKwh=record.closingSolarDcKwh;
  latest.closingGridDcKwh=record.closingGridDcKwh;
  latest.closingSolarOpportunityGbp=record.closingSolarOpportunityGbp;
 }
 const sum=key=>days.reduce((n,d)=>n+d[key],0);
 return {available:true,reason:null,days,records,allocationMethod,
  totals:{solarChargeInputAcKwh:sum('solarChargeInputAcKwh'),
   solarGridExportAcKwh:sum('solarGridExportAcKwh'),
   solarGridRevenueGbp:sum('solarGridRevenueGbp'),
   exportSolarOpportunityGbp:sum('exportSolarOpportunityGbp'),
   houseSolarOpportunityGbp:sum('houseSolarOpportunityGbp'),
   solarExportWearGbp:sum('solarExportWearGbp'),
   solarExportGainBeforeWearGbp:sum('solarExportGainBeforeWearGbp'),
   solarExportGainGbp:sum('solarExportGainGbp')},
  closing:{solarDcKwh:solarDc,gridDcKwh:gridDc,solarOpportunityGbp:solarOpp},
  method:allocationMethod===RETAIN_SOLAR?
   'Solar-retained accounting scenario: assign house use to grid-origin inventory first, then assign later exports to remaining solar inventory first; not directly measured origin.':
   'Pro-rata solar/grid battery inventory allocation: not directly measured origin.'};
}
const api={trace,RETAIN_SOLAR,PRO_RATA};
if(node)module.exports=api;else root.FoxSolarStorageLedger=api;
})(typeof window!=='undefined'?window:globalThis);
