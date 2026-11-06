import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {mutationGuard,MOTORNA_ORIGIN as origin} from '../app/mutation-security.ts';
const old=process.env.NODE_ENV;process.env.NODE_ENV='production';
function check(headers={},status=403,options={}){const request=new Request(origin+'/api/records',{method:'POST',headers:{'Content-Type':'application/json',...headers},body:'{}'});const result=mutationGuard(request,options);assert.equal(result?.status??200,status,JSON.stringify(headers));if(result){assert.equal(result.headers.get('cache-control'),'private, no-store');assert.equal(result.headers.get('x-content-type-options'),'nosniff');}}
try{
 check({Origin:origin},200);check({Origin:origin,'Sec-Fetch-Site':'same-origin','Sec-Fetch-Mode':'cors','Sec-Fetch-Dest':'empty',Referer:origin+'/garage'},200);
 for(const value of [undefined,'null',origin+'/',origin+'/path',origin+'.evil.test','http://'+new URL(origin).host,origin+':8443','https://user@'+new URL(origin).host,origin+', https://evil.test'])check(value===undefined?{}:{Origin:value});
 for(const [key,values] of Object.entries({'Sec-Fetch-Site':['cross-site','same-site','none','same-origin, same-site'],'Sec-Fetch-Mode':['navigate','no-cors'],'Sec-Fetch-Dest':['document','iframe'],Referer:['https://evil.test/']}))for(const value of values)check({Origin:origin,[key]:value});
 check({'Sec-Fetch-Site':'same-origin',Referer:origin+'/'});
 check({Origin:'https://evil.test',Host:'evil.test','X-Forwarded-Host':'evil.test','X-Forwarded-Proto':'https',Forwarded:'host=evil.test'});
 for(const value of ['text/plain','application/x-www-form-urlencoded','multipart/form-data'])check({Origin:origin,'Content-Type':value},415);
 check({Origin:origin,'Content-Type':'application/json; charset=utf-8'},200);
 check({'Content-Type':'application/gzip'},200,{format:'gzip',allowMachine:true});
 check({'Content-Type':'application/gzip','Sec-Fetch-Site':'same-origin'},403,{format:'gzip',allowMachine:true});
 check({'Content-Type':'application/gzip'},403,{format:'gzip'});
 const form=new FormData();form.set('file',new Blob(['test']),'test.txt');assert.equal(mutationGuard(new Request(origin+'/api/documents',{method:'POST',headers:{Origin:origin},body:form}),{format:'multipart'}),null);
 assert.equal(mutationGuard(new Request(origin,{method:'DELETE',headers:{Origin:origin}})),null);
 for(const local of ['http://localhost:5173','http://127.0.0.1:5173']){const req=new Request(local,{method:'DELETE',headers:{Origin:local}});assert.equal(mutationGuard(req).status,403);process.env.NODE_ENV='development';assert.equal(mutationGuard(req),null);process.env.NODE_ENV='production';}
 const paths=[];function walk(path){for(const item of readdirSync(path,{withFileTypes:true})){const file=path+'/'+item.name;if(item.isDirectory())walk(file);else if(item.name==='route.ts')paths.push(file);}}walk('app/api');let count=0;
 for(const path of paths){const source=readFileSync(path,'utf8');const methods=[...source.matchAll(/export async function (POST|PUT|PATCH|DELETE)\(/g)];for(const match of methods){const start=match.index,end=source.indexOf('export async function ',start+1);const body=source.slice(start,end<0?undefined:end);assert.ok(body.includes('mutationGuard('),path+' '+match[1]);count++;}}
 assert.ok(count>=17);const registry=readFileSync('app/api/registry-import/route.ts','utf8');assert.ok(registry.indexOf('mutationGuard(request,')>registry.indexOf('REGISTRY_IMPORT_TOKEN'));
 console.log('PASS: strict Origin, Fetch Metadata, forwarded-host attacks, content types, multipart, authenticated machine policy, production/local separation; '+count+' mutation handlers covered');
}finally{if(old===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=old;}

