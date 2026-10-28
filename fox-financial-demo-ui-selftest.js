'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const core=require('./fox-financial-demo-core.js');
const ids={};
function node(tag='div'){
 const n={tagName:tag.toUpperCase(),children:[],dataset:{},attrs:{},hidden:false,
  textContent:'',events:{},className:'',append(...els){this.children.push(...els);},
  setAttribute(k,v){this.attrs[k]=v;},
  addEventListener(k,cb){this.events[k]=cb;},
  querySelectorAll(tag){return this.children.filter(e=>e.tagName===tag.toUpperCase());},
  querySelector(selector){return ids[selector.slice(1)]||null;}};
 Object.defineProperty(n,'innerHTML',{set(value){
  this._html=value;
  for(const m of value.matchAll(/\bid="(foxDemo[A-Za-z0-9]+)"/g)){
   const found=node();
   found.id=m[1];
   found.hidden=m[1]==='foxDemoContent';
   found.checked=m[1]==='foxDemoIncludeEV';
   ids[m[1]]=found;
  }
 }});
 return n;
}
const heading=node('h2');
heading.after=function(element){ids[element.id]=element;};
const actual=node('section');actual.id='foxActualCosts';actual.querySelector=s=>s==='h2'?heading:null;
ids.foxActualCosts=actual;
let domReady;
const document={readyState:'interactive',createElement:node,getElementById:id=>ids[id],
 addEventListener(event,fn){assert.equal(event,'DOMContentLoaded');domReady=fn;}};
let called=0;
const context={window:{document,FoxFinancialDemoCore:core,
 FoxCalendarPnl:{recordDay(){called++;throw Error('Touched actuals');}},
 FoxActualReport:{build(){called++;throw Error('Touched recorded report');}}
},Intl,Date,Number,String};
vm.runInNewContext(fs.readFileSync('fox-financial-demo-ui.js','utf8'),context);
assert(domReady,'Deferred module must wait for DOMContentLoaded while document is interactive');
assert(!ids.foxFinancialDemo,'Must not attempt to mount before actual panel startup');
domReady();
assert(ids.foxFinancialDemo);
assert.equal(ids.foxDemoContent.hidden,true,'Demo remains closed until explicit click');
assert.equal(ids.foxDemoMonthDays.children.length,31,'Day picker offers all sample dates');
assert.equal(ids.foxDemoToggle.attrs['aria-expanded'],undefined);
ids.foxDemoToggle.events.click();
assert.equal(ids.foxDemoContent.hidden,false);
assert.equal(ids.foxDemoToggle.attrs['aria-expanded'],'true');
assert.match(ids.foxDemoMonthSaved.textContent,/£/);
assert.match(ids.foxDemoMonthForce.textContent,/£/);
assert.match(ids.foxDemoMonthChargeLoss.textContent,/kWh/);
assert.match(ids.foxDemoDayHeading.textContent,/15 October 2026/);
ids.foxDemoMonthDays.children[17].events.click();
assert.match(ids.foxDemoDayHeading.textContent,/18 October 2026/);
assert.equal(ids.foxDemoMonthDays.children[17].attrs['aria-pressed'],'true');
assert.match(ids.foxDemoHouseFlow.textContent,/EV/);
const saved=ids.foxDemoHouseSaved.textContent,force=ids.foxDemoForcedIncome.textContent;
ids.foxDemoIncludeEV.checked=false;
ids.foxDemoIncludeEV.events.change();
assert.equal(ids.foxDemoHouseSaved.textContent,saved,'EV toggle cannot affect house-only savings');
assert.equal(ids.foxDemoForcedIncome.textContent,force,'EV toggle cannot affect forced export');
assert.match(ids.foxDemoMonthExplanation.textContent,/EV separately 0.00 kWh/);
assert.match(ids.foxDemoHouseFlow.textContent,/EV 0.00 kWh/);
assert.equal(called,0,'No actual accounting APIs called');
ids.foxDemoToggle.events.click();
assert.equal(ids.foxDemoContent.hidden,true);
vm.runInNewContext(fs.readFileSync('fox-financial-demo-ui.js','utf8'),context);
domReady();
assert.equal(Object.values(ids).filter(x=>x.id==='foxFinancialDemo').length,1,'Repeat loading does not duplicate demo panel');
console.log('FINANCIAL DEMO UI PASS: opt-in, 31 selectable days, monthly/day values, EV exclusion, close and actuals isolation');
