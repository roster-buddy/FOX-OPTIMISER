/* Read-only, roof-aware NEXT-DAY weather estimate. No meter or battery control.
   Open-Meteo global_tilted_irradiance is an hourly mean W/m², labelled at
   the end of its hour. This is an estimate, not measured PV production. */
(function(root){
'use strict';
const node=typeof module!=='undefined'&&module.exports;
const DEFAULTS=Object.freeze({solarKwp:2.01,bearing:110,tilt:35,performanceRatio:.82,
 inverterAcKw:1.5,uncertaintyPct:20});
const londonDate=ms=>{
 const p=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',
  year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(ms)).map(x=>[x.type,x.value]));
 return p.year+'-'+p.month+'-'+p.day;
};
function tomorrow(now=Date.now()){
 if(!Number.isFinite(now))throw Error('Invalid forecast clock');
 // Find next calendar date in Europe/London; UTC noon + 1 day cannot skip DST.
 return londonDate(now+36*3600000)===londonDate(now+12*3600000)?
  londonDate(now+36*3600000):londonDate(now+24*3600000);
}
function validate(site){
 if(!site||typeof site!=='object')throw Error('Solar site details required');
 const values={...DEFAULTS,...site};
 for(const [k,min,max] of [['latitude',-90,90],['longitude',-180,180],
  ['solarKwp',.1,20],['bearing',0,360],['tilt',0,90],
  ['performanceRatio',.2,1],['inverterAcKw',.1,20],['uncertaintyPct',0,90]]){
  if(typeof values[k]!=='number'||!Number.isFinite(values[k])||values[k]<min||values[k]>max)
   throw Error('Invalid '+k);
 }
 return values;
}
function url(site){
 const s=validate(site);
 const params=new URLSearchParams({latitude:String(s.latitude),longitude:String(s.longitude),
  hourly:'global_tilted_irradiance',tilt:String(s.tilt),
  azimuth:String(s.bearing-180),timezone:'UTC',timeformat:'unixtime',forecast_days:'3'});
 return 'https://api.open-meteo.com/v1/forecast?'+params.toString();
}
function estimate(payload,day,site){
 const s=validate(site);
 if(typeof day!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(day))throw Error('Invalid forecast date');
 const times=payload?.hourly?.time,values=payload?.hourly?.global_tilted_irradiance;
 if(!Array.isArray(times)||!Array.isArray(values)||times.length!==values.length)
  throw Error('Incomplete tilted irradiance forecast');
 let energy=0,count=0,previous=-Infinity;
 for(let i=0;i<times.length;i++){
  const stamp=times[i]*1000;
  if(!Number.isFinite(stamp)||stamp<=previous)throw Error('Invalid or unsorted hourly timestamps');
  previous=stamp;
  // Hour ending at stamp belongs to the UK local date at its midpoint.
  if(londonDate(stamp-1800000)!==day)continue;
  const w=values[i];
  if(typeof w!=='number'||!Number.isFinite(w)||w<0)throw Error('Missing hourly irradiance for requested date');
  energy+=Math.min(s.inverterAcKw,w/1000*s.solarKwp*s.performanceRatio);
  count++;
 }
 if(count<23||count>25)throw Error('Incomplete forecast: expected 23–25 local hourly slots');
 const round=n=>Math.round(n*100)/100;
 return {type:'PUBLIC_WEATHER_ESTIMATE',date:day,hourCount:count,
  estimatedKwh:round(energy),cautiousKwh:round(energy*(1-s.uncertaintyPct/100)),
  bearing:s.bearing,tilt:s.tilt,performanceRatio:s.performanceRatio,
  source:'Open-Meteo forecast global_tilted_irradiance; not metered generation'};
}
const api={DEFAULTS,tomorrow,validate,url,estimate};
if(node)module.exports=api;else root.FoxRoofWeatherCore=api;
})(typeof window!=='undefined'?window:globalThis);
