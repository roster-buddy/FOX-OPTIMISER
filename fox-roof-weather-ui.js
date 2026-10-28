/* Optional public weather lookup; never records generation or controls hardware. */
(function(root){
'use strict';
const doc=root.document,core=root.FoxRoofWeatherCore;
if(!doc||!core)return;
function setup(){
 const host=doc.getElementById('foxDemoContent');
 if(!host||doc.getElementById('foxRoofWeather'))return;
 const section=doc.createElement('section');
 section.id='foxRoofWeather';
 section.innerHTML=[
  '<h4>Tomorrow’s roof-aware solar estimate</h4>',
  '<p class="note">Optional PUBLIC WEATHER FORECAST · NOT ACTUAL SOLAR GENERATION. Open-Meteo estimates irradiance on your 110° east-southeast-facing panels at a provisional 35° tilt. Your array is assumed to be 2.01 kWp, with an 82% performance ratio and a provisional 1.5 kW inverter AC cap. These are editable assumptions, not verified hardware specifications.</p>',
  '<div class="fox-roof-inputs">',
  '<label>Solar site latitude<input id="foxRoofLat" type="number" min="-90" max="90" step="any" placeholder="Latitude"></label>',
  '<label>Solar site longitude<input id="foxRoofLon" type="number" min="-180" max="180" step="any" placeholder="Longitude"></label>',
  '<label>Roof bearing (° from north)<input id="foxRoofBearing" type="number" min="0" max="360" step="1" value="110"></label>',
  '<label>Panel tilt (°)<input id="foxRoofTilt" type="number" min="0" max="90" step="1" value="35"></label>',
  '<label>PV performance ratio (%)<input id="foxRoofPr" type="number" min="20" max="100" step="1" value="82"></label>',
  '<label>Inverter AC cap (kW)<input id="foxRoofCap" type="number" min="0.1" max="20" step="0.1" value="1.5"></label>',
  '</div>',
  '<button id="foxRoofLoad" type="button">Get tomorrow’s public solar forecast</button>',
  '<p class="note">The solar array size is taken from the editable seasonal demonstration above. Coordinates are read from your saved solar-site settings if present, but are sent to Open-Meteo only when you press the forecast button. No readings or credentials are sent or saved by this panel.</p>',
  '<p id="foxRoofResult" class="note" aria-live="polite">No weather forecast requested.</p>',
  '<p class="note">The 20% cautious estimate is a planning reduction, not a statistical confidence interval. This single-day forecast does not feed the 12-month financial simulation, actual P&amp;L, battery schedule or £4,800 verified payback tracker.</p>'
 ].join('');
 host.append(section);
 const get=id=>section.querySelector('#'+id);
 try{
  const lat=root.localStorage?.getItem('fox-solar-lat');
  const lon=root.localStorage?.getItem('fox-solar-lon');
  if(lat!==null&&lat!==undefined)get('foxRoofLat').value=lat;
  if(lon!==null&&lon!==undefined)get('foxRoofLon').value=lon;
 }catch(e){}
 const status=get('foxRoofResult'),button=get('foxRoofLoad');
 button.addEventListener('click',async()=>{
  status.textContent='Checking roof-aware public weather forecast…';
  button.disabled=true;
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),12000);
  try{
   const solarInput=doc.getElementById('foxSeasonalKwp');
   const number=id=>{const el=get(id);if(el.value.trim()==='')throw Error('Complete all solar-site fields');return Number(el.value)};
   if(!solarInput||solarInput.value.trim()==='')throw Error('Enter a solar array size in the seasonal demo');
   const site=core.validate({latitude:number('foxRoofLat'),longitude:number('foxRoofLon'),
    solarKwp:Number(solarInput.value),bearing:number('foxRoofBearing'),tilt:number('foxRoofTilt'),
    performanceRatio:number('foxRoofPr')/100,inverterAcKw:number('foxRoofCap')});
   const day=core.tomorrow();
   const response=await fetch(core.url(site),{signal:controller.signal,cache:'no-store'});
   if(!response.ok)throw Error('Open-Meteo returned HTTP '+response.status);
   const payload=await response.json();
   const out=core.estimate(payload,day,site);
   status.textContent=day+' · '+out.estimatedKwh.toFixed(2)+' kWh estimated AC generation; '+
    out.cautiousKwh.toFixed(2)+' kWh with 20% planning reduction. '+
    out.hourCount+' UK-local hourly forecast slots. Public weather estimate only — not measured solar or guaranteed output.';
  }catch(error){
   status.textContent='No validated forecast available: '+(error.name==='AbortError'?
    'Weather request timed out.':error.message)+
    '. No estimated generation has been recorded.';
  }finally{clearTimeout(timeout);button.disabled=false;}
 });
}
if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',setup);
else setup();
})(typeof window!=='undefined'?window:globalThis);
