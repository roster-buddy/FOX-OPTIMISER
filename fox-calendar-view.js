/* Display-only calendar view separation. Existing booking handlers stay intact. */
(function(root){
'use strict';
function setView(doc,mode){
 if(!doc||!['month','day'].includes(mode))return false;
 const monthOnly=[
  doc.getElementById('v4PreviousMonth')?.parentElement,
  doc.getElementById('foxCalendarExplanation'),
  doc.getElementById('foxCalendarMonthPnl'),
  doc.getElementById('foxCalendarLegend')
 ];
 for(const part of monthOnly)if(part)part.hidden=mode==='day';
 return true;
}
if(typeof module!=='undefined'&&module.exports){
 module.exports={setView};return;
}
const doc=root.document;
if(!doc)return;
const initialise=()=>{
 doc.addEventListener('fox:calendar-mode-changed',event=>setView(doc,event.detail?.mode));
 const daySelected=doc.getElementById('foxDayMode')?.getAttribute('aria-pressed')==='true';
 setView(doc,daySelected?'day':'month');
};
if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',initialise);
else initialise();
})(typeof window!=='undefined'?window:globalThis);
