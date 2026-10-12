import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import ts from 'typescript';
const sqlite=new DatabaseSync(':memory:');
sqlite.exec('CREATE TABLE records(id TEXT,owner TEXT,kind TEXT,payload TEXT);CREATE TABLE documents(id TEXT,owner TEXT,name TEXT,mime TEXT,size INTEGER);CREATE TABLE car_documents(document_id TEXT,car_id TEXT,owner TEXT);CREATE TABLE car_shares(token TEXT PRIMARY KEY,owner TEXT,car_id TEXT,payload TEXT,document_ids TEXT,created INTEGER)');
let user={userId:'owner-a'};
globalThis.catalogTest={getChatGPTUser:async()=>user,catalogDb:async()=>({db:{prepare(sql){let args=[];return {bind(...v){args=v;return this},async first(){return sqlite.prepare(sql).get(...args)},async all(){return {results:sqlite.prepare(sql).all(...args)}},async run(){return sqlite.prepare(sql).run(...args)}}}},bucket:{get:async()=>({body:'receipt'})}}),shareHeaders:{'Cache-Control':'no-store'}};
async function route(path){let source=readFileSync(path,'utf8').replace(/^import .*;\r?\n/gm,'');source="import {z} from 'zod';\n"+source;source=source.replace("import {z} from 'zod';",'const z=globalThis.catalogTest.z;const {getChatGPTUser,catalogDb,shareHeaders}=globalThis.catalogTest;');globalThis.catalogTest.z=(await import('zod')).z;return import('data:text/javascript;base64,'+Buffer.from(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText).toString('base64'));}
const owner=await route('app/api/car-catalog/route.ts'),publicApi=await route('app/api/shared-car/[token]/route.ts');
const carId=crypto.randomUUID(),docId=crypto.randomUUID(),privateDoc=crypto.randomUUID();
sqlite.prepare('INSERT INTO records VALUES (?,?,?,?)').run(carId,'owner-a','car',JSON.stringify({name:'Тестове авто',year:2021,vin:'TEST',mileage:100}));
for(const id of [docId,privateDoc]){sqlite.prepare('INSERT INTO documents VALUES (?,?,?,?,?)').run(id,'owner-a','Чек.pdf','application/pdf',100);sqlite.prepare('INSERT INTO car_documents VALUES (?,?,?)').run(id,carId,'owner-a');}
const post=(ids,token)=>owner.POST(new Request('https://test/api/car-catalog',{method:'POST',body:JSON.stringify({carId,documentIds:ids,token})}));
user=null;assert.equal((await post([])).status,401);
user={userId:'owner-b'};assert.equal((await post([])).status,404);
user={userId:'owner-a'};let res=await post([docId]);assert.equal(res.status,200);const {token}=await res.json();assert.match(token,/^[a-f0-9]{64}$/);
const read=(doc)=>publicApi.GET(new Request('https://test/api/shared-car/'+token+(doc?'?document='+doc:'')),{params:Promise.resolve({token})});
user=null;res=await read();const catalog=await res.json();assert.equal(catalog.documents.length,1);assert.equal(catalog.documents[0].id,docId);assert.equal(catalog.owner,undefined);assert.equal((await read(privateDoc)).status,404);assert.equal((await read(docId)).status,200);
user={userId:'owner-b'};await owner.DELETE(new Request('https://test?token='+token));assert.equal((await read()).status,200);
user={userId:'owner-a'};await post([],token);assert.equal((await read(docId)).status,404);await owner.DELETE(new Request('https://test?token='+token));assert.equal((await read()).status,404);
console.log('PASS: owner isolation, anonymous snapshot, receipt opt-in, updates, revocation');
