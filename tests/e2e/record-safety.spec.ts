import {test,expect,type Page} from '@playwright/test';
const headers={Origin:'http://localhost:5173'};
const car={name:'Safety fixture',year:2003,engine:'3.0',vin:'1HGCM82633A004352',mileage:0,nextService:0};
const line={title:'Safety part',part:'Термостат',oem:'TEST123',quantity:1,dataMode:'inquiry',fitment:'unverified'};
function data(kind:string,carId:string){return kind==='expense'?{carId,title:'Safety expense',date:'2026-11-06',amount:10,mileage:0}:kind==='searchHistory'?{carId,vehicle:'Safety fixture',problem:'Noise',parts:['Термостат'],results:[],videos:[]}:{carId,lines:[line],note:'',status:'draft'};}
async function create(page:Page,kind:string,payload:unknown,key?:string){return page.request.post('/api/records',{headers:{...headers,...(key?{'Idempotency-Key':key}:{})},data:{kind,data:payload}});}
async function remove(page:Page,id:string){return page.request.delete('/api/records?id='+id,{headers});}
async function cleanup(page:Page,ids:string[]){for(const id of ids)expect([200,404]).toContain((await remove(page,id)).status());}
async function failure(response:Awaited<ReturnType<typeof remove>>,status:number,code:string){expect(response.status()).toBe(status);const body=await response.json();expect(body.code).toBe(code);expect(body.requestId).toBe(response.headers()['x-request-id']);expect(body.message).toBeTruthy();}

test('existing dependents restrict car deletion; stale and repeated operations cannot recreate them',async({page})=>{
 await page.goto('/signin-with-chatgpt?return_to=/');let carId='',token='';const ids:string[]=[];
 try{
  const result=await create(page,'car',car);expect(result.status()).toBe(201);carId=(await result.json()).record.id;
  for(const kind of ['expense','searchHistory','purchaseRequest']){const response=await create(page,kind,data(kind,carId));expect(response.status()).toBe(201);ids.push((await response.json()).record.id);}
  const share=await page.request.post('/api/car-catalog',{headers,data:{carId,documentIds:[]}});expect(share.status()).toBe(200);token=(await share.json()).token;
  for(let i=0;i<ids.length;i++){
   await failure(await remove(page,carId),409,'CONFLICT');
   const parent=await (await page.request.get('/api/records?id='+carId)).json();expect(parent.records).toHaveLength(1);
   for(const id of ids.slice(i)){const child=await (await page.request.get('/api/records?id='+id)).json();expect(child.records).toHaveLength(1);}
   expect((await remove(page,ids[i])).status()).toBe(200);await failure(await remove(page,ids[i]),404,'NOT_FOUND');
  }
  expect((await remove(page,carId)).status()).toBe(200);await failure(await remove(page,carId),404,'NOT_FOUND');
  await failure(await page.request.get('/api/shared-car/'+token),404,'NOT_FOUND');
  for(const kind of ['expense','searchHistory','purchaseRequest'])await failure(await create(page,kind,data(kind,carId)),404,'NOT_FOUND');
 }finally{if(token)expect((await page.request.delete('/api/car-catalog?token='+token,{headers})).status()).toBe(200);await cleanup(page,[...ids,...(carId?[carId]:[])]);}
});

test('concurrent keyed retries, oversized writes and bad Origins preserve the original draft',async({page})=>{
 await page.goto('/signin-with-chatgpt?return_to=/');let carId='',draftId='';
 try{
  const result=await create(page,'car',car);expect(result.status()).toBe(201);carId=(await result.json()).record.id;
  const key=crypto.randomUUID(),payload=data('purchaseRequest',carId);
  const retries=await Promise.all(Array.from({length:8},()=>create(page,'purchaseRequest',payload,key)));for(const r of retries)expect(r.status()).toBe(201);
  const bodies=await Promise.all(retries.map(r=>r.json()));draftId=bodies[0].record.id;expect(new Set(bodies.map(b=>b.record.id)).size).toBe(1);expect(new Set(bodies.map(b=>b.record.created)).size).toBe(1);const original=bodies[0].record;
  await failure(await create(page,'purchaseRequest',{...payload,note:'Changed'},key),409,'CONFLICT');
  const origins:Record<string,string>[]=[{},{Origin:'null'},{Origin:'https://evil.test'},{Origin:'http://localhost:5173','Sec-Fetch-Site':'same-site'}];
  for(const bad of origins){
   const rejected=await page.request.post('/api/records',{headers:{...bad,'Idempotency-Key':key},data:{kind:'purchaseRequest',data:payload}});expect(rejected.status()).toBe(403);
  }
  await failure(await page.request.post('/api/records',{headers,data:{kind:'expense',data:data('expense',carId),padding:'x'.repeat(60000)}}),413,'JSON_BODY_TOO_LARGE');
  await failure(await page.request.patch('/api/records',{headers,data:{id:carId,data:{...car,mileage:999},padding:'x'.repeat(60000)}}),413,'JSON_BODY_TOO_LARGE');
  const saved=await (await page.request.get('/api/records?id='+draftId)).json();expect(saved.records).toEqual([original]);
  const list=await (await page.request.get('/api/records?kind=purchaseRequest&carId='+carId)).json();expect(list.page.total).toBe(1);
  const expenses=await (await page.request.get('/api/records?kind=expense&carId='+carId)).json();expect(expenses.page.total).toBe(0);
  const parent=await (await page.request.get('/api/records?id='+carId)).json();expect(parent.records[0].data.mileage).toBe(0);
  const deletions=await Promise.all(Array.from({length:6},()=>remove(page,draftId)));expect(deletions.map(r=>r.status()).sort()).toEqual([200,404,404,404,404,404]);
  expect((await remove(page,carId)).status()).toBe(200);await failure(await create(page,'purchaseRequest',payload,key),404,'NOT_FOUND');
 }finally{await cleanup(page,[...(draftId?[draftId]:[]),...(carId?[carId]:[])]);}
});
