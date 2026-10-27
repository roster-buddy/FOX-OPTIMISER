
const assert=require('node:assert/strict');
const {test}=require('./fox-integrated-v25.js');
for(const kind of ['missing','stale']){
 const r=test(kind);
 assert.equal(r.blocked,2);
 assert.equal(r.outageExport,0);
 assert(r.recoveredExport>0);
 assert(r.pass);
 assert(r.residual<1e-8);
}
console.log('V2.5 TESTS PASS: outages block forced exports; recovery resumes export; reserve passes');
