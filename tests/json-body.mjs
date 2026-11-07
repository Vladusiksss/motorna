import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {readJsonObject,JsonBodyError,jsonBodyFailure} from '../app/json-body.ts';
const encode=value=>new TextEncoder().encode(value);
const url='https://motorna-auto-space.bilogrivijvladislav.chatgpt.site/api/records';
function streamed(chunks,headers={},extra={}){let pulls=0,cancelled=false;const stream=new ReadableStream({pull(controller){const next=chunks[pulls++];if(next===undefined)controller.close();else controller.enqueue(next);},cancel(){cancelled=true;}},{highWaterMark:0});return {request:new Request(url,{method:'POST',headers,body:stream,duplex:'half',...extra}),get pulls(){return pulls},get cancelled(){return cancelled}};}
async function rejected(request,limit,status){await assert.rejects(()=>readJsonObject(request,limit),error=>{assert.ok(error instanceof JsonBodyError);assert.equal(error.status,status);const response=jsonBodyFailure(error);assert.equal(response.status,status);assert.equal(response.headers.get('cache-control'),'private, no-store');return true;});}
const json=JSON.stringify({message:'Україна 🚗'}),bytes=encode(json);
let input=streamed([...bytes].map(byte=>new Uint8Array([byte])));assert.deepEqual(await readJsonObject(input.request,bytes.length),{message:'Україна 🚗'});assert.equal(input.cancelled,false);
for(const headers of [{},{'Content-Length':'1'}]){
 input=streamed([encode('{"x":"'),encode('x'.repeat(20)),encode('never read"}')],headers);await rejected(input.request,10,413);assert.equal(input.cancelled,true);assert.equal(input.pulls,2,'Stop at the first chunk over the limit');
}
input=streamed([bytes],{'Content-Length':'999999999999999999999999999999'});await rejected(input.request,100,413);assert.equal(input.pulls,0);assert.equal(input.cancelled,true);
input=streamed([bytes]);await rejected(input.request,bytes.length-1,413);assert.equal(input.cancelled,true,'UTF-8 bytes, not JS character count');
input=streamed([bytes],{'Content-Length':String(bytes.length)});assert.deepEqual(await readJsonObject(input.request,bytes.length),{message:'Україна 🚗'});
for(const declared of ['-1','1.5','abc','1, 2']){input=streamed([bytes],{'Content-Length':declared});await rejected(input.request,100,400);assert.equal(input.pulls,0);assert.equal(input.cancelled,true);}
for(const body of ['', '{', 'null','[]','"text"','42','true','{"x":}'])await rejected(streamed([encode(body)]).request,100,400);
await rejected(streamed([new Uint8Array([123,34,120,34,58,34,255,34,125])]).request,100,400);
await rejected(new Request(url,{method:'POST'}),100,400);
input=streamed([bytes],{'Content-Encoding':'gzip'});await rejected(input.request,100,415);assert.equal(input.pulls,0);assert.equal(input.cancelled,true);
input=streamed([encode('{}')],{'Content-Encoding':'identity'});assert.deepEqual(await readJsonObject(input.request,2),{});
const controller=new AbortController();controller.abort();input=streamed([bytes],{}, {signal:controller.signal});await rejected(input.request,100,400);assert.equal(input.cancelled,true);assert.equal(input.pulls,0);
let cancelled=false;const abort=new AbortController();const hanging=new Request(url,{method:'POST',body:new ReadableStream({cancel(){cancelled=true;}}),duplex:'half',signal:abort.signal});const reading=rejected(hanging,100,400);abort.abort();await reading;assert.equal(cancelled,true);
const broken=new Request(url,{method:'POST',body:new ReadableStream({start(c){c.error(Error('private upstream detail'));}}),duplex:'half'});await rejected(broken,100,400);
// Cancellation may itself reject or never resolve: neither must replace/delay 413.
for(const cancel of [()=>Promise.reject(Error('cancel failed')),()=>new Promise(()=>{})]){const req=new Request(url,{method:'POST',body:new ReadableStream({start(c){c.enqueue(encode('123'));},cancel}),duplex:'half'});await rejected(req,2,413);}
assert.equal(jsonBodyFailure(Error('private')),null);await assert.rejects(()=>readJsonObject(new Request(url),0),RangeError);
let count=0;function walk(path){for(const item of readdirSync(path,{withFileTypes:true})){const file=path+'/'+item.name;if(item.isDirectory())walk(file);else if(item.name==='route.ts'){const source=readFileSync(file,'utf8');assert.doesNotMatch(source,/(?:request|req)\.(?:text|json|arrayBuffer)\(/,file);count+=(source.match(/await readJsonObject\(/g)||[]).length;}}}walk('app/api');assert.equal(count,15);
console.log('PASS: 15 route readers; exact UTF-8 byte bounds, chunk cancellation, missing/false Content-Length, malformed JSON/UTF-8, aborts, broken streams and nonblocking cancellation');

