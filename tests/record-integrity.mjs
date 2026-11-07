import {apiBoundary,dataConstraintFailure} from '../app/api-response.ts';
import {readJsonObject,jsonBodyFailure} from '../app/json-body.ts';
import {mutationGuard,MOTORNA_ORIGIN} from '../app/mutation-security.ts';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {registerHooks} from 'node:module';
import ts from 'typescript';
registerHooks({resolve(s,c,next){try{return next(s,c);}catch(e){if(s.startsWith('.')&&!s.endsWith('.ts'))return next(s+'.ts',c);throw e;}}});
const {schemas}=await import('../app/validation.ts');
const {recordQuery,recordPage,RecordQueryError}=await import('../app/record-query.ts');
const {purchaseRecordId,validPurchaseKey,samePurchaseInput}=await import('../app/purchase-idempotency.ts');
const {allowedSeller}=await import('../app/product-offers.ts');
const sqlite=new DatabaseSync(':memory:');sqlite.exec(readFileSync('drizzle/0000_conscious_richard_fisk.sql','utf8'));
let user={userId:'owner-a'},beforeWrite;
const db={prepare(sql){let args=[];return {bind(...v){args=v;return this;},async first(){return sqlite.prepare(sql).get(...args)||null;},async all(){return {results:sqlite.prepare(sql).all(...args)};},async run(){if(beforeWrite)await beforeWrite(sql,args);const result=sqlite.prepare(sql).run(...args);return {success:true,meta:{changes:Number(result.changes)}};}};}};
globalThis.integrityTest={apiBoundary,dataConstraintFailure,readJsonObject,jsonBodyFailure,mutationGuard,recordQuery,recordPage,RecordQueryError,schemas,purchaseRecordId,validPurchaseKey,samePurchaseInput,allowedSeller,getChatGPTUser:async()=>user,storage:async()=>({db})};
const source=readFileSync('app/api/records/route.ts','utf8').replace(/^import .*;\r?\n/gm,'');
const setup='const collectPhotoObjects=async()=>{};const {apiBoundary,dataConstraintFailure,readJsonObject,jsonBodyFailure,mutationGuard,recordQuery,recordPage,RecordQueryError,schemas,purchaseRecordId,validPurchaseKey,samePurchaseInput,allowedSeller,getChatGPTUser,storage}=globalThis.integrityTest;';
const route=await import('data:text/javascript;base64,'+Buffer.from(ts.transpileModule(setup+source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText).toString('base64'));
const car={name:'Test car',year:2021,engine:'2.0',vin:'1HGCM82633A004352',mileage:0,nextService:0};
function addCar(){const id=crypto.randomUUID();sqlite.prepare('INSERT INTO records VALUES (?,?,?,?,?)').run(id,'owner-a','car',JSON.stringify(car),1);return id;}
const line={title:'Test part',part:'Test part',oem:'TEST123',quantity:1,dataMode:'inquiry',fitment:'unverified'};
function payload(kind,carId){return kind==='expense'?{carId,title:'Repair',date:'2026-11-06',amount:10,mileage:100}:kind==='searchHistory'?{carId,vehicle:'Test car',problem:'Noise',parts:['Test part'],results:[],videos:[]}:{carId,lines:[line],note:'Test',status:'draft'};}
function create(kind,carId,key){return route.POST(new Request(MOTORNA_ORIGIN+'/api/records',{method:'POST',headers:{Origin:MOTORNA_ORIGIN,'Content-Type':'application/json',...(key?{'Idempotency-Key':key}:{})},body:JSON.stringify({kind,data:payload(kind,carId)})}));}
const remove=id=>route.DELETE(new Request(MOTORNA_ORIGIN+'/api/records?id='+id,{method:'DELETE',headers:{Origin:MOTORNA_ORIGIN}}));
function pauseWrite(predicate){let notify,release;const reached=new Promise(r=>notify=r),wait=new Promise(r=>release=r);beforeWrite=async(sql,args)=>{if(predicate(sql,args)){beforeWrite=undefined;notify();await wait;}};return {reached,release};}
function assertNoOrphans(){assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM records AS child WHERE json_extract(child.payload,'$.carId') IS NOT NULL AND NOT EXISTS(SELECT 1 FROM records AS parent WHERE parent.id=json_extract(child.payload,'$.carId') AND parent.owner=child.owner AND parent.kind='car')").get().n,0);}
try{
 const createCar=()=>route.POST(new Request(MOTORNA_ORIGIN+'/api/records',{method:'POST',headers:{Origin:MOTORNA_ORIGIN,'Content-Type':'application/json'},body:JSON.stringify({kind:'car',data:car})}));
 const repeatedCreates=await Promise.all(Array.from({length:8},createCar));const saved=await Promise.all(repeatedCreates.map(r=>r.json()));assert.equal(new Set(saved.map(r=>r.record.id)).size,1);assert.equal(saved.filter(r=>r.createdNew).length,1);assert.equal(sqlite.prepare("SELECT COUNT(*) n FROM records WHERE kind='car'").get().n,1);await remove(saved[0].record.id);
 for(const [kind,keyed] of [['expense',false],['searchHistory',false],['purchaseRequest',false],['purchaseRequest',true]]){
  // Parent disappears after authorization SELECT but before INSERT.
  let carId=addCar();const insertGate=pauseWrite((sql,args)=>sql.startsWith('INSERT INTO records')&&args[2]===kind);
  const pending=create(kind,carId,keyed?crypto.randomUUID():undefined);await insertGate.reached;
  assert.equal((await remove(carId)).status,200);insertGate.release();assert.equal((await pending).status,404);assertNoOrphans();
  // Child appears after the DELETE handler's read but before its write.
  carId=addCar();const deleteGate=pauseWrite(sql=>sql.startsWith('DELETE FROM records'));
  const deleting=remove(carId);await deleteGate.reached;
  const created=await create(kind,carId,keyed?crypto.randomUUID():undefined);assert.equal(created.status,201);const child=(await created.json()).record;
  deleteGate.release();assert.equal((await deleting).status,409);assert.ok(sqlite.prepare('SELECT id FROM records WHERE id=?').get(carId));assertNoOrphans();
  assert.equal((await remove(child.id)).status,200);assert.equal((await remove(carId)).status,200);assert.equal((await create(kind,carId)).status,404);assert.equal((await remove(carId)).status,404);
 }
 // All existing child types restrict deletion until the last dependent row is gone.
 const parent=addCar(),children=[];
 for(const kind of ['expense','searchHistory','purchaseRequest']){
  const response=await create(kind,parent,kind==='purchaseRequest'?crypto.randomUUID():undefined);assert.equal(response.status,201);children.push((await response.json()).record.id);
 }
 const snapshot=()=>sqlite.prepare('SELECT * FROM records ORDER BY id').all();
 for(const childId of children){
  const before=snapshot();const denied=await remove(parent);assert.equal(denied.status,409);assert.equal((await denied.json()).code,'CONFLICT');assert.deepEqual(snapshot(),before,'Blocked deletion must preserve every record');
  assert.equal((await remove(childId)).status,200);assert.equal((await remove(childId)).status,404);assertNoOrphans();
 }
 assert.equal((await remove(parent)).status,200);assert.equal((await remove(parent)).status,404);
 for(const kind of ['expense','searchHistory','purchaseRequest'])assert.equal((await create(kind,parent,kind==='purchaseRequest'?crypto.randomUUID():undefined)).status,404);
 // Concurrent DELETE succeeds once; subsequent attempts leave the database unchanged.
 const repeated=addCar();const deletions=await Promise.all(Array.from({length:6},()=>remove(repeated)));assert.deepEqual(deletions.map(r=>r.status).sort(),[200,404,404,404,404,404]);assertNoOrphans();
 const changing=addCar(),updateGate=pauseWrite(sql=>sql.startsWith('UPDATE records'));
 const patch=route.PATCH(new Request(MOTORNA_ORIGIN+'/api/records',{method:'PATCH',headers:{Origin:MOTORNA_ORIGIN,'Content-Type':'application/json'},body:JSON.stringify({id:changing,data:{...car,mileage:500}})}));await updateGate.reached;assert.equal((await remove(changing)).status,200);updateGate.release();assert.equal((await patch).status,404,'PATCH must not report an already deleted car as saved');
 const owned=addCar();user={userId:'owner-b'};assert.equal((await create('expense',owned)).status,404);assert.equal((await create('searchHistory',owned)).status,404);assert.equal((await create('purchaseRequest',owned,crypto.randomUUID())).status,404);assert.equal((await remove(owned)).status,404);assertNoOrphans();
 console.log('PASS: INSERT/DELETE races in both orders for expenses, history and keyed/unkeyed requests; combined existing dependents, state-preserving 409, sequential/concurrent repeated DELETE, stale parents, owner isolation, no orphans');
}finally{sqlite.close();delete globalThis.integrityTest;}
