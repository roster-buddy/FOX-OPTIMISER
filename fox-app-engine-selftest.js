'use strict';
const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');

const source=fs.readFileSync('app.js','utf8');
const start=source.indexOf('function simulateV2(');
const end=source.indexOf('\nfunction plan()',start);
assert(start>=0&&end>start,'Simulation function must exist');
const engine=source.slice(start,end);

function simulate({soc=100,home=0,solar=0,h=12,
                   minute=0,cheap=false,request=0}={}){
 const context={
  window:{FoxEnergyCore:require('./fox-energy-core.js')},
  settings:{
   capacity:10,soc,efficiency:90,
   cheapImport:7,peakImport:28
  },
  V2:{
   eveningTarget:.20,eveningMinimum:.05,
   gridExportLimitKw:3.5,
   estimatedChargeKw:5,batteryDischargeKw:5
  },
  hour:t=>h+(t===1800000&&minute===30?.5:0),
  mins:t=>t===1800000?(minute+30)%60:minute,
  cheap:()=>cheap,
  loadKwh:()=>home,
  solarKwh:()=>solar
 };
 // Supply the exact ending boundary for the 18:30 reserve check.
 if(h===18&&minute===30){
  context.hour=t=>t===1800000?19:18;
  context.mins=t=>t===1800000?0:30;
 }
 vm.createContext(context);
 vm.runInContext(
  engine+
  '\nresult=simulateV2([{start:0,rate:40}],{0:'+request+'});',
  context,{timeout:1000}
 );
 return context.result;
}

const close=(a,b)=>assert(Math.abs(a-b)<1e-8,`${a} != ${b}`);

// DC-side battery power convention: 5 kW for half an hour,
// with 90% conversion efficiency.
let r=simulate({soc:10,solar:20});
close(r.output[0].socEnd,32.5);

r=simulate({home:2,request:10});
close(r.output[0].kwh,.25);
close(r.output[0].socEnd,75);

r=simulate({home:10,request:10});
close(r.output[0].kwh,0);
close(r.output[0].socEnd,75);

r=simulate({request:10});
close(r.output[0].kwh,1.75);

r=simulate({h:20,request:10});
close(r.output[0].kwh,0);

r=simulate({soc:20,home:.3,h:18,minute:30});
assert(r.reached19);
assert.equal(r.valid,false);
close(r.output[0].kwh,0);

r=simulate({soc:5,home:10});
close(r.output[0].socEnd,5);

r=simulate({soc:10,home:10,cheap:true});
close(r.output[0].socEnd,32.5);
close(r.value,-(10+2.5)*7);

console.log(
 'APP ENGINE TESTS PASS: charge limits, combined discharge, '+
 'export cap, evening policy, minimum SOC and cheap charging'
);
