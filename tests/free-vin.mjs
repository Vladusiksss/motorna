import assert from 'node:assert/strict';
import {mergeFreeVin,enrichFreeVin} from '../app/free-vin.ts';
const base={vin:'WVWZZZ1JZXW000001',make:'VOLKSWAGEN',model:'',year:'',engine:'',fields:[],source:'NHTSA vPIC',warning:'',checkedAt:'2026-10-12'};
const data={vin:base.vin,brand:'Volkswagen',model:'Golf',year:1999,fuelType:'Petrol',color:'Black'};
assert.equal(mergeFreeVin(base,{...data,brand:'Mazda'}),base);
assert.equal(mergeFreeVin(base,{...data,vin:'WAUZZZ8K9DA123456'}),base);
assert.equal(mergeFreeVin(base,{...data,year:1900}),base);
assert.equal(mergeFreeVin(base,null),base);
const result=mergeFreeVin(base,data);
assert.equal(result.model,'Golf');assert.equal(result.needsConfirmation,true);
assert.ok(result.fields.some(f=>f.label==='Колір'&&f.value==='Black'));
const known={...base,model:'Golf',year:'1999'};
assert.equal(mergeFreeVin(known,{...data,model:'Passat'}),known);
const previous=globalThis.fetch;
try{
 globalThis.fetch=async()=>{throw Error('Unavailable');};
 assert.equal(await enrichFreeVin(base),base);
 globalThis.fetch=async()=>new Response(JSON.stringify({...data,brand:'Mazda'}),{headers:{'content-type':'application/json'}});
 assert.equal(await enrichFreeVin(base),base);
 globalThis.fetch=async()=>new Response(JSON.stringify(data),{headers:{'content-type':'application/json'}});
 assert.equal((await enrichFreeVin(base)).needsConfirmation,true);
}finally{globalThis.fetch=previous;}
console.log('PASS: VIN/brand checks, conflicting records, unverified enrichment and provider failure fallback');
