import {test,expect,type Page} from '@playwright/test';
// Only upstream VIN/merchant/photo responses are fixtures. Auth, records, validation,
// ownership checks and TXT downloads use the real local application and database.
test.beforeEach(async({page,baseURL})=>{
 if(!baseURL||new URL(baseURL).hostname!=='localhost')throw new Error('Local test server only');
 await page.route('**/api/vin-photos',route=>route.fulfill({json:{photos:[]}}));
 await page.route('**/api/vehicle-image?*',route=>route.fulfill({json:{photos:[]}}));
});
async function addVehicle(page:Page,vin:string){
 await page.route('**/api/vehicle',async route=>{
  expect(route.request().postDataJSON().identifier).toBe(vin);
  await route.fulfill({json:{vehicle:{vin,make:'HONDA',model:'Accord',year:'2003',engine:'3.0 Gasoline',fields:[{label:'VIN',value:vin}],source:'E2E fixture, not a live VIN lookup',warning:'',checkedAt:'2026-11-01T00:00:00Z'}}});
 });
 const hydrated=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/records'&&r.request().method()==='GET',{timeout:60000});
 await page.goto('/signin-with-chatgpt?return_to=/');
 await expect(page.getByRole('button',{name:/Запити на купівлю:/})).toBeVisible();
 // Wait for actual records hydration before entering a VIN (selection may remount Finder).
 const recordsResponse=await hydrated;expect(recordsResponse.status()).toBe(200);await recordsResponse.json();
 await page.getByRole('button',{name:'Додати авто',exact:true}).click();
 await page.getByRole('button',{name:'VIN',exact:true}).click();
 await page.getByRole('textbox',{name:'VIN для пошуку',exact:true}).fill(vin);
 await page.locator('.unified-search').getByRole('button',{name:'Знайти',exact:true}).click();
 await page.getByRole('button',{name:'Підтвердити авто',exact:true}).click();
 await expect(page.getByText('Збережено в гаражі',{exact:true})).toBeVisible();
 await page.getByRole('tab',{name:'Знаю потрібну деталь',exact:true}).click();
 await page.getByRole('textbox',{name:'Яка деталь потрібна?',exact:true}).fill('Гальмівні колодки');
 await page.getByRole('textbox',{name:'OEM / каталожний номер, якщо відомий',exact:true}).fill('GDB3373');
}
async function cleanup(page:Page,vin:string){
 const response=await page.request.get('/api/records');if(!response.ok())return;
 const {records}=await response.json() as {records:{id:string;kind:string;data:{vin?:string;carId?:string}}[]};
 const cars=records.filter(r=>r.kind==='car'&&r.data.vin===vin);
 const ids=new Set(cars.map(r=>r.id));
 for(const row of records.filter(r=>r.kind!=='car'&&r.data.carId&&ids.has(r.data.carId))){expect((await page.request.delete('/api/records?id='+row.id)).ok()).toBeTruthy();}
 for(const car of cars)expect((await page.request.delete('/api/records?id='+car.id)).ok()).toBeTruthy();
}
test('VIN → car → article → filters → private request → reload → TXT',async({page},info)=>{
 const vin='JHMCM56543C'+String(Date.now()).slice(-6);
 try{
  await addVehicle(page,vin);
  await page.route('**/api/web-parts',async route=>{
   expect(route.request().postDataJSON()).toMatchObject({part:'Гальмівні колодки',oem:'GDB3373'});
   await route.fulfill({json:{results:[
    {title:'E2E fixture TRW GDB3373',url:'https://prom.ua/ua/p999999001-e2e.html',host:'prom.ua',brand:'TRW',catalogNumbers:['GDB3373'],price:1000,currency:'UAH',availability:'Є в наявності',dataMode:'live',numberMatch:true,fitment:{status:'unverified',reason:'E2E fixture, no VIN fitment evidence'}},
    {title:'E2E fixture BOSCH',url:'https://prom.ua/ua/p999999002-e2e.html',host:'prom.ua',brand:'BOSCH',price:2000,currency:'UAH',dataMode:'live'},
    {title:'E2E demonstration only',url:'https://prom.ua/ua/p999999003-e2e.html',host:'prom.ua',brand:'DEMO',price:1,currency:'UAH',dataMode:'demo'},
   ]}});
  });
  await page.getByRole('button',{name:'Знайти пропозиції для авто',exact:true}).click();
  await expect(page.locator('.refreshed-offer')).toHaveCount(3);
  await expect(page.locator('.refreshed-offer').filter({hasText:'E2E demonstration only'}).getByRole('button',{name:'До запиту',exact:true})).toBeDisabled();
  await page.locator('#finder-workspace').getByRole('button',{name:'Фільтри',exact:true}).click();
  await page.locator('#offer-filters').getByRole('combobox',{name:/Виробник/}).selectOption('TRW');
  if(info.project.name==='mobile'){
   await expect(page.getByRole('dialog',{name:'Фільтри пропозицій'})).toBeVisible();
   await page.getByRole('button',{name:'Показати 1 пропозицій',exact:true}).click();
  }
  await expect(page.locator('.refreshed-offer')).toHaveCount(1);
  await expect(page.locator('.refreshed-offer')).toContainText('Сумісність за VIN не підтверджена');
  await page.getByRole('button',{name:'До запиту',exact:true}).click();
  const composer=page.getByRole('dialog',{name:'Запит на купівлю'});
  await expect(composer).toContainText(vin);
  await composer.getByRole('spinbutton',{name:/Кількість:/}).fill('2');
  // The server commits the first request, but its response is lost in transit.
  const keys:string[]=[];
  await page.route('**/api/records',async route=>{
   const req=route.request();if(req.method()!=='POST'||req.postDataJSON().kind!=='purchaseRequest'){await route.continue();return;}
   keys.push(req.headers()['idempotency-key']);
   const response=await route.fetch();
   if(keys.length===1)await route.abort('failed');else await route.fulfill({response});
  });
  await composer.getByRole('button',{name:'Зберегти запит',exact:true}).click();
  await expect(composer.getByRole('button',{name:'Зберегти запит',exact:true})).toBeEnabled();
  await expect(page.getByText('Failed to fetch',{exact:false})).toBeVisible();
  await composer.getByRole('button',{name:'Зберегти запит',exact:true}).click();
  await expect.poll(()=>keys.length).toBe(2);
  expect(keys[0]).toMatch(/^[a-f0-9-]{36}$/);expect(keys[1]).toBe(keys[0]);
  await expect(page).toHaveURL(/\/requests$/);
  await page.reload();
  const saved=page.locator('.purchase-draft').filter({hasText:vin});
  await expect(saved).toHaveCount(1);
  await expect(saved).toContainText('Чернетка · не надіслана продавцю');
  await expect(saved).toContainText('2 шт.');
  const download=page.waitForEvent('download');
  await saved.getByRole('link',{name:'Завантажити TXT',exact:true}).click();
  expect((await download).suggestedFilename()).toMatch(/\.txt$/);
  await page.screenshot({path:info.outputPath('saved-request.png'),fullPage:true});
 }finally{await cleanup(page,vin);}
});
test('unavailable upstream → honest empty state → inquiry without price',async({page})=>{
 const vin='JHMCM56543C'+String(Date.now()).slice(-6);
 try{
  await addVehicle(page,vin);
  await page.route('**/api/web-parts',route=>route.fulfill({status:503,json:{error:'E2E upstream unavailable'}}));
  await page.getByRole('button',{name:'Знайти пропозиції для авто',exact:true}).click();
  await expect(page.locator('.refreshed-offer')).toHaveCount(0);
  await expect(page.getByText('E2E upstream unavailable',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Створити запит на підбір',exact:true}).click();
  const composer=page.getByRole('dialog',{name:'Запит на купівлю'});
  await expect(composer).toContainText('Ціна за відповіддю продавця');
  await expect(composer).toContainText('сумісність за VIN не підтверджена');
 }finally{await cleanup(page,vin);}
});
test('switching garage cars clears the previous public QR catalog',async({page})=>{
 const vin='JHMCM56543C'+String(Date.now()).slice(-6);
 const secondVin='JHMCM56543D'+String(Date.now()).slice(-6);
 try{
  await addVehicle(page,vin);
  const {records}=await page.request.get('/api/records').then(r=>r.json()) as {records:{id:string;data:{vin?:string}}[]};
  const first=records.find(r=>r.data.vin===vin);expect(first).toBeTruthy();
  const response=await page.request.post('/api/records',{data:{kind:'car',data:{name:'E2E Second Honda',make:'HONDA',model:'Accord',year:2004,engine:'3.0 Gasoline',vin:secondVin,mileage:100,nextService:1000}}});
  expect(response.status()).toBe(201);
  const second=await response.json() as {record:{id:string}};
  // This fixture exercises client isolation, not publication of a real public share.
  const token='a'.repeat(64);
  await page.route('**/api/car-catalog?*',route=>route.fulfill({json:{shares:new URL(route.request().url()).searchParams.get('carId')===first?.id?[{token,document_ids:'[]'}]:[]}}));
  await page.goto('/garage');
  await page.getByRole('combobox',{name:'Авто для каталогу',exact:true}).selectOption(first!.id);
  await expect(page.getByRole('link',{name:'Відкрити каталог ↗',exact:true})).toHaveAttribute('href',new RegExp(token+'$'));
  await page.getByRole('combobox',{name:'Авто для каталогу',exact:true}).selectOption(second.record.id);
  await expect(page.getByRole('button',{name:'Створити QR-каталог',exact:true})).toBeEnabled();
  await expect(page.getByRole('link',{name:'Відкрити каталог ↗',exact:true})).toHaveCount(0);
  await expect(page.getByRole('img',{name:'QR-код каталогу автомобіля',exact:true})).toHaveCount(0);
 }finally{await cleanup(page,vin);await cleanup(page,secondVin);}
});

test('initial screen hides unknown vehicle traits and separates search modes',async({page},info)=>{
 await page.goto('/');
 await expect(page.locator('.vehicle-visual')).toContainText('Додайте автомобіль, щоб персоналізувати пошук');
 await expect(page.locator('.vehicle-visual')).not.toContainText('Кузов не визначено');
 await expect(page.locator('.vehicle-visual')).not.toContainText('Колір не визначено');
 await expect(page.getByRole('textbox',{name:'VIN для пошуку',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Симптоми',exact:true}).click();
 await expect(page.getByRole('textbox',{name:'Опис симптомів',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Запчастина',exact:true}).click();
 await expect(page.getByRole('combobox',{name:'Назва деталі або артикул',exact:true})).toBeVisible();
 await page.screenshot({path:info.outputPath('search-modes.png'),fullPage:false});
});
