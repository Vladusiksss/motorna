import {apiBoundary} from '../app/api-response.ts';
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
const {purchaseText}=await import('../app/purchase-model.ts');
const {boundedUpload,verifyDocument,UploadError}=await import('../app/document-upload.ts');
const {z}=await import('zod');
const sqlite=new DatabaseSync(':memory:');
sqlite.exec(readFileSync('drizzle/0000_conscious_richard_fisk.sql','utf8'));
sqlite.exec('CREATE TABLE car_documents(document_id TEXT PRIMARY KEY,car_id TEXT,owner TEXT);CREATE TABLE car_shares(token TEXT PRIMARY KEY,owner TEXT,car_id TEXT,payload TEXT,document_ids TEXT,created INTEGER)');
const db={prepare(sql){let args=[];return {bind(...values){args=values;return this;},async first(){return sqlite.prepare(sql).get(...args)||null;},async all(){return {results:sqlite.prepare(sql).all(...args)};},async run(){const result=sqlite.prepare(sql).run(...args);return {success:true,meta:{changes:Number(result.changes)}};}};}};
const objects=new Map();
const bucket={async put(key,value){objects.set(key,new Uint8Array(value));},async get(key){const body=objects.get(key);return body?{body}:null;},async delete(key){objects.delete(key);}};
let user={userId:'owner-a',displayName:'A',email:'a@example.test'};
globalThis.securityTest={apiBoundary,readJsonObject,jsonBodyFailure,mutationGuard,recordQuery,recordPage,RecordQueryError,purchaseRecordId,validPurchaseKey,samePurchaseInput,schemas,allowedSeller,purchaseText,boundedUpload,verifyDocument,UploadError,z,getChatGPTUser:async()=>user,storage:async()=>({db,bucket}),catalogDb:async()=>({db,bucket}),shareHeaders:{'Cache-Control':'no-store'}};
async function route(path){const source=readFileSync(path,'utf8').replace(/^import .*;\r?\n/gm,'');const setup='const {apiBoundary,readJsonObject,jsonBodyFailure,mutationGuard,recordQuery,recordPage,RecordQueryError,purchaseRecordId,validPurchaseKey,samePurchaseInput,schemas,allowedSeller,purchaseText,boundedUpload,verifyDocument,UploadError,z,getChatGPTUser,storage,catalogDb,shareHeaders}=globalThis.securityTest;\n';return import('data:text/javascript;base64,'+Buffer.from(ts.transpileModule('const collectPhotoObjects=async()=>{};\n'+setup+source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText).toString('base64'));}
const records=await route('app/api/records/route.ts'),documents=await route('app/api/documents/route.ts'),document=await route('app/api/documents/[id]/route.ts'),requests=await route('app/api/purchase-request/[id]/route.ts'),shares=await route('app/api/car-catalog/route.ts'),publicShare=await route('app/api/shared-car/[token]/route.ts');
const carA=crypto.randomUUID(),carB=crypto.randomUUID();
const car={name:'TEST Honda',year:2003,engine:'3.0',vin:'1HGCM82633A004352',mileage:100,nextService:200};
for(const [id,owner] of [[carA,'owner-a'],[carB,'owner-b']])sqlite.prepare('INSERT INTO records VALUES (?,?,?,?,?)').run(id,owner,'car',JSON.stringify(car),0);
const json=(path,data,method='POST',headers={})=>new Request(MOTORNA_ORIGIN+'/'+path,{method,headers:{Origin:MOTORNA_ORIGIN,'Content-Type':'application/json',...headers},body:JSON.stringify(data)});
const context=id=>({params:Promise.resolve({id})});
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1cAAAAASUVORK5CYII=','base64');
function upload(carId,content=png,type='image/png'){const form=new FormData();form.set('file',new File([content],'receipt.png',{type}));form.set('carId',carId);return new Request(MOTORNA_ORIGIN+'/api/documents',{method:'POST',headers:{Origin:MOTORNA_ORIGIN},body:form});}
try{
 assert.equal((await records.GET()).headers.get('cache-control'),'private, no-store');
 assert.equal((await documents.GET()).headers.get('cache-control'),'private, no-store');
 // Oversized and malformed request bodies are rejected before writes, including dishonest headers.
 const initial=sqlite.prepare('SELECT COUNT(*) AS n FROM records').get().n;
 for(const method of ['POST','PATCH']){
  const request=new Request(MOTORNA_ORIGIN+'/api/records',{method,headers:{Origin:MOTORNA_ORIGIN,'Content-Type':'application/json','Content-Length':'1'},body:JSON.stringify({padding:'x'.repeat(60000)})});
  const response=await records[method](request);assert.equal(response.status,413);assert.equal((await response.json()).code,'JSON_BODY_TOO_LARGE');
 }
 assert.equal((await records.POST(new Request(MOTORNA_ORIGIN+'/api/records',{method:'POST',headers:{Origin:MOTORNA_ORIGIN,'Content-Type':'application/json'},body:'{'}))).status,400);
 assert.equal((await shares.POST(json('api/car-catalog',{padding:'x'.repeat(10000)}))).status,413);
 assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM records').get().n,initial);
 assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM car_shares').get().n,0);
 let response=await documents.POST(upload(carA));assert.equal(response.status,201);const docA=(await response.json()).document.id;
 assert.equal((await documents.POST(upload(carA,Buffer.from('<html>not a PNG</html>')))).status,400);
 assert.equal((await documents.POST(upload(carA,Buffer.alloc(5*1024*1024+1)))).status,400);
 // Authenticated cross-origin attempts must not mutate existing data.
 const beforeRecords=sqlite.prepare('SELECT COUNT(*) AS n FROM records').get().n;
 for(const origin of ['null','https://evil.test']){
  assert.equal((await records.POST(json('api/records',{kind:'car',data:car},'POST',{Origin:origin}))).status,403);
  assert.equal((await records.PATCH(json('api/records',{id:carA,data:{...car,mileage:999}},'PATCH',{Origin:origin}))).status,403);
  assert.equal((await records.DELETE(new Request(MOTORNA_ORIGIN+'/api/records?id='+carA,{method:'DELETE',headers:{Origin:origin}}))).status,403);
  assert.equal((await shares.POST(json('api/car-catalog',{carId:carA,documentIds:[docA]},'POST',{Origin:origin}))).status,403);
  assert.equal((await document.DELETE(new Request(MOTORNA_ORIGIN+'/api/documents/'+docA,{method:'DELETE',headers:{Origin:origin}}),context(docA))).status,403);
 }
 assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM records').get().n,beforeRecords);
 assert.equal(JSON.parse(sqlite.prepare('SELECT payload FROM records WHERE id=?').get(carA).payload).mileage,100);
 assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM car_shares').get().n,0);
 assert.equal((await document.GET(new Request(MOTORNA_ORIGIN),context(docA))).status,200);
 // Route-level streaming limits and Origin checks must have no DB/R2 side effects.
 const state=()=>({tables:['records','documents','car_documents','car_shares'].map(table=>sqlite.prepare('SELECT * FROM '+table+' ORDER BY rowid').all()),objects:[...objects].map(([key,value])=>[key,[...value]])});
 const expected=state();
 async function denied(response,status,code){assert.equal(response.status,status);const body=await response.json();assert.equal(body.code,code);assert.ok(body.message);assert.equal(body.requestId,response.headers.get('x-request-id'));assert.deepEqual(state(),expected);}
 function streamRequest(method,headers,chunks,path='records'){let pulls=0,cancelled=false;const stream=new ReadableStream({pull(controller){if(pulls<chunks.length)controller.enqueue(new TextEncoder().encode(chunks[pulls++]));else controller.close();},cancel(){cancelled=true;}},{highWaterMark:0});return {request:new Request(MOTORNA_ORIGIN+'/api/'+path,{method,headers,body:stream,duplex:'half'}),get pulls(){return pulls},get cancelled(){return cancelled}};}
 for(const method of ['POST','PATCH'])for(const length of [undefined,'1']){
  const input=streamRequest(method,{Origin:MOTORNA_ORIGIN,'Content-Type':'application/json',...(length?{'Content-Length':length}:{})},['{',' '.repeat(60000),'never read']);
  await denied(await records[method](input.request),413,'JSON_BODY_TOO_LARGE');assert.equal(input.pulls,2);assert.equal(input.cancelled,true);
 }
 for(const length of [undefined,'1']){
  const input=streamRequest('POST',{Origin:MOTORNA_ORIGIN,'Content-Type':'multipart/form-data; boundary=safety',...(length?{'Content-Length':length}:{})},['--safety\r\n','x'.repeat(6*1024*1024),'never read'],'documents');
  await denied(await documents.POST(input.request),413,'PAYLOAD_TOO_LARGE');assert.equal(input.pulls,2);assert.equal(input.cancelled,true);
 }
 // The same JSON is valid at the exact byte boundary, including multibyte text.
 const valid=JSON.stringify({kind:'car',data:{...car,vin:'JHMCM56543C123456',name:'Авто Україна'}});const bytes=new TextEncoder().encode(valid).length;
 const exact=new Request(MOTORNA_ORIGIN+'/api/records',{method:'POST',headers:{Origin:MOTORNA_ORIGIN,'Content-Type':'application/json'},body:valid+' '.repeat(60000-bytes)});
 const accepted=await records.POST(exact);assert.equal(accepted.status,201);const acceptedId=(await accepted.json()).record.id;
 assert.equal((await records.DELETE(new Request(MOTORNA_ORIGIN+'/api/records?id='+acceptedId,{method:'DELETE',headers:{Origin:MOTORNA_ORIGIN}}))).status,200);assert.deepEqual(state(),expected);
 const badHeaders=[{}, {Origin:''},{Origin:'null'},{Origin:'https://evil.test'},{Origin:MOTORNA_ORIGIN+'.evil.test'},{Origin:MOTORNA_ORIGIN+'/'},{Origin:MOTORNA_ORIGIN+':8443'},{Origin:MOTORNA_ORIGIN.replace('https:','http:')},{Origin:'https://user@'+new URL(MOTORNA_ORIGIN).host},{Origin:MOTORNA_ORIGIN+', https://evil.test'},{Origin:MOTORNA_ORIGIN,'Sec-Fetch-Site':'same-site'},{Origin:MOTORNA_ORIGIN,Referer:'https://evil.test/'},{Origin:'https://evil.test','X-Forwarded-Host':'evil.test',Forwarded:'host=evil.test'}];
 for(const headers of badHeaders){
  const input=streamRequest('POST',{'Content-Type':'application/json',...headers},[JSON.stringify({kind:'car',data:car})]);
  await denied(await records.POST(input.request),403,'CSRF_REJECTED');assert.equal(input.pulls,0,'Origin rejection must precede body reading');
  await denied(await records.PATCH(new Request(MOTORNA_ORIGIN+'/api/records',{method:'PATCH',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify({id:carA,data:{...car,mileage:999}})})),403,'CSRF_REJECTED');
  await denied(await records.DELETE(new Request(MOTORNA_ORIGIN+'/api/records?id='+carA,{method:'DELETE',headers})),403,'CSRF_REJECTED');
  await denied(await shares.POST(new Request(MOTORNA_ORIGIN+'/api/car-catalog',{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify({carId:carA,documentIds:[]})})),403,'CSRF_REJECTED');
  const form=new FormData();form.set('file',new File([png],'receipt.png',{type:'image/png'}));form.set('carId',carA);
  await denied(await documents.POST(new Request(MOTORNA_ORIGIN+'/api/documents',{method:'POST',headers,body:form})),403,'CSRF_REJECTED');
  await denied(await document.DELETE(new Request(MOTORNA_ORIGIN+'/api/documents/'+docA,{method:'DELETE',headers}),context(docA)),403,'CSRF_REJECTED');
 }
 const draft={carId:carA,lines:[{title:'Test inquiry',part:'Термостат',oem:'TEST123',quantity:1,dataMode:'inquiry',fitment:'unverified'}],note:'',status:'draft'};
 response=await records.POST(json('api/records',{kind:'purchaseRequest',data:draft}));assert.equal(response.status,201);const requestA=(await response.json()).record.id;
 const key=crypto.randomUUID();
 const submit=(data=draft,requestKey=key)=>records.POST(json('api/records',{kind:'purchaseRequest',data},'POST',{'Idempotency-Key':requestKey}));
 const concurrent=await Promise.all(Array.from({length:5},()=>submit()));
 assert.ok(concurrent.every(r=>r.status===201));
 const duplicates=await Promise.all(concurrent.map(r=>r.json()));
 const first=duplicates[0].record;
 assert.ok(duplicates.every(d=>d.record.id===first.id&&d.record.created===first.created));
 assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM records WHERE id=?').get(first.id).n,1);
 assert.deepEqual((await (await submit()).json()).record,first,'Lost-response retry returns the original snapshot');
 assert.equal((await submit({...draft,note:'Changed input'})).status,409);
 assert.equal((await submit(draft,'bad-key')).status,400);
 const independent=await (await submit(draft,crypto.randomUUID())).json();assert.notEqual(independent.record.id,first.id);
 user={userId:'owner-b',displayName:'B',email:'b@example.test'};
 const otherOwner=await (await submit({...draft,carId:carB})).json();assert.notEqual(otherOwner.record.id,first.id,'Keys are scoped to the authenticated owner');

 assert.ok(!(await (await records.GET()).json()).records.some(r=>r.id===carA||r.id===requestA));
 assert.equal((await records.PATCH(json('api/records',{id:carA,data:car},'PATCH'))).status,404);
 assert.equal((await records.DELETE(new Request(MOTORNA_ORIGIN+'/api/records?id='+carA,{method:'DELETE',headers:{Origin:MOTORNA_ORIGIN}}))).status,404);
 assert.equal((await records.POST(json('api/records',{kind:'expense',data:{carId:carA,title:'Test repair',date:'2026-11-01',amount:10,mileage:100}}))).status,404);
 assert.equal((await records.POST(json('api/records',{kind:'purchaseRequest',data:draft}))).status,404);
 assert.equal((await requests.GET(new Request(MOTORNA_ORIGIN+''),context(requestA))).status,404);
 assert.equal((await document.GET(new Request(MOTORNA_ORIGIN+''),context(docA))).status,404);
 assert.equal((await document.DELETE(new Request(MOTORNA_ORIGIN+'',{method:'DELETE',headers:{Origin:MOTORNA_ORIGIN}}),context(docA))).status,404);
 assert.equal((await documents.POST(upload(carA))).status,400);
 assert.equal((await (await documents.GET()).json()).documents.length,0);
 response=await documents.POST(upload(carB));assert.equal(response.status,201);const docB=(await response.json()).document.id;
 user={userId:'owner-a',displayName:'A',email:'a@example.test'};
 assert.equal((await shares.POST(json('api/car-catalog',{carId:carA,documentIds:[docB]}))).status,400);
 response=await shares.POST(json('api/car-catalog',{carId:carA,documentIds:[docA]}));assert.equal(response.status,200);const token=(await response.json()).token;
 const readShared=(id)=>publicShare.GET(new Request(MOTORNA_ORIGIN+'/api/shared-car/'+token+(id?'?document='+id:'')),{params:Promise.resolve({token})});
 user=null;
 assert.equal((await records.GET()).status,401);assert.equal((await documents.GET()).status,401);
 assert.equal((await requests.GET(new Request(MOTORNA_ORIGIN+''),context(requestA))).status,401);
 response=await readShared(docA);assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(response.headers.get('x-content-type-options'),'nosniff');
 assert.equal((await readShared(docB)).status,404);
 user={userId:'owner-b'};await shares.DELETE(new Request(MOTORNA_ORIGIN+'/api/car-catalog?token='+token,{method:'DELETE',headers:{Origin:MOTORNA_ORIGIN}}));assert.equal((await readShared(docA)).status,200);
 user={userId:'owner-a'};
 assert.equal((await shares.DELETE(new Request(MOTORNA_ORIGIN+'/api/car-catalog?token='+token,{method:'DELETE',headers:{Origin:MOTORNA_ORIGIN,'sec-fetch-site':'cross-site'}}))).status,403);
 assert.equal((await shares.DELETE(new Request(MOTORNA_ORIGIN+'/api/car-catalog?token='+token,{method:'DELETE',headers:{Origin:MOTORNA_ORIGIN}}))).status,200);
 const revoked=state();assert.equal((await shares.DELETE(new Request(MOTORNA_ORIGIN+'/api/car-catalog?token='+token,{method:'DELETE',headers:{Origin:MOTORNA_ORIGIN}}))).status,200);assert.deepEqual(state(),revoked);
 assert.equal((await readShared()).status,404);assert.equal((await readShared(docA)).status,404,'Saved document URL must stop working after revocation');
 assert.equal((await document.GET(new Request(MOTORNA_ORIGIN+''),context(docA))).status,200,'Owner retains private receipt after share revocation');
 assert.equal((await document.DELETE(new Request(MOTORNA_ORIGIN+'/api/documents/'+docA,{method:'DELETE',headers:{Origin:MOTORNA_ORIGIN}}),context(docA))).status,200);
 assert.equal(sqlite.prepare('SELECT id FROM documents WHERE id=?').get(docA),undefined);assert.equal(objects.has('owner-a/'+docA),false);
 const deleted=state();assert.equal((await document.DELETE(new Request(MOTORNA_ORIGIN+'/api/documents/'+docA,{method:'DELETE',headers:{Origin:MOTORNA_ORIGIN}}),context(docA))).status,404);assert.deepEqual(state(),deleted);assert.ok(sqlite.prepare('SELECT id FROM documents WHERE id=?').get(docB),'Other owner receipt must survive repeated deletion');
 for(const bad of ['http://prom.ua/x','https://prom.ua.evil.test/x','https://localhost/x','https://127.0.0.1/x','https://prom.ua:8443/x','https://user:pass@prom.ua/x'])assert.equal(allowedSeller(bad),false,bad);
 console.log('PASS: A/B record, expense, request and document isolation; upload signatures/size; anonymous refusal; QR opt-in and saved URL revocation; seller URL boundary; concurrent idempotency, retry snapshots and key conflicts');
}finally{sqlite.close();delete globalThis.securityTest;}
