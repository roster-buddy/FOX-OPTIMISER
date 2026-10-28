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
  '<label for="foxSeasonalChoice">Example solar conditions</label>',
  '<select id="foxSeasonalChoice"><option value="low">Lower solar · 70% of hypothetical pattern</option><option value="typical" selected>Middle solar · hypothetical pattern</option><option value="high">Higher solar · 130% of hypothetical pattern</option></select>',
  '<div class="fox-seasonal-summary">',
  ' <div><small>Illustrative annual recovery</small><strong id="foxSeasonalAnnual"></strong></div>',
  ' <div><small>£4,800 break-even · scenario</small><strong id="foxSeasonalDate"></strong></div>',
  ' <div><small>Time to break even</small><strong id="foxSeasonalYears"></strong></div>',
  '</div>',
  '<div class="fox-seasonal-table-wrap"><table><thead><tr><th>Month</th><th>House saving</th><th>Stored solar gain</th><th>Direct solar uplift</th><th>Total</th></tr></thead><tbody id="foxSeasonalRows"></tbody></table></div>',
  '<p class="note">Assumes unchanged hypothetical import/export economics and repeats the same illustrative year. Household savings include a modest synthetic solar sensitivity. Stored-solar gains can be negative. Direct-solar uplift counts only the fictional premium above 12p; gross export receipts are not added again. Does not model battery dispatch, changing tariffs, degradation, weather, inflation, financing or the 3.5 kW instantaneous export constraint. Actual investment recovery remains separate.</p>'
 ].join('');
 const monthExplanation=host.querySelector('#foxDemoMonthExplanation');
 if(monthExplanation)monthExplanation.after(box);else host.append(box);
 const choice=box.querySelector('#foxSeasonalChoice');
 function render(){
  const result=core.calculate(choice.value);
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
 choice.addEventListener('change',render);render();
}
if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',setup);
else setup();
})(typeof window!=='undefined'?window:globalThis);
