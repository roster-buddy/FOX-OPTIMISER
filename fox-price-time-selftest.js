'use strict';
const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');

const source=fs.readFileSync('app.js','utf8');
const a=source.indexOf('async function loadLive()');
const b=source.indexOf('\nfunction downloadCSV()',a);
assert(a>=0&&b>a,'Price loader missing');

async function check(start,after,expected){
 let clock=Date.parse('2026-10-27T'+start+'Z');
 let url,planned=0;
 class Clock extends Date{
  constructor(...args){
   super(...(args.length?args:[clock]));
  }
  static now(){return clock;}
 }
 const context={
  Date:Clock,URL,AbortController,
  setTimeout:()=>1,clearTimeout:()=>{},
  readSettings:()=>true,
  settings:{tariff:'E-1R-AGILE-OUTGOING-19-05-13-E'},
  $:()=>({textContent:''}),
  prices:[],priceSource:'none',
  v4LastPriceCheck:null,
  v4UpdateRefreshStatus:()=>{},
  plan:()=>{planned++;},
  fetch:async u=>{
   url=u;
   clock=Date.parse('2026-10-27T'+after+'Z');
   return {
    ok:true,
    json:async()=>({
     results:[
      '14:00:00','14:30:00','15:00:00','15:30:00'
     ].map(t=>({
      valid_from:'2026-10-27T'+t+'Z',
      value_inc_vat:30
     }))
    })
   };
  }
 };
 vm.createContext(context);
 await vm.runInContext(
  source.slice(a,b)+';loadLive();',context
 );
 assert.equal(planned,1);
 assert.deepEqual(
  Array.from(context.prices,x=>
   new Date(x.start).toISOString().slice(11,16)
  ),
  expected
 );
 const query=new URL(url).searchParams.get('period_from');
 assert.equal(
  Date.parse(query),
  Math.ceil(
   Date.parse('2026-10-27T'+start+'Z')/1800000
  )*1800000
 );
}

(async()=>{
 await check('14:41:00','14:41:02',['15:00','15:30']);
 await check(
  '14:30:00','14:30:00',['14:30','15:00','15:30']
 );
 await check('14:59:59','15:00:01',['15:30']);
 console.log(
  'PRICE TIME PASS: started slots excluded; exact boundary '+
  'retained; delayed responses rechecked'
 );
})().catch(e=>{
 console.error(e);
 process.exitCode=1;
});
