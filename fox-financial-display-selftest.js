'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('app.js','utf8');
const a=source.indexOf('function renderFinancialComparison(');
const b=source.indexOf('// Project the selected plan to 23:30.',a);
assert.ok(a>=0&&b>a);
const output={innerHTML:''};
const c={
 settings:{capacity:10,efficiency:90,cheapImport:7},
 financialWearP:5,
 window:{FoxFinanceCore:require('./fox-finance-core.js')},
 document:{getElementById:id=>id==='financialComparison'?{}:output}
};
vm.createContext(c);
vm.runInContext(source.slice(a,b),c);
const baseline={importCost:1,revenue:0,end:8,dischargeStored:2};
const selected={importCost:1.2,revenue:2,end:5,dischargeStored:5,
 reached19:true,valid:true};
c.renderFinancialComparison(baseline,selected);
assert.match(output.innerHTML,/<th>Self-use<\/th><th>Selected plan<\/th>/);
assert.match(output.innerHTML,/Remaining assumed refill to 100%/);
assert.match(output.innerHTML,/−£0.41/,'Show negative energy cost as earnings');
assert.match(output.innerHTML,/Additional battery discharge: 3.00 kWh/);
assert.match(output.innerHTML,/Additional assumed wear at 5.0p\/kWh: £0.15/);
assert.match(output.innerHTML,/Estimated net benefit versus self-use: £1.42/);
c.financialWearP=0;
c.renderFinancialComparison(baseline,selected);
assert.match(output.innerHTML,/Estimated net benefit versus self-use: £1.57/);
c.renderFinancialComparison(baseline,{...selected,valid:false});
assert.match(output.innerHTML,/WARNING: reserve forecast fails/);
c.renderFinancialComparison(baseline,{...selected,reached19:false});
assert.match(output.innerHTML,/19:00 checkpoint unavailable/);
console.log('FINANCIAL DISPLAY PASS: strategy columns, refill, negative cost, additional wear, net benefit and reserve warnings');
