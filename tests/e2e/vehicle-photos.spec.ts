import {test,expect} from '@playwright/test';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLttAAAAABJRU5ErkJggg==','base64');
test('VIN → save once → private gallery → upload → primary → reopen → delete',async({page})=>{
 const vin='JHMCM56543C'+String(Date.now()).slice(-6);let carId='';
 await page.route('**/api/vin-photos',r=>r.fulfill({json:{photos:[]}}));
 await page.route('**/api/vehicle-image?*',r=>r.fulfill({json:{photos:[]}}));
 await page.route('**/api/vehicle',r=>r.fulfill({json:{vehicle:{vin,make:'HONDA',model:'Accord',year:'2003',engine:'3.0',fields:[{label:'VIN',value:vin}],source:'E2E mock, not live decoding',warning:'',checkedAt:'2026-11-07T00:00:00Z'}}}));
 try{
  await page.goto('/signin-with-chatgpt?return_to=/');
  await expect(page.getByRole('button',{name:'Додати авто',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Додати авто',exact:true}).click();
  await page.getByRole('button',{name:'VIN',exact:true}).click();
  await page.getByRole('textbox',{name:'VIN для пошуку',exact:true}).fill(vin);
  await page.locator('.unified-search').getByRole('button',{name:'Знайти',exact:true}).click();
  await page.getByRole('button',{name:'Підтвердити авто',exact:true}).click();
  await expect(page.getByText('Збережено в гаражі',{exact:true})).toBeVisible();
  const rows=(await (await page.request.get('/api/records?kind=car&limit=100')).json()).records;
  const saved=rows.find((r:{data:{vin:string}})=>r.data.vin===vin);carId=saved.id;
  // A repeated create resolves to the same owned VIN, without a second car.
  const retry=await page.request.post('/api/records',{headers:{Origin:'http://localhost:5173'},data:{kind:'car',data:saved.data}});expect((await retry.json()).record.id).toBe(carId);
  await page.goto('/garage');const gallery=page.getByRole('region',{name:'Фотографії автомобіля',exact:true});await expect(gallery).toBeVisible();
  await gallery.getByRole('checkbox',{name:'Я маю право завантажити це фото',exact:true}).check();
  await gallery.getByLabel('Завантажити фото автомобіля',{exact:true}).setInputFiles({name:'owned.png',mimeType:'image/png',buffer:png});
  await gallery.getByRole('button',{name:'Мої фото · 1',exact:true}).click();
  await expect(gallery.locator('.gallery-card')).toHaveCount(1);
  await gallery.getByRole('button',{name:'Обрати головним',exact:true}).click();
  await expect(gallery.getByRole('button',{name:'Головне фото',exact:true})).toBeDisabled();
  const selected=await (await page.request.get('/api/vehicle-photos?carId='+carId)).json();expect(selected.primaryId).toBeTruthy();expect(selected.photos.filter((p:{owned:boolean})=>p.owned)).toHaveLength(1);
  await page.reload();await expect(gallery.locator('.gallery-hero img')).toBeVisible();await expect(gallery.locator('.gallery-hero img')).toHaveJSProperty('naturalWidth',1);
  await gallery.getByRole('button',{name:'Мої фото · 1',exact:true}).click();await expect(gallery.getByRole('button',{name:'Головне фото',exact:true})).toBeDisabled();
  await gallery.getByRole('button',{name:'Видалити фото',exact:true}).click();await expect(gallery.getByRole('button',{name:'Мої фото · 0',exact:true})).toBeVisible();
  expect((await (await page.request.get('/api/vehicle-photos?carId='+carId)).json()).photos.filter((p:{owned:boolean})=>p.owned)).toHaveLength(0);
 }finally{if(carId)await page.request.delete('/api/records?id='+carId,{headers:{Origin:'http://localhost:5173'}});}
});
