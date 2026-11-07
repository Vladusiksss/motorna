import {readFile} from 'node:fs/promises';
import {test,expect,type APIResponse} from '@playwright/test';
async function withBudget(action:()=>Promise<APIResponse>){
 for(let attempt=0;attempt<3;attempt++){const response=await action();if(response.status()!==429)return response;const retry=Math.min(60,Math.max(1,Number(response.headers()['retry-after'])||1));await new Promise(resolve=>setTimeout(resolve,retry*1000+100));}
 throw new Error('Fixture requests remained rate limited after Retry-After retries');
}

test('older car remains selectable and older expenses load on demand',async({page})=>{
 const api={post:(url:string,options:Parameters<typeof page.request.post>[1])=>withBudget(()=>page.request.post(url,options)),delete:(url:string,options:Parameters<typeof page.request.delete>[1])=>withBudget(()=>page.request.delete(url,options))};
 const ids:string[]=[];let carId='';const marker='PAGINATION-'+Date.now();
 await page.route('**/api/vin-photos',r=>r.fulfill({json:{photos:[]}}));await page.route('**/api/vehicle-image?*',r=>r.fulfill({json:{photos:[]}}));
 try{
  await page.goto('/signin-with-chatgpt?return_to=/');const response=await api.post('/api/records',{headers:{Origin:'http://localhost:5173'},data:{kind:'car',data:{name:marker,make:'HONDA',model:'Accord',year:2003,engine:'3.0',vin:'JHMCM5654'+crypto.randomUUID().replace(/-/g,'').slice(0,8).toUpperCase(),mileage:100,nextService:0}}});expect(response.status()).toBe(201);carId=(await response.json()).record.id;
  for(let offset=0;offset<61;offset+=10)await Promise.all(Array.from({length:Math.min(10,61-offset)},async(_,i)=>{const r=await api.post('/api/records',{headers:{Origin:'http://localhost:5173'},data:{kind:'expense',data:{carId,title:marker+' '+(offset+i),date:'2026-11-06',amount:1,mileage:100}}});expect(r.status()).toBe(201);ids.push((await r.json()).record.id);}));
  await page.addInitScript(id=>localStorage.setItem('motorna-active-car',id),carId);await page.reload();await expect(page.getByText('Збережено в гаражі',{exact:true})).toBeVisible();await expect(page.locator('.records-pagination')).toBeVisible();
  await page.getByRole('button',{name:/^(Мій гараж|Гараж)$/}).click();await page.getByRole('tab',{name:'Історія витрат',exact:true}).click();const expenses=page.locator('.table-panel tbody tr').filter({hasText:marker});await expect(expenses).toHaveCount(50);
  const downloading=page.waitForEvent('download');await page.getByRole('button',{name:'Експорт CSV',exact:true}).click();const file=await downloading;const contents=await readFile((await file.path())!,'utf8');expect(contents.split('\r\n').filter(line=>line.includes(marker))).toHaveLength(61);await expect(expenses).toHaveCount(50);
  await page.getByRole('button',{name:'Завантажити ще',exact:true}).click();await expect(expenses).toHaveCount(61);
 }finally{for(const id of ids)expect((await api.delete('/api/records?id='+id,{headers:{Origin:'http://localhost:5173'}})).ok()).toBeTruthy();if(carId)expect((await api.delete('/api/records?id='+carId,{headers:{Origin:'http://localhost:5173'}})).ok()).toBeTruthy();}
});
