/* Read-only battery investment payback. NEVER add gross export to savings.
   Only validated house-battery avoided imports and authenticated incremental
   force-export profit count. A learning-based date requires actual history. */
(function(root){
'use strict';
const node=typeof module!=='undefined'&&module.exports;
const DEFAULT_TARGET_GBP=4800;
const validateDate=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&
 !Number.isNaN(Date.parse(s+'T12:00:00Z'))&&new Date(s+'T12:00:00Z').toISOString().slice(0,10)===s;
const daysBetween=(a,b)=>(Date.parse(b+'T12:00:00Z')-Date.parse(a+'T12:00:00Z'))/86400000;
const addDays=(a,days)=>new Date(Date.parse(a+'T12:00:00Z')+days*86400000).toISOString().slice(0,10);
const unavailable=(reason,target=DEFAULT_TARGET_GBP)=>({available:false,target,reason,completeDays:0,
 batterySavedGbp:null,solarStorageGainGbp:null,directSolarUpliftGbp:null,netForceProfitGbp:null,totalBenefitGbp:null,remainingGbp:null,
 progressPct:null,forecast:null});
function extract(reports){
 if(!Array.isArray(reports))return [];
 return reports.filter(report=>validateDate(report?.day)&&report?.savings?.available===true&&
  Number.isFinite(report.savings.batteryOnlySavingGbp)&&
  report?.solarStorage?.available===true&&
  Number.isFinite(report.solarStorage.houseSolarOpportunityGbp)&&
  Number.isFinite(report.solarStorage.solarExportGainGbp)&&
  report?.directSolarUplift?.available===true&&
  Number.isFinite(report.directSolarUplift.value)).map(report=>({
  date:report.day,
  // Solar used to charge the battery could otherwise have earned the
  // historical direct export tariff. Deduct that share from house savings.
  batterySavingGbp:report.savings.batteryOnlySavingGbp-report.solarStorage.houseSolarOpportunityGbp,
  solarStorageGainGbp:report.solarStorage.solarExportGainGbp,
  directSolarUpliftGbp:report.directSolarUplift.value,
  // Only non-solar incremental forced export profit can appear here:
  // generic forceNet could already include the solar storage benefit.
  incrementalForceProfitGbp:report.forceNet?.available&&report.forceNet.excludesSolarOrigin===true&&
   Number.isFinite(report.forceNet.value)?report.forceNet.value:null,
  verified:true
 }));
}
function project(rows,remaining,asOf){
 if(rows.length<60)return {available:false,reason:'At least 60 verified household-battery days needed for a preliminary trend'};
 const first=rows[0].date,last=rows.at(-1).date;
 const elapsed=daysBetween(first,last)+1;
 const coverage=rows.length/elapsed;
 if(coverage<.85)return {available:false,reason:'Incomplete readings: at least 85% coverage needed for a trend'};
 if(daysBetween(last,asOf)>14)return {available:false,reason:'Recent battery savings readings are stale'};
 const months=new Set(rows.map(x=>x.date.slice(0,7)));
 if(months.size<2)return {available:false,reason:'At least two separate months are needed for a preliminary trend'};
 const recent=rows.slice(-Math.min(120,rows.length));
 const trend=recent.reduce((total,row)=>total+row.batterySavingGbp+(row.solarStorageGainGbp??0)+
  (row.incrementalForceProfitGbp??0)+(row.directSolarUpliftGbp??0),0)/recent.length;
 if(trend<=0)return {available:false,reason:'Recent net savings are not positive, so no reliable break-even date'};
 // A genuine seasonal projection needs all 12 calendar months represented.
 // Ten months must not silently extrapolate the missing winter/summer months.
 const byMonth=Array.from({length:12},()=>[]);
 for(const row of rows)byMonth[Number(row.date.slice(5,7))-1].push(row.batterySavingGbp+(row.solarStorageGainGbp??0)+(row.incrementalForceProfitGbp??0)+(row.directSolarUpliftGbp??0));
 const rates=byMonth.map(group=>group.length>=14?
  group.reduce((a,b)=>a+b,0)/group.length:null);
 const seasonal=rows.length>=300&&elapsed>=365&&rates.every(rate=>rate!==null);
 const monthsCovered=rates.filter(rate=>rate!==null).length;
 function forecast(multiplier=1){
  let sum=0,day=asOf;
  for(let i=1;i<=365*60;i++){
   day=addDays(asOf,i);
   const rate=seasonal?(rates[Number(day.slice(5,7))-1]??trend):trend;
   sum+=rate*multiplier;
   if(sum>=remaining)return day;
  }
  return null;
 }
 return {available:true,kind:seasonal?'seasonally-informed':'preliminary trend',
  method:'History-weighted scenario estimate, not a trained AI model',
  date:forecast(),earliest:forecast(1.25),latest:forecast(.75),
  recentDailyBenefitGbp:trend,coveredDays:rows.length,coverage,
  monthsCovered,seasonalEligible:seasonal,seasonalDailyRatesGbp:seasonal?rates:null,
  notes:(seasonal?'All 12 calendar months have verified samples; monthly averages repeat as a scenario. ':
   'Fewer than 12 sufficiently sampled calendar months: flat recent daily trend, not a seasonal model. ')+
   'The 25% faster/slower dates are sensitivity scenarios, not statistical confidence intervals. Tariffs, weather, battery ageing and export prices may change.'};
}
function analyse(entries,target=DEFAULT_TARGET_GBP,asOf=new Date().toISOString().slice(0,10)){
 if(!Number.isFinite(target)||target<=0||!validateDate(asOf))return unavailable('Invalid battery investment or date',target);
 const source=Array.isArray(entries)?entries:[];
 const accepted=source.filter(r=>validateDate(r?.date)&&r.date<=asOf&&r.verified===true&&
  Number.isFinite(r.batterySavingGbp)&&
  (r.solarStorageGainGbp==null||Number.isFinite(r.solarStorageGainGbp))&&
  (r.incrementalForceProfitGbp==null||Number.isFinite(r.incrementalForceProfitGbp))&&
  (r.directSolarUpliftGbp==null||(Number.isFinite(r.directSolarUpliftGbp)&&r.directSolarUpliftGbp>=0)));
 if(!accepted.length)return unavailable('Waiting for verified battery-to-house savings readings',target);
 const unique=new Map();
 for(const row of accepted)if(!unique.has(row.date))unique.set(row.date,row);
 const rows=Array.from(unique.values()).sort((a,b)=>a.date.localeCompare(b.date));
 const batterySavedGbp=rows.reduce((n,r)=>n+r.batterySavingGbp,0);
 const solarStorageGainGbp=rows.reduce((n,r)=>n+(r.solarStorageGainGbp??0),0);
 const netForceProfitGbp=rows.reduce((n,r)=>n+(r.incrementalForceProfitGbp??0),0);
 const confirmedForceDays=rows.filter(r=>r.incrementalForceProfitGbp!==null).length;
 const directSolarUpliftGbp=rows.reduce((n,r)=>n+(r.directSolarUpliftGbp??0),0);
 const totalBenefitGbp=batterySavedGbp+solarStorageGainGbp+netForceProfitGbp+directSolarUpliftGbp;
 const remainingGbp=Math.max(0,target-totalBenefitGbp);
 const completeDays=rows.length,spanDays=daysBetween(rows[0].date,rows.at(-1).date)+1;
 const coverage=completeDays/spanDays;
 const forecast=remainingGbp===0?
  {available:true,kind:'achieved',date:rows.at(-1).date,earliest:null,latest:null,notes:'Verified subtotal reached the investment target'}:
  project(rows,remainingGbp,asOf);
 return {available:true,target,completeDays,firstDay:rows[0].date,lastDay:rows.at(-1).date,
  spanDays,coverage,batterySavedGbp,solarStorageGainGbp,directSolarUpliftGbp,netForceProfitGbp,confirmedForceDays,
  totalBenefitGbp,remainingGbp,progressPct:Math.max(0,Math.min(100,totalBenefitGbp/target*100)),
  forecast,reason:spanDays>completeDays?'Incomplete history: valid-day subtotal only; gaps are not zero':'Verified-day subtotal, not lifetime savings unless full history is imported'};
}
const api={DEFAULT_TARGET_GBP,extract,analyse,project,validateDate};
if(node)module.exports=api;else root.FoxBatteryPaybackCore=api;
})(typeof window!=='undefined'?window:globalThis);
