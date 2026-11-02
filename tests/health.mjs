import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
let fail=false,calls=0;
globalThis.healthTest={storage:async()=>{calls++;return {db:{prepare(){return {all:async()=>{if(fail)throw Error('private database details');return {results:[]};}};}},bucket:{get:async key=>{assert.match(key,/^_health\//);if(fail)throw Error('private storage details');return null;}}};}};
const source=readFileSync('app/api/health/route.ts','utf8').replace(/^import .*;\r?\n/gm,'');
const compiled=ts.transpileModule('const {storage}=globalThis.healthTest;\n'+source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const route=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
const clock=Date.now;
try{
 let response=await route.GET();assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');assert.deepEqual((await response.json()).checks,{database:'ok',files:'ok'});
 fail=true;assert.equal((await route.GET()).status,200);assert.equal(calls,1,'Probe cache limits storage reads');
 Date.now=()=>clock()+20000;
 response=await route.GET();assert.equal(response.status,503);const body=await response.text();assert.ok(body.includes('degraded'));assert.ok(!body.includes('private'));assert.equal(calls,2);
 console.log('PASS: DB/R2 read probe, bounded probe cache, degraded status and no internal error disclosure');
}finally{Date.now=clock;delete globalThis.healthTest;}
