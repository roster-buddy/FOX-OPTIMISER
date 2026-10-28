/* Optional, user-supplied forecast comparison. No network, storage or inverter actions. */
(function(root){
'use strict';
const doc=root.document,core=root.FoxSolarAccuracyCore;
if(!doc||!core)return;
function setup(){
 const host=doc.getElementById('foxRoofWeather');
 if(!host||doc.getElementById('foxSolarAccuracy'))return;
 const box=doc.createElement('section');box.id='foxSolarAccuracy';
 box.innerHTML=[
  '<details id="foxSolarAccuracyDisclosure">',
  '<summary>Compare solar forecasts with generation readings (optional)</summary>',
  '<p class="note">Awaiting paired forecast and generation records. This tool accepts manually supplied daily figures for a preliminary accuracy check. Pasted figures are NOT independently verified Fox ESS readings. It never imports, saves or changes actual financial records, battery controls or forecast settings.</p>',
  '<p class="note">CSV format: <code>date,forecast_kwh,actual_kwh</code> followed by one row per UK calendar day (YYYY-MM-DD). Use at least 7 days with actual generation measured over the same midnight-to-midnight period as the forecast. Do not use export-only energy as total solar generation. Keep original day-ahead forecasts rather than forecasts obtained after the day.</p>',
  '<label for="foxSolarAccuracyCsv">Paired daily figures (paste CSV)</label>',
  '<textarea id="foxSolarAccuracyCsv" rows="6" spellcheck="false" placeholder="date,forecast_kwh,actual_kwh"></textarea>',
  '<div class="fox-solar-accuracy-actions"><button type="button" id="foxSolarAccuracyCheck">Check accuracy</button><button type="button" id="foxSolarAccuracyClear" class="secondary">Clear figures</button></div>',
  '<p id="foxSolarAccuracyStatus" class="note" aria-live="polite">No paired daily readings supplied. Accuracy and calibration remain unavailable.</p>',
  '<div id="foxSolarAccuracyResult" hidden><div class="fox-solar-accuracy-stats">',
  '<div><small>Paired days</small><strong id="foxSolarAccuracyDays"></strong></div>',
  '<div><small>Average absolute error</small><strong id="foxSolarAccuracyMae"></strong></div>',
  '<div><small>Average forecast bias</small><strong id="foxSolarAccuracyBias"></strong></div>',
  '<div><small>Total forecast / supplied generation</small><strong id="foxSolarAccuracyTotals"></strong></div>',
  '</div><p id="foxSolarAccuracyAdjustment" class="note"></p>',
  '<p class="note">A suggested ratio is for inspection only, capped at 0.70–1.30. It is NOT applied to weather forecasts, the battery scheduler or £4,800 payback. Forecast uncertainty and shading may vary by season; seven days are not sufficient to establish annual accuracy.</p></div>',
  '</details>'
 ].join('');
 host.append(box);
 const get=id=>box.querySelector('#'+id);
 const field=get('foxSolarAccuracyCsv'),status=get('foxSolarAccuracyStatus'),result=get('foxSolarAccuracyResult');
 const clear=()=>{
  result.hidden=true;
  for(const id of ['foxSolarAccuracyDays','foxSolarAccuracyMae','foxSolarAccuracyBias','foxSolarAccuracyTotals','foxSolarAccuracyAdjustment'])get(id).textContent='';
 };
 get('foxSolarAccuracyCheck').addEventListener('click',()=>{
  clear();
  try{
   const rows=core.parse(field.value);
   const stats=core.analyse(rows);
   get('foxSolarAccuracyDays').textContent=String(stats.days);
   get('foxSolarAccuracyMae').textContent=stats.maeKwhPerDay.toFixed(2)+' kWh/day';
   get('foxSolarAccuracyBias').textContent=(stats.biasKwhPerDay>0?'+':'')+stats.biasKwhPerDay.toFixed(2)+' kWh/day';
   get('foxSolarAccuracyTotals').textContent=stats.forecastKwh.toFixed(2)+' / '+stats.actualKwh.toFixed(2)+' kWh';
   get('foxSolarAccuracyAdjustment').textContent='Illustrative ratio '+stats.illustrativeAdjustment.toFixed(2)+'×'+
    (stats.adjustmentCapped?' (limited to the permitted display range)':'')+
    '. Positive bias means forecast exceeded supplied generation. Weighted absolute percentage error: '+
    stats.weightedAbsolutePercentError.toFixed(2)+'%. These are user-supplied, unverified records; no automatic learning or battery commands.';
   status.textContent='Preliminary comparison of '+stats.days+' user-supplied days ('+stats.from+' to '+stats.to+'). Not verified actual generation.';
   result.hidden=false;
  }catch(e){status.textContent='Cannot compare: '+e.message+'. No results retained.';}
 });
 get('foxSolarAccuracyClear').addEventListener('click',()=>{
  field.value='';clear();status.textContent='No paired daily readings supplied. Accuracy and calibration remain unavailable.';
 });
}
if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',setup);
else setup();
})(typeof window!=='undefined'?window:globalThis);
