import {test,expect} from '@playwright/test';
test('API failures share a JSON envelope and a server request ID',async({page})=>{
 const headers={Origin:'http://localhost:5173','Content-Type':'application/json'};
 const responses=[
  await page.request.post('/api/analyze',{headers,data:'{'}),
  await page.request.post('/api/analyze',{headers:{...headers,'Sec-Fetch-Site':'same-site'},data:{symptoms:'P0302'}}),
  await page.request.get('/api/shared-car/invalid'),
  await page.request.post('/api/analyze',{headers,data:{padding:'x'.repeat(32000)}})
 ];
 const ids=new Set<string>();
 for(const [index,response] of responses.entries()){
  expect(response.status()).toBe([400,403,404,413][index]);expect(response.headers()['content-type']).toContain('application/json');
  const body=await response.json();expect(Object.keys(body).sort()).toEqual(['code','message','requestId']);expect(body.code).toMatch(/^[A-Z][A-Z0-9_]+$/);expect(body.message).toBeTruthy();expect(body.requestId).toMatch(/^[a-f0-9-]{36}$/);expect(response.headers()['x-request-id']).toBe(body.requestId);expect(ids.has(body.requestId)).toBe(false);ids.add(body.requestId);
 }
});
