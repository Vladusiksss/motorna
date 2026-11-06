// Read-only checks: no records, files or shares are created or changed.
import assert from 'node:assert/strict';
const base=process.env.MOTORNA_SITE_URL||'https://motorna-auto-space.bilogrivijvladislav.chatgpt.site';
const url=new URL(base);
if(url.origin!==base||url.username||url.password||!(url.protocol==='https:'&&url.hostname==='motorna-auto-space.bilogrivijvladislav.chatgpt.site'||url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname)))throw new Error('Use the selected Motorna site or localhost.');
async function request(path,options={}){const response=await fetch(base+path,{...options,signal:AbortSignal.timeout(20000),redirect:'error'});if(response.status>=400){const body=await response.clone().json();assert.match(body.code,/^[A-Z][A-Z0-9_]+$/);assert.equal(typeof body.message,'string');assert.ok(body.message.length);assert.match(body.requestId,/^[a-f0-9-]{36}$/);assert.equal(body.requestId,response.headers.get('x-request-id'));assert.equal(body.error,undefined);}return response;}
for(const path of ['/','/garage','/requests'])assert.equal((await request(path)).status,200,path);
let response=await request('/api/health');assert.equal(response.status,200,'D1/R2 health');assert.equal(response.headers.get('cache-control'),'no-store');const health=await response.json();assert.deepEqual(health.checks,{database:'ok',files:'ok'});
assert.equal((await request('/api/records')).status,401,'Anonymous private records must be refused');
assert.equal((await request('/api/documents')).status,401,'Anonymous private documents must be refused');
response=await request('/api/analyze',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({vehicle:'Test Honda Accord 2003',symptoms:'P0302',history:[]})});assert.equal(response.status,200);assert.match((await response.json()).note,/P0302/);
for(const headers of [{},{Origin:'https://evil.test'},{Origin:base,'Sec-Fetch-Site':'same-site'}]){const denied=await request('/api/analyze',{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify({symptoms:'P0302'})});assert.equal(denied.status,403,'Origin/CSRF refusal');}
response=await request('/api/analyze',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({padding:'x'.repeat(32000)})});assert.equal(response.status,413,'JSON streaming byte limit');
response=await request('/api/analyze',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:'{'});assert.equal(response.status,400,'Malformed JSON');
console.log(JSON.stringify({status:'passed',checkedAt:new Date().toISOString(),site:base,checks:['public pages','D1/R2','anonymous access refusal','diagnostic API','Origin/CSRF refusal','JSON body limits','API error envelope and request IDs']},null,2));
