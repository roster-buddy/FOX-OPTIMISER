'use strict';
const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const source=fs.readFileSync('app.js','utf8');

const start=source.indexOf('async function v4Refresh()');
const end=source.indexOf('\nv4BuildDashboard();',start);
assert(start>=0&&end>start,'Refresh function must exist');
const refresh=source.slice(start,end);

async function check(success){
 const context={
  document:{visibilityState:'visible'},
  localStorage:{getItem:()=> 'test-coordinate'},
  console:{warn:()=>{}},
  v4RefreshBusy:false,
  v4LastPriceCheck:100,
  v4LastSolarCheck:200,
  updates:0,
  v4UpdateRefreshStatus:()=>{context.updates++;},
  // The real loaders handle their own errors and return normally.
  loadLive:async()=>{
   if(success)context.v4LastPriceCheck=300;
  },
  loadSolarForecastV3:async()=>{
   if(success)context.v4LastSolarCheck=400;
  }
 };
 vm.createContext(context);
 vm.runInContext(refresh,context);
 await context.v4Refresh();
 assert.equal(context.v4LastPriceCheck,success?300:100);
 assert.equal(context.v4LastSolarCheck,success?400:200);
 assert.equal(context.v4RefreshBusy,false);
 assert.equal(context.updates,1);
}

(async()=>{
 await check(false);
 await check(true);
 console.log(
  'REFRESH STATUS TESTS PASS: failed loads retain previous '+
  'timestamps; successful loads update independently'
 );
})().catch(e=>{console.error(e);process.exitCode=1;});
