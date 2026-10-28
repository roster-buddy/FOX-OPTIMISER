'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const core=require('./fox-roof-weather-core.js');
const site={latitude:52.5,longitude:-2.1,solarKwp:2.01,bearing:110,tilt:35,
 performanceRatio:.82,inverterAcKw:1.5,uncertaintyPct:20};
assert.equal(core.tomorrow(Date.parse('2026-07-28T23:30:00Z')),'2026-07-30','UK date already advanced past UTC midnight');
assert.equal(core.tomorrow(Date.parse('2026-10-28T12:00:00Z')),'2026-10-29');
assert.equal(core.tomorrow(Date.parse('2026-03-29T00:30:00Z')),'2026-03-30','DST spring transition');
assert.equal(core.tomorrow(Date.parse('2026-10-25T00:30:00Z')),'2026-10-26','DST autumn transition');
assert(core.url(site).includes('azimuth=-70'),'Open-Meteo azimuth is relative to south');
assert(core.url(site).includes('tilt=35'));
assert(!core.url(site).includes('apikey'));
function weather(day){
 const start=Date.parse(day+'T00:00:00Z')-2*86400000;
 const times=[],values=[];
 for(let i=0;i<120;i++){
  times.push((start+i*3600000)/1000);
  values.push(500);
 }
 return {hourly:{time:times,global_tilted_irradiance:values}};
}
for(const [day,slots] of [['2026-10-29',24],['2026-03-29',23],['2026-10-25',25]]){
 const result=core.estimate(weather(day),day,site);
 assert.equal(result.type,'PUBLIC_WEATHER_ESTIMATE');
 assert.equal(result.hourCount,slots);
 const perHour=Math.min(site.inverterAcKw,.5*site.solarKwp*site.performanceRatio);
 assert(Math.abs(result.estimatedKwh-perHour*slots)<.011);
 assert(Math.abs(result.cautiousKwh-result.estimatedKwh*.8)<.02);
}
const south=core.estimate(weather('2026-10-29'),'2026-10-29',{...site,bearing:180});
assert.equal(south.bearing,180);
const broken=weather('2026-10-29');
broken.hourly.global_tilted_irradiance[50]=null;
assert.throws(()=>core.estimate(broken,'2026-10-29',site));
assert.throws(()=>core.estimate({hourly:{time:[0],global_tilted_irradiance:[100]}},'2026-10-29',site));
assert.throws(()=>core.validate({...site,latitude:Infinity}));
assert.throws(()=>core.validate({...site,solarKwp:0}));
const ui=fs.readFileSync('fox-roof-weather-ui.js','utf8');
assert(ui.includes('Get tomorrow'));
assert(ui.includes('fetch(core.url(site)'));
assert(ui.includes('No estimated generation has been recorded'));
assert(ui.includes('fox-solar-lat'));
for(const source of [fs.readFileSync('fox-roof-weather-core.js','utf8'),ui]){
 for(const forbidden of ['FoxCalendarPnl','FoxActualReport','recordDay(','forceDischarge(','forceCharge(','localStorage.setItem'])
  assert(!source.includes(forbidden),'Forecast must not write actual data or control devices: '+forbidden);
}
for(const page of ['index.html','preview-v2.html']){
 const html=fs.readFileSync(page,'utf8');
 for(const script of ['fox-roof-weather-core.js','fox-roof-weather-ui.js'])
  assert(html.includes(script+'?v=485'),page+' must include '+script);
 assert(html.indexOf('fox-roof-weather-core.js')<html.indexOf('fox-roof-weather-ui.js'));
}
console.log('ROOF WEATHER PASS: next-day London/DST, azimuth, hourly irradiance energy, 20% caution, missing-data rejection and read-only isolation');
