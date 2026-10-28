/* Opt-in seasonal financial sensitivity. Hypothetical data only. */
(function(root){
'use strict';
const doc=root.document,core=root.FoxSeasonalDemoCore;
if(!doc||!core)return;
const money=n=>(n<0?'−£':'£')+Math.abs(n).toFixed(2);
function setup(){
 const host=doc.getElementById('foxDemoContent');
 if(!host||doc.getElementById('foxSeasonalDemo'))return;
 const box=doc.createElement('section');box.id='foxSeasonalDemo';
 box.innerHTML=[
  '<h4>Seasonal battery payback · illustrative scenarios</h4>',
  '<p class="note">Compare fictional lower, middle and higher solar conditions. The values are scaled from the synthetic October demonstration, NOT actual Fox ESS data, a roof-specific forecast, or a trained AI model.</p>',
  '<h5>Your installation · illustrative inputs</h5>',
  '<p class="note">Starting assumptions: 2.01 kWp solar array, roof bearing approximately 110° clockwise from north (east-southeast), provisional tilt 35°, and an assumed 12p/kWh direct-export comparison. Roof direction and tilt are shown for context only; this simplified model does not calculate irradiance, shading or roof-specific yield.</p>',
  '<div class="fox-seasonal-inputs">',
  ' <label for="foxSeasonalKwp">Solar array size (kWp)<input id="foxSeasonalKwp" type="number" min="0.1" max="20" step="0.01" value="2.01" inputmode="decimal"></label>',
  ' <label for="foxSeasonalCheap">Cheap import (p/kWh)<input id="foxSeasonalCheap" type="number" min="0" max="100" step="0.0001" value="3.4965" inputmode="decimal"></label>',
  ' <label for="foxSeasonalPeak">Peak import (p/kWh)<input id="foxSeasonalPeak" type="number" min="0" max="100" step="0.0001" value="23.2995" inputmode="decimal"></label>',
  '</div>',
  '<button id="foxSeasonalReset" type="button" class="secondary">Reset illustrative assumptions</button>',
  '<p id="foxSeasonalInputStatus" class="note" aria-live="polite">Values are editable demonstration assumptions, not imported tariff or meter readings.</p>',
  '<label for="foxSeasonalChoice">Example solar conditions</label>',
  '<select id="foxSeasonalChoice"><option value="low">Lower solar · 70% of hypothetical pattern</option><option value="typical" selected>Middle solar · hypothetical pattern</option><option value="high">Higher solar · 130% of hypothetical pattern</option></select>',
  '<div class="fox-seasonal-summary">',
  ' <div><small>Illustrative annual recovery</small><strong id="foxSeasonalAnnual"></strong></div>',
  ' <div><small>£4,800 break-even · scenario</small><strong id="foxSeasonalDate"></strong></div>',
  ' <div><small>Time to break even</small><strong id="foxSeasonalYears"></strong></div>',
  '</div>',
  '<h5>Compare all three scenarios</h5>',
  '<div class="fox-seasonal-table-wrap"><table class="fox-seasonal-compare"><thead><tr><th>Solar case</th><th>Annual benefit</th><th>Break-even</th><th>Years</th></tr></thead><tbody id="foxSeasonalCompareRows"></tbody></table></div>',
  '<h5>Monthly benefit comparison · illustrative £</h5>',
  '<div id="foxSeasonalBars" class="fox-seasonal-bars" role="img" aria-label="Comparison of monthly financial benefit for low, middle and high synthetic solar conditions"></div>',
  '<p class="note">Bars show monthly combined financial benefit; a longer bar means a higher illustrative benefit. Low / middle / high are hypothetical, not a statistical probability range.</p>',
  '<h5>Selected scenario · financial breakdown</h5>',
  '<div class="fox-seasonal-table-wrap"><table><thead><tr><th>Month</th><th>House saving</th><th>Stored solar gain</th><th>Direct solar uplift</th><th>Total</th></tr></thead><tbody id="foxSeasonalRows"></tbody></table></div>',
  '<p class="note">This is a first-order sensitivity calculation: solar-dependent components scale with selected kWp, while household battery saving responds to illustrative peak-import avoidance and cheap-energy costs. Actual generation and charging behaviour will not scale linearly. Stored-solar gains can be negative. The 12p/kWh direct-export benchmark and synthetic Agile prices remain fixed; direct-solar uplift counts only the fictional premium above 12p. Gross export receipts are not added again. It repeats one hypothetical year, with no physical dispatch, degradation, weather, price-responsive scheduling, financing or 3.5 kW instantaneous export constraint modelled. Actual investment recovery remains separate.</p>'
 ].join('');
 const monthExplanation=host.querySelector('#foxDemoMonthExplanation');
 if(monthExplanation)monthExplanation.after(box);else host.append(box);
 const choice=box.querySelector('#foxSeasonalChoice');
 const inputKwp=box.querySelector('#foxSeasonalKwp');
 const inputCheap=box.querySelector('#foxSeasonalCheap');
 const inputPeak=box.querySelector('#foxSeasonalPeak');
 const inputStatus=box.querySelector('#foxSeasonalInputStatus');
 const labels={low:'Lower',typical:'Middle',high:'Higher'};
 function render(){
  let assumptions,comparison;
  try{
   if([inputKwp,inputCheap,inputPeak].some(input=>input.value.trim()===''))throw Error('Complete all three illustrative inputs');
   assumptions=core.settings({solarKwp:Number(inputKwp.value),
    cheapImportPence:Number(inputCheap.value),peakImportPence:Number(inputPeak.value)});
   comparison=core.compare(assumptions);
   inputStatus.textContent='Illustrative sensitivity only · no live readings or physical battery schedule. Roof bearing 110° and tilt 35° are not used in the calculation.';
  }catch(error){
   inputStatus.textContent='Check inputs: '+error.message+'. Previous results are not current.';
   box.querySelector('#foxSeasonalCompareRows').replaceChildren();
   box.querySelector('#foxSeasonalBars').replaceChildren();
   box.querySelector('#foxSeasonalRows').replaceChildren();
   for(const id of ['foxSeasonalAnnual','foxSeasonalDate','foxSeasonalYears'])
    box.querySelector('#'+id).textContent='Invalid assumptions';
   return;
  }
  const max=Math.max(...comparison.monthly.flatMap(r=>[r.low,r.typical,r.high]),.01);
  const result=core.calculate(choice.value,assumptions);
  const compareBody=box.querySelector('#foxSeasonalCompareRows');compareBody.replaceChildren();
  for(const item of comparison.scenarios){
   const tr=doc.createElement('tr');
   if(item.scenario===choice.value)tr.className='fox-seasonal-selected';
   for(const value of [labels[item.scenario],money(item.annualBenefitGbp),
    item.paybackMonth||'Beyond 60 years',
    item.monthsToPayback===null?'—':(item.monthsToPayback/12).toFixed(1)]){
    const td=doc.createElement('td');td.textContent=value;tr.append(td);
   }
   compareBody.append(tr);
  }
  const bars=box.querySelector('#foxSeasonalBars');bars.replaceChildren();
  for(const month of comparison.monthly){
   const group=doc.createElement('div');group.className='fox-seasonal-bar-month';
   const heading=doc.createElement('strong');heading.textContent=month.name;group.append(heading);
   for(const key of ['low','typical','high']){
    const line=doc.createElement('div');line.className='fox-seasonal-bar-line';
    if(key===choice.value)line.classList.add('fox-seasonal-bar-selected');
    const caption=doc.createElement('span');caption.textContent=labels[key];
    const track=doc.createElement('div');track.className='fox-seasonal-bar-track';
    const fill=doc.createElement('div');fill.className='fox-seasonal-bar-fill fox-seasonal-'+key;
    fill.style.width=(Math.max(0,month[key])/max*100).toFixed(1)+'%';
    track.append(fill);
    const amount=doc.createElement('span');amount.textContent=money(month[key]);
    line.append(caption,track,amount);group.append(line);
   }
   bars.append(group);
  }
  box.querySelector('#foxSeasonalAnnual').textContent=money(result.annualBenefitGbp);
  box.querySelector('#foxSeasonalDate').textContent=result.paybackMonth||'Not reached in 60 years';
  box.querySelector('#foxSeasonalYears').textContent=result.monthsToPayback===null?'Not projected':
   (result.monthsToPayback/12).toFixed(1)+' years';
  const body=box.querySelector('#foxSeasonalRows');body.replaceChildren();
  for(const row of result.monthly){
   const tr=doc.createElement('tr');
   for(const value of [row.name,money(row.houseGbp),money(row.storedSolarGbp),
    money(row.directSolarGbp),money(row.benefitGbp)]){
    const td=doc.createElement('td');td.textContent=value;tr.append(td);
   }
   body.append(tr);
  }
 }
 choice.addEventListener('change',render);
 for(const input of [inputKwp,inputCheap,inputPeak])input.addEventListener('input',render);
 box.querySelector('#foxSeasonalReset').addEventListener('click',()=>{
  inputKwp.value=String(core.DEFAULTS.solarKwp);
  inputCheap.value=String(core.DEFAULTS.cheapImportPence);
  inputPeak.value=String(core.DEFAULTS.peakImportPence);
  choice.value='typical';render();
 });
 render();
}
if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',setup);
else setup();
})(typeof window!=='undefined'?window:globalThis);
