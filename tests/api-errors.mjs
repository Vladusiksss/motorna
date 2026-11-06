import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import ts from 'typescript';
import {apiBoundary} from '../app/api-response.ts';
import {readApi,apiErrorSchema,ApiError} from '../app/api-contracts.ts';
const logged=[],warn=console.warn;console.warn=value=>logged.push(JSON.parse(value));
try{
 const ids=new Set();
 for(const status of [400,401,403,404,405,409,410,413,415,422,429,500,502,503,504]){
  const response=await apiBoundary(async()=>new Response('private plain response',{status,headers:{'Content-Type':'text/plain','X-Request-Id':'spoofed','Retry-After':'2','Allow':'GET'}}),'/api/test');
  const body=apiErrorSchema.parse(await response.json());assert.equal(response.status,status);assert.match(response.headers.get('content-type'),/^application\/json/);assert.equal(body.requestId,response.headers.get('x-request-id'));assert.equal(response.headers.get('retry-after'),'2');assert.equal(response.headers.get('allow'),'GET');assert.equal(response.headers.get('cache-control'),'private, no-store');assert.equal(response.headers.get('x-content-type-options'),'nosniff');assert.ok(!body.message.includes('private'));assert.ok(!ids.has(body.requestId));ids.add(body.requestId);assert.deepEqual(Object.keys(body).sort(),['code','message','requestId']);assert.equal(logged.at(-1).requestId,body.requestId);assert.equal(logged.at(-1).status,status);
 }
 let response=await apiBoundary(async()=>Response.json({error:'Перевірте VIN.',code:'VIN_NOT_VERIFIED',photos:[]},{status:400}),'/api/test');let body=await response.json();assert.equal(body.message,'Перевірте VIN.');assert.equal(body.code,'VIN_NOT_VERIFIED');assert.equal(body.error,undefined);assert.equal(body.photos,undefined);
 response=await apiBoundary(async()=>Response.json({message:'Нове повідомлення',code:'INVALID_REQUEST',requestId:crypto.randomUUID()},{status:400}),'/api/test');body=await response.json();assert.equal(body.message,'Нове повідомлення');
 response=await apiBoundary(async()=>{throw Error('secret database connection');},'/api/test');const thrown=await response.clone().json();assert.equal(thrown.code,'INTERNAL_ERROR');assert.ok(!JSON.stringify(thrown).includes('secret'));assert.ok(!JSON.stringify(logged).includes('secret'));
 await assert.rejects(()=>readApi(response),error=>error instanceof ApiError&&error.code==='INTERNAL_ERROR'&&error.status===500&&error.requestId===thrown.requestId);
 for(const task of [async()=>undefined,async()=>Response.error()]){const invalid=await apiBoundary(task,'/api/test');assert.equal(invalid.status,500);assert.equal((await invalid.json()).code,'INTERNAL_ERROR');}
 const concurrent=await Promise.all(Array.from({length:30},()=>apiBoundary(async()=>Response.json({error:'Conflict'},{status:409}),'/api/test')));const responses=await Promise.all(concurrent.map(r=>r.json()));assert.equal(new Set(responses.map(r=>r.requestId)).size,30);
 response=await apiBoundary(async()=>Response.json({records:[]}),'/api/test');assert.deepEqual(await response.json(),{records:[]});assert.ok(response.headers.get('x-request-id'));
 response=await apiBoundary(async()=>new Response(new Uint8Array([1,2,3]),{headers:{'Content-Type':'application/pdf','Content-Disposition':'attachment; filename=x.pdf'}}),'/api/test');assert.deepEqual(new Uint8Array(await response.arrayBuffer()),new Uint8Array([1,2,3]));assert.equal(response.headers.get('content-type'),'application/pdf');assert.match(response.headers.get('content-disposition'),/attachment/);
 response=await apiBoundary(async()=>new Response(null,{status:204}),'/api/test');assert.equal(response.status,204);assert.equal(await response.text(),'');
 response=await apiBoundary(async()=>Response.json({error:'Degraded',code:'HEALTH_DEGRADED',details:{status:'degraded'}},{status:503}),'/api/health');assert.deepEqual((await response.json()).details,{status:'degraded'});
 await assert.rejects(()=>readApi(new Response('<html>secret</html>',{status:502})),error=>error instanceof ApiError&&error.status===502&&!error.message.includes('secret'));
 let count=0;function walk(path){for(const item of readdirSync(path,{withFileTypes:true})){const file=path+'/'+item.name;if(item.isDirectory())walk(file);else if(item.name==='route.ts'){const source=readFileSync(file,'utf8'),ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true);for(const node of ast.statements){if(ts.isFunctionDeclaration(node)&&node.body&&node.modifiers?.some(m=>m.kind===ts.SyntaxKind.ExportKeyword)){assert.match(node.body.statements[0].getText(ast),/^return apiBoundary\(/,file);count++;}}}}}walk('app/api');assert.equal(count,26);
 console.log('PASS: all 26 API handlers wrapped; common status/code/message/requestId, header/log correlation, isolated concurrent IDs, safe 500s, typed client failures and unchanged success/file bodies');
}finally{console.warn=warn;}
