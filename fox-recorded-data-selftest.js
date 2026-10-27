'use strict';
const assert=require('node:assert/strict');
const data=require('./fox-recorded-data.js');
const dates=require('./fox-actual-costs.js');
for(const day of ['2026-10-26','2026-10-25','2026-03-29']){
 const w=dates.windowFor(day),now=w.end;
 const rows=Array.from({length:(w.end-w.start)/1800000},(_,i)=>({start:w.start+i*1800000,end:w.start+(i+1)*1800000,value:.5,source:'octopus',measured:true}));
 const rates=[{start:w.start,end:w.end,pence:23.2995,confirmed:true}];
 assert.equal(data.inspect(rows,w,now).total,rows.length*.5);
 assert(Math.abs(data.price(rows,rates,w,now).cost-rows.length*.5*.232995)<1e-9);
 assert.equal(data.inspect(rows.slice(1),w,now).available,false);
 assert.match(data.inspect([...rows,rows[0]],w,now).reason,/Duplicate/);
 assert.match(data.inspect([{...rows[0],start:w.start-1},...rows.slice(1)],w,now).reason,/boundary/);
 assert.equal(data.inspect(rows.map(r=>({...r,measured:false})),w,now).available,false);
 assert.equal(data.inspect(rows.map(r=>({...r,value:0})),w,now).total,0);
 assert.equal(data.inspect(rows.map(r=>({...r,value:-1})),w,now).available,false);
 assert.equal(data.inspect(rows,w,now-1).available,false);
 assert.equal(data.price(rows,[],w,now).cost,null);
 assert.equal(data.price(rows,[...rates,...rates],w,now).cost,null);
 assert.equal(data.price(rows,rates.map(r=>({...r,confirmed:false})),w,now).cost,null);
 assert(data.price(rows,rates.map(r=>({...r,pence:-5})),w,now).cost<0);
 const mixed=rates.map(r=>({...r,end:w.start+900000})).concat(rates.map(r=>({...r,start:w.start+900000,pence:3.4965})));
 assert.equal(data.price(rows,mixed,w,now).cost,null);
 assert.equal(data.price(rows,rates.map(r=>({...r,end:w.end-1800000})),w,now).cost,null);
}
console.log('RECORDED DATA PASS: actual pricing, gaps, overlaps, boundary crossings, unconfirmed rates and 23/24/25-hour days');
