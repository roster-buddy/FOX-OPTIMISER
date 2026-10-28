/* Read-only solar forecast comparison. User-pasted daily pairs are NOT verified
   meter data and must never be used to adjust real dispatch or actual accounting. */
(function(root){
'use strict';
const node=typeof module!=='undefined'&&module.exports;
const datePattern=/^\d{4}-\d{2}-\d{2}$/;
function validDate(value){
 if(!datePattern.test(value))return false;
 const date=new Date(value+'T12:00:00Z');
 return !Number.isNaN(date.getTime())&&date.toISOString().slice(0,10)===value;
}
function parse(csv){
 if(typeof csv!=='string'||csv.length>50000)throw Error('CSV must be text under 50 KB');
 const lines=csv.trim().split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
 if(lines.length<2)throw Error('Add a header and at least one daily row');
 const head=lines.shift().replace(/^\uFEFF/,'').split(',').map(x=>x.trim().toLowerCase());
 if(head.join(',')!=='date,forecast_kwh,actual_kwh')
  throw Error('Use CSV columns: date,forecast_kwh,actual_kwh');
 if(lines.length>366)throw Error('Maximum 366 daily rows');
 const seen=new Set(),rows=[];
 for(const [i,line] of lines.entries()){
  const fields=line.split(',').map(x=>x.trim());
  if(fields.length!==3)throw Error('Row '+(i+2)+': expected three columns');
  const [date,forecastText,actualText]=fields;
  if(!validDate(date))throw Error('Row '+(i+2)+': invalid date');
  if(seen.has(date))throw Error('Duplicate date: '+date);
  seen.add(date);
  for(const value of [forecastText,actualText])
   if(!/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(value))throw Error('Row '+(i+2)+': invalid energy');
  const forecast=Number(forecastText),actual=Number(actualText);
  if(!Number.isFinite(forecast)||!Number.isFinite(actual)||forecast>100||actual>100)
   throw Error('Row '+(i+2)+': kWh must be 0–100');
  rows.push({date,forecastKwh:forecast,actualKwh:actual});
 }
 return rows.sort((a,b)=>a.date.localeCompare(b.date));
}
function analyse(rows,options={}){
 if(!Array.isArray(rows)||rows.length<7||rows.length>366)
  throw Error('At least 7 and at most 366 paired days required');
 const today=options.today||new Date().toISOString().slice(0,10);
 if(!validDate(today))throw Error('Invalid comparison date');
 const dates=new Set();
 let totalForecast=0,totalActual=0,totalAbs=0,positiveDays=0;
 for(const r of rows){
  if(!r||!validDate(r.date)||r.date>today||dates.has(r.date)||
    !Number.isFinite(r.forecastKwh)||!Number.isFinite(r.actualKwh)||
    r.forecastKwh<0||r.actualKwh<0||r.forecastKwh>100||r.actualKwh>100)
   throw Error('Invalid, duplicate or future daily comparison');
  dates.add(r.date);
  totalForecast+=r.forecastKwh;totalActual+=r.actualKwh;
  totalAbs+=Math.abs(r.actualKwh-r.forecastKwh);
  if(r.forecastKwh>0)positiveDays++;
 }
 if(totalForecast<1||totalActual<1||positiveDays<5)
  throw Error('Insufficient non-zero solar data for a useful comparison');
 const round=x=>Math.round(x*100)/100;
 const rawRatio=totalActual/totalForecast;
 return {type:'USER_SUPPLIED_UNVERIFIED_COMPARISON',days:rows.length,
  from:rows.reduce((a,r)=>a<r.date?a:r.date,rows[0].date),
  to:rows.reduce((a,r)=>a>r.date?a:r.date,rows[0].date),
  forecastKwh:round(totalForecast),actualKwh:round(totalActual),
  biasKwhPerDay:round((totalForecast-totalActual)/rows.length),
  maeKwhPerDay:round(totalAbs/rows.length),
  weightedAbsolutePercentError:round(totalAbs/totalActual*100),
  illustrativeAdjustment:round(Math.max(.7,Math.min(1.3,rawRatio))),
  adjustmentCapped:rawRatio<.7||rawRatio>1.3,
  note:'User-supplied pairs only. Not verified Fox ESS readings; no automatic forecast calibration.'};
}
const api={parse,analyse,validDate};
if(node)module.exports=api;else root.FoxSolarAccuracyCore=api;
})(typeof window!=='undefined'?window:globalThis);
