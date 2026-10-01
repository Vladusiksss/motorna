import assert from 'node:assert/strict';
import {partsIndexRequest,parsePartsIndexResults} from '../app/parts-index.ts';
let called=false;await assert.rejects(()=>partsIndexRequest('/v1/parts-by-vin/cars','',async()=>{called=true;}),/CATALOG_NOT_CONFIGURED/);assert.equal(called,false);
const ok=await partsIndexRequest('/v1/parts-by-vin/cars','test-only',async(url,init)=>{assert.equal(url,'https://api.parts-index.com/v1/parts-by-vin/cars');assert.equal(init.headers.Authorization,'test-only');assert.equal(init.redirect,'error');return Response.json({list:[]});});assert.deepEqual(ok,{list:[]});
await assert.rejects(()=>partsIndexRequest('/v1/parts-by-vin/cars','test-only',async()=>new Response('',{status:403})),/CATALOG_ACCESS_DENIED/);
for(const status of ['pending','in_progress','failed'])assert.equal(parsePartsIndexResults({status}).status,status);
assert.equal(parsePartsIndexResults({status:'success',list:[{code:'059121111N',name:'Thermostat',groups:[]}]}).list[0].code,'059121111N');
assert.throws(()=>parsePartsIndexResults({status:'success',list:[{code:'',name:'Bad',groups:[]}]}));
console.log('PASS: missing key, auth header, fixed host, denied access, pending states and validated part codes');
