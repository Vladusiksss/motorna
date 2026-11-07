import {apiBoundary,dataConstraintFailure} from '../app/api-response.ts';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {registerHooks} from 'node:module';
import {DatabaseSync} from 'node:sqlite';
import ts from 'typescript';
registerHooks({resolve(s,c,next){try{return next(s,c);}catch(e){if(s.startsWith('.')&&!s.endsWith('.ts'))return next(s+'.ts',c);throw e;}}});
const {recordQuery,recordPage,RecordQueryError}=await import('../app/record-query.ts');
const db=new DatabaseSync(':memory:');db.exec(readFileSync('drizzle/0000_conscious_richard_fisk.sql','utf8'));
const carA=crypto.randomUUID(),carB=crypto.randomUUID();
const insert=(id,owner,kind,created,carId)=>db.prepare('INSERT INTO records VALUES (?,?,?,?,?)').run(id,owner,kind,JSON.stringify(carId?{carId}:{}),created);
insert(carA,'a','car',500);insert(carB,'a','car',500);
for(let n=0;n<243;n++)insert(crypto.randomUUID(),'a',n%2?'expense':'searchHistory',1000+Math.floor(n/70),n%3?carA:carB);
for(let n=0;n<20;n++)insert(crypto.randomUUID(),'b','expense',1002,carA);
const before=db.prepare('SELECT COUNT(*) AS n FROM records').get().n;
db.exec(readFileSync('drizzle/0001_records_pagination_indexes.sql','utf8'));assert.equal(db.prepare('SELECT COUNT(*) AS n FROM records').get().n,before,'Index migration preserves rows');
let owner='a';
globalThis.paginationTest={apiBoundary:(task,route)=>apiBoundary(task,route),dataConstraintFailure,recordQuery,recordPage,RecordQueryError,getChatGPTUser:async()=>owner?{userId:owner,displayName:'Test',email:'test@example.test'}:null,storage:async()=>({db:{prepare(sql){let values=[];return {bind(...v){values=v;return this;},async all(){return {results:db.prepare(sql).all(...values)};},async first(){return db.prepare(sql).get(...values)||null;}};}}})};
const source=readFileSync('app/api/records/route.ts','utf8').replace(/^import .*;\r?\n/gm,'');
const setup='const {apiBoundary,dataConstraintFailure,recordQuery,recordPage,RecordQueryError,getChatGPTUser,storage}=globalThis.paginationTest;';
const route=await import('data:text/javascript;base64,'+Buffer.from(ts.transpileModule('const collectPhotoObjects=async()=>{};\n'+setup+source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText).toString('base64'));
const response=query=>route.GET(new Request('https://test/api/records'+(query?'?'+query:'')));
const page=async params=>{const r=await response(params);assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'private, no-store');return r.json();};
try{
 const first=await page('');assert.equal(first.records.length,50);assert.equal(first.page.total,245);assert.ok(first.page.hasMore&&first.page.nextCursor);
 const expected=db.prepare('SELECT id FROM records WHERE owner=? ORDER BY created DESC,id DESC').all('a').map(r=>r.id),seen=[];let query='limit=17';
 for(let n=0;n<30;n++){const d=await page(query);seen.push(...d.records.map(r=>r.id));if(!d.page.hasMore){assert.equal(d.page.nextCursor,null);break;}query='limit=17&cursor='+d.page.nextCursor;}
 assert.deepEqual(seen,expected);assert.equal(new Set(seen).size,seen.length,'Tied timestamps have no duplicates or omissions');
 const filtered=await page('kind=expense&carId='+carA+'&from=1001&to=1002&limit=100');const direct=db.prepare("SELECT id FROM records WHERE owner='a' AND kind='expense' AND json_extract(payload,'$.carId')=? AND created>=1001 AND created<=1002 ORDER BY created DESC,id DESC").all(carA).map(r=>r.id);assert.deepEqual(filtered.records.map(r=>r.id),direct);assert.equal(filtered.page.total,direct.length);
 assert.equal((await page('kind=car&id='+carA)).records[0].id,carA);assert.equal((await page('id='+crypto.randomUUID())).records.length,0);
 for(const bad of ['limit=0','limit=101','limit=-1','limit=1.5','limit=no','limit=','kind=constructor','kind=__proto__','kind=nope','kind=car&kind=expense','carId=wrong','from=no','from=2&to=1','owner=b','cursor=bad','cursor=','limit=1&limit=2'])assert.equal((await response(bad)).status,400,bad);
 assert.equal((await response('kind=expense&cursor='+first.page.nextCursor)).status,400,'Cursor is bound to filters');
 owner='b';assert.equal((await response('cursor='+first.page.nextCursor)).status,400,'Cursor is bound to the authenticated owner');assert.equal((await page('')).page.total,20);owner=null;assert.equal((await response('')).status,401);owner='a';
 const newcomer=crypto.randomUUID();insert(newcomer,'a','expense',2000,carA);const next=await page('cursor='+first.page.nextCursor);assert.ok(!next.records.some(r=>r.id===newcomer));assert.ok(!next.records.some(r=>first.records.some(v=>v.id===r.id)));
 const cases=[['','idx_records_owner_created_id'],['kind=expense','idx_records_owner_kind_created_id'],['carId='+carA,'idx_records_owner_car_created_id'],['kind=expense&carId='+carA,'idx_records_owner_kind_car_created_id']];
 for(const [filter,index] of cases){const q=await recordQuery('a',new URLSearchParams(filter));const plan=db.prepare('EXPLAIN QUERY PLAN '+q.sql).all(...q.values).map(r=>r.detail).join(' ');assert.ok(plan.includes(index),plan);assert.ok(!plan.includes('USE TEMP B-TREE'),plan);}
 console.log('PASS: bounded pages, stable cursor ties, filters/date bounds, owner isolation, invalid cursors and indexed query plans without temp sorting');
}finally{db.close();delete globalThis.paginationTest;}
