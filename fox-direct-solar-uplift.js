(function(root){
'use strict';
const api={
 calculate(rows,baseline=.12){
  const fail=reason=>({available:false,reason,value:null});
  if(!Array.isArray(rows)||!rows.length)return fail('No direct solar meter intervals');
  if(!Number.isFinite(baseline)||Math.abs(baseline-.12)>1e-9)return fail('Verified 12p comparator required');
  let value=0,totalDirectSolarKwh=0;
  for(const r of rows){
   if(r?.verified!==true||r?.directSolarExportVerified!==true||
      !Number.isFinite(r.start)||!Number.isFinite(r.end)||r.end<=r.start||
      !Number.isFinite(r.directSolarExportKwh)||r.directSolarExportKwh<0||
      !Number.isFinite(r.achievedExportRateGbpPerKwh)||
      !Number.isFinite(r.directExportRateGbpPerKwh)||
      Math.abs(r.directExportRateGbpPerKwh-baseline)>1e-9)
    return fail('Verified aligned solar-only export and 12p comparator required');
   value+=r.directSolarExportKwh*Math.max(0,r.achievedExportRateGbpPerKwh-baseline);
   totalDirectSolarKwh+=r.directSolarExportKwh;
  }
  return {available:true,value,totalDirectSolarKwh,intervalCount:rows.length,
   reason:'Incremental tariff benefit only, not gross export receipts. Below-12p slots count zero.'};
 }
};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
else root.FoxDirectSolarUplift=api;
})(typeof window!=='undefined'?window:globalThis);
