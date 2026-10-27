
const assert=require('node:assert/strict');
const {gate,cases}=require('./fox-data-checks-v24.js');
for(const [name,result,expected] of cases())
 assert.equal(result.kw,expected,name);
const now=1000000;
const d={
 soc:{value:80,at:now},
 solarKW:{value:0,at:now},
 homeKW:{value:.3,at:now}
};
for(const key of Object.keys(d)){
 assert.equal(gate(now,{...d,[key]:null},2).kw,0);
 assert.equal(gate(now,{
  ...d,[key]:{value:NaN,at:now}
 },2).kw,0);
 assert.equal(gate(now,{
  ...d,[key]:{value:d[key].value,at:now-120001}
 },2).kw,0);
}
assert.equal(gate(now,d,-1).kw,0);
assert.equal(gate(now,d,Infinity).kw,0);
assert.equal(gate(now+120000,d,2).kw,2);
assert.equal(gate(now+120001,d,2).kw,0);
assert.equal(gate(now,{...d,soc:{value:101,at:now}},2).kw,0);
console.log('V2.4 TESTS PASS: fresh, missing, stale, invalid and recovery cases');

// Solar-aware net export headroom regression
{
 const at=1000000;
 const readings=(solar,home)=>({
  soc:{value:80,at},
  solarKW:{value:solar,at},
  homeKW:{value:home,at}
 });
 const near=(actual,expected)=>
  assert(Math.abs(actual-expected)<1e-9);

 near(gate(at,readings(2.3,.3),3.5).kw,1.5);
 near(gate(at,readings(3.8,.3),3.5).kw,0);
 near(gate(at,readings(5,.3),3.5).kw,0);
 near(gate(at,readings(0,.3),3.5).kw,3.5);
 near(gate(at,readings(2.3,.3),1).kw,1);

 for(const solar of [0,.5,2,3.5,5]){
  for(const home of [0,.3,1]){
   const result=gate(at,readings(solar,home),5);
   assert(result.kw>=0&&result.kw<=3.5);
   if(solar-home<=3.5){
    assert(
     result.kw+Math.max(0,solar-home)<=3.5+1e-9
    );
   }else{
    assert.equal(result.kw,0);
   }
  }
 }
 console.log('PASS: solar surplus reduces battery export headroom');
}
