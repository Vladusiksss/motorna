import {test,expect} from '@playwright/test';
test('data erasure requires an explicit phrase and refuses invalid requests without deleting records',async({page})=>{
 await page.goto('/signin-with-chatgpt?return_to=/profile');
 const panel=page.locator('.data-erasure');await expect(panel).toBeVisible();
 await panel.getByRole('button',{name:'Видалити всі мої дані',exact:true}).click();
 const confirm=panel.getByRole('button',{name:'Підтвердити повне видалення',exact:true});await expect(confirm).toBeDisabled();
 await panel.getByRole('textbox').fill('не видаляти');await expect(confirm).toBeDisabled();
 await panel.getByRole('textbox').fill('ВИДАЛИТИ МОЇ ДАНІ');await expect(confirm).toBeEnabled();
 // Never click the irreversible action for the shared development identity.
 await panel.getByRole('button',{name:'Скасувати',exact:true}).click();await expect(panel.getByRole('textbox')).toHaveCount(0);
 const before=await (await page.request.get('/api/records?limit=1')).json();
 for(const [data,origin,status] of [[{confirmation:'no'},'http://localhost:5173',400],[{confirmation:'x'.repeat(600)},'http://localhost:5173',413],[{confirmation:'ВИДАЛИТИ МОЇ ДАНІ'},'https://evil.test',403]] as const){
  const response=await page.request.delete('/api/account-data',{headers:{Origin:origin},data});expect(response.status()).toBe(status);if(response.headers()['content-type']?.includes('application/json')){const error=await response.json();expect(error.requestId).toBe(response.headers()['x-request-id']);}else expect(status).toBe(403); // Vite can reject foreign Origins before the API boundary.
 }
 const after=await (await page.request.get('/api/records?limit=1')).json();expect(after).toEqual(before);
 expect((await (await page.request.get('/api/account-data')).json()).state).toBe('none');
});

test('confirmed erasure continues across file batches in the browser',async({page})=>{
 let deletions=0;
 await page.route('**/api/account-data',route=>{
  if(route.request().method()==='GET')return route.fulfill({json:{state:'none',pendingFiles:0}});
  deletions++;return route.fulfill({status:deletions===1?202:200,json:{state:deletions===1?'pending':'complete',pendingFiles:deletions===1?1:0,deletedFiles:1}});
 });
 await page.goto('/signin-with-chatgpt?return_to=/profile');
 const panel=page.locator('.data-erasure');await panel.getByRole('button',{name:'Видалити всі мої дані',exact:true}).click();await panel.getByRole('textbox').fill('ВИДАЛИТИ МОЇ ДАНІ');await panel.getByRole('button',{name:'Підтвердити повне видалення',exact:true}).click();
 await expect(panel.getByRole('status')).toContainText('Дані Motorna видалено');expect(deletions).toBe(2);await expect(panel.getByRole('button',{name:'Вийти',exact:true})).toBeVisible();
 // The DELETEs above are a controlled UI fixture, not real account erasure.
});
