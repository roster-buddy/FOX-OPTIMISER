
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
