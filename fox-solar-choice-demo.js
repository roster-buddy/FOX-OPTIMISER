/* The adviser is embedded ONLY inside the opt-in financial DEMO.
   It cannot change real reports, battery controls, schedules or saved settings. */
(function(root){
'use strict';
const doc=root.document,core=root.FoxSolarChoiceCore;
if(!doc||!core)return;
function setup(){
 const host=doc.getElementById('foxDemoContent');
 if(!host||doc.getElementById('foxSolarChoiceDemo'))return;
 const panel=doc.createElement('section');
 panel.id='foxSolarChoiceDemo';panel.className='fox-solar-choice-demo';
 panel.innerHTML=[
  '<h4>Solar export decision · simulated adviser</h4>',
  '<p class="note">What should happen to 1.024 kWh of spare solar? Compare selling now at a hypothetical 12p/kWh with storing for home or a later Agile slot. Not a trained AI prediction, and no inverter control.</p>',
  '<div class="fox-choice-inputs">',
  '<label>Later Agile export rate (p/kWh) <input id="foxChoiceLater" type="number" min="-50" max="150" step="0.1" value="29.8"></label>',
  '<label>Household avoided import (p/kWh) <input id="foxChoiceHouse" type="number" min="0" max="150" step="0.1" value="23.3"></label>',
  '</div>',
  '<p id="foxChoiceWinner" class="fox-choice-result" aria-live="polite"></p>',
  '<div id="foxChoiceOptions" class="fox-choice-options"></div>',
  '<p class="note" id="foxChoiceCaveat">Hypothetical 94% charging efficiency, 92% discharge efficiency, 5p/kWh wear, 3.5 kW net export headroom, 20% protected reserve. Actual half-hour Agile prices and household forecasts are not connected.</p>'
 ].join('');
 const target=host.querySelector('.fox-demo-controls');
 if(target)target.after(panel);else host.prepend(panel);
 const later=panel.querySelector('#foxChoiceLater'),house=panel.querySelector('#foxChoiceHouse');
 const result=panel.querySelector('#foxChoiceWinner'),options=panel.querySelector('#foxChoiceOptions');
 const money=x=>(x<0?'−£':'£')+Math.abs(x).toFixed(2);
 function render(){
  const l=Number(later.value),h=Number(house.value);
  if(later.value===''||house.value===''||!Number.isFinite(l)||!Number.isFinite(h)){
   result.textContent='Enter valid rates to compare the options.';options.replaceChildren();return;
  }
  const v=core.compare({
   source:'simulation',solarKwh:1.024,directRateGbp:.12,laterRateGbp:l/100,
   houseAvoidedImportRateGbp:h/100,chargeEfficiency:.94,dischargeEfficiency:.92,
   wearGbpPerAcKwh:.05,batteryFreeKwh:2,gridExportHeadroomKw:3.5,
   laterSlotHours:.5,batteryDischargeHeadroomKwh:3,
   protectedReserveKwh:2,projectedSocAt19Kwh:2,
   directExportFeasible:true,priceTimeAligned:true,reserveForecastVerified:true,
   houseValueVerified:true,laterExportForecastAvailable:true,
   houseDemandForecastAvailable:true,houseNeedKwh:2
  });
  if(!v.available){result.textContent='Cannot compare: '+v.reason;options.replaceChildren();return;}
  result.textContent='Best hypothetical choice: '+v.bestLabel+
   ' · '+money(v.expectedValueGbp)+' value · '+money(v.incrementalVsImmediateGbp)+
   ' versus exporting now.';
  options.replaceChildren();
  for(const c of v.options){
   const line=doc.createElement('p');
   line.textContent=c.label+': '+(c.feasible?money(c.valueGbp):'Unavailable — '+c.reason);
   if(c.id===v.bestId)line.style.fontWeight='700';
   options.append(line);
  }
 }
 later.addEventListener('input',render);house.addEventListener('input',render);
 render();
}
if(doc.readyState!=='complete')doc.addEventListener('DOMContentLoaded',setup);
else setup();
})(typeof window!=='undefined'?window:globalThis);
