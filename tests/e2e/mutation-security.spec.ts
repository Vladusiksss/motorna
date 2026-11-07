import {test,expect} from '@playwright/test';
test('browser writes work and rejected mutations leave records unchanged',async({page})=>{
 await page.goto('/signin-with-chatgpt?return_to=/');
 const car={name:'CSRF test',year:2003,engine:'3.0',vin:'JHMCM5654'+crypto.randomUUID().replace(/-/g,'').slice(0,8).toUpperCase(),mileage:0,nextService:0};
 const created=await page.evaluate(async data=>{const r=await fetch('/api/records',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind:'car',data})});return {status:r.status,body:await r.json() as {record:{id:string}}};},car);expect(created.status).toBe(201);const id=created.body.record.id;
 try{
  const attacks:Record<string,string>[]=[{},{Origin:'null'},{Origin:'https://evil.test'},{Origin:'http://localhost:5173','Sec-Fetch-Site':'same-site'}];
  for(const headers of attacks){
   const response=await page.request.patch('/api/records',{headers,data:{id,data:{...car,mileage:999}}});expect(response.status()).toBe(403);
   expect((await page.request.delete('/api/records?id='+id,{headers})).status()).toBe(403);
  }
  const rows=await (await page.request.get('/api/records?id='+id)).json();expect(rows.records[0].data.mileage).toBe(0);
  const result=await page.evaluate(async carId=>{const form=new FormData();const bytes=Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1cAAAAASUVORK5CYII='),c=>c.charCodeAt(0));form.set('file',new File([bytes],'receipt.png',{type:'image/png'}));form.set('carId',carId);const r=await fetch('/api/documents',{method:'POST',body:form});return {status:r.status,body:await r.json() as {document:{id:string}}};},id);expect(result.status).toBe(201);
  const documentId=result.body.document.id;
  expect((await page.request.delete('/api/documents/'+documentId,{headers:{Origin:'https://evil.test'}})).status()).toBe(403);
  expect((await page.request.delete('/api/documents/'+documentId,{headers:{Origin:'http://localhost:5173'}})).status()).toBe(200);
 }finally{expect((await page.request.delete('/api/records?id='+id,{headers:{Origin:'http://localhost:5173'}})).status()).toBe(200);}
});
