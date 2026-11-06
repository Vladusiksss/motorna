import {purchaseRecordId,validPurchaseKey,samePurchaseInput} from '@/app/purchase-idempotency';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {storage} from '@/db/storage';
import {schemas} from '@/app/validation';
import {allowedSeller} from '@/app/product-offers';
export const dynamic='force-dynamic';
const privateHeaders={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
const fail=(message:string,status=400)=>Response.json({error:message},{status,headers:privateHeaders});
export async function GET(){const user=await getChatGPTUser();if(!user)return fail('Увійдіть, щоб відкрити свій гараж.',401);try{const {db}=await storage();const rows=await db.prepare('SELECT id, kind, payload, created FROM records WHERE owner = ? ORDER BY created DESC').bind(user.userId).all<{id:string;kind:string;payload:string;created:number}>();return Response.json({user:{name:user.displayName,email:user.email},records:rows.results.map(r=>({id:r.id,kind:r.kind,data:JSON.parse(r.payload),created:r.created}))},{headers:privateHeaders});}catch(e){console.error('records read',e);return fail('Не вдалося завантажити дані. Спробуйте ще раз.',503);}}
export async function POST(request:Request){const user=await getChatGPTUser();if(!user)return fail('Для збереження увійдіть в особистий простір.',401);if(request.headers.get('sec-fetch-site')==='cross-site')return fail('Недозволений запит.',403);try{const raw=await request.text();if(raw.length>60000)return fail('Завеликий запис.');const body=JSON.parse(raw);const schema=schemas[body.kind as keyof typeof schemas];if(!schema)return fail('Невідомий тип запису.');const requestKey=body.kind==='purchaseRequest'?request.headers.get('Idempotency-Key'):null;if(requestKey!==null&&!validPurchaseKey(requestKey))return fail('Невірний ключ повторного запиту.');const parsed=schema.safeParse(body.data);if(!parsed.success)return fail('Перевірте заповнення полів.');const {db}=await storage();let relatedCarId:string|undefined;if(body.kind==='expense'||body.kind==='searchHistory'){relatedCarId=body.kind==='expense'?schemas.expense.parse(body.data).carId:schemas.searchHistory.parse(body.data).carId;const car=await db.prepare("SELECT id FROM records WHERE id = ? AND owner = ? AND kind = 'car'").bind(body.kind==='expense'?schemas.expense.parse(body.data).carId:schemas.searchHistory.parse(body.data).carId,user.userId).first();if(!car)return fail('Автомобіль не знайдено.',404);}
if(body.kind==='purchaseRequest'){
 const draft=schemas.purchaseRequest.parse(parsed.data);relatedCarId=draft.carId;const car=await db.prepare("SELECT payload FROM records WHERE id=? AND owner=? AND kind='car'").bind(draft.carId,user.userId).first();if(!car)return fail('Автомобіль не знайдено у вашому гаражі.',404);
 const vehicle=JSON.parse(String(car.payload));if(!vehicle.vin)return fail('Для запиту потрібен VIN автомобіля.');
 for(const line of draft.lines){if(line.url&&!allowedSeller(line.url))return fail('Посилання має вести на підтримуваний магазин.');if(line.url)line.host=new URL(line.url).hostname;}
 Object.assign(parsed.data,draft,{vehicle:[vehicle.name,vehicle.year,vehicle.engine].filter(Boolean).join(' · '),vin:vehicle.vin});
}
const id=requestKey?await purchaseRecordId(user.userId,requestKey):crypto.randomUUID(),created=Date.now();
// Authorization is checked again inside the write: a DELETE may run after the earlier read.
const insert=relatedCarId
 ?db.prepare("INSERT INTO records (id,owner,kind,payload,created) SELECT ?,?,?,?,? WHERE EXISTS (SELECT 1 FROM records WHERE id=? AND owner=? AND kind='car') ON CONFLICT(id) DO NOTHING").bind(id,user.userId,body.kind,JSON.stringify(parsed.data),created,relatedCarId,user.userId)
 :db.prepare('INSERT INTO records (id,owner,kind,payload,created) VALUES (?,?,?,?,?) ON CONFLICT(id) DO NOTHING').bind(id,user.userId,body.kind,JSON.stringify(parsed.data),created);
const inserted=await insert.run();
if(relatedCarId&&!requestKey&&inserted.meta.changes===0)return fail('Автомобіль уже видалено або недоступний.',404);
if(requestKey){
 const saved=await db.prepare('SELECT id,kind,payload,created FROM records WHERE id=? AND owner=?').bind(id,user.userId).first<{id:string;kind:string;payload:string;created:number}>();
 if(!saved)return fail('Автомобіль уже видалено або недоступний.',404);
 const data:unknown=JSON.parse(saved.payload);
 if(saved.kind!=='purchaseRequest'||!samePurchaseInput(data,parsed.data))return fail('Цей запит уже збережено з іншими деталями. Оновіть чернетку перед повторним збереженням.',409);
 return Response.json({record:{id:saved.id,kind:saved.kind,data,created:saved.created}},{status:201,headers:privateHeaders});
}
return Response.json({record:{id,kind:body.kind,data:parsed.data,created}},{status:201,headers:privateHeaders});}catch(e){console.error('records save',e);return fail('Не вдалося зберегти. Ваші поля залишилися заповненими.',503);}}
export async function DELETE(request:Request){const user=await getChatGPTUser();if(!user)return fail('Потрібен вхід.',401);if(request.headers.get('sec-fetch-site')==='cross-site')return fail('Недозволений запит.',403);const id=new URL(request.url).searchParams.get('id');if(!id||!/^[a-f0-9-]{36}$/.test(id))return fail('Невірний запис.');try{const {db}=await storage();const row=await db.prepare('SELECT kind FROM records WHERE id = ? AND owner = ?').bind(id,user.userId).first();if(!row)return fail('Запис не знайдено.',404);// The existence check and DELETE must be one statement; otherwise a child INSERT can win the gap.
const deleted=await db.prepare("DELETE FROM records WHERE id=? AND owner=? AND (kind<>'car' OR NOT EXISTS (SELECT 1 FROM records AS child WHERE child.owner=records.owner AND json_extract(child.payload,'$.carId')=records.id))").bind(id,user.userId).run();
if(deleted.meta.changes===0){const exists=await db.prepare('SELECT id FROM records WHERE id=? AND owner=?').bind(id,user.userId).first();return exists?fail('Спершу видаліть пов’язані витрати, історію пошуку та запити цього автомобіля.',409):fail('Запис уже видалено.',404);}
return Response.json({ok:true});}catch(e){console.error('records delete',e);return fail('Не вдалося видалити. Спробуйте ще раз.',503);}}


export async function PATCH(request:Request){
 const user=await getChatGPTUser();if(!user)return fail('Потрібен вхід.',401);
 if(request.headers.get('sec-fetch-site')==='cross-site')return fail('Недозволений запит.',403);
 try{const raw=await request.text();if(raw.length>60000)return fail('Завеликий запис.');const body=JSON.parse(raw);if(typeof body.id!=='string')return fail('Невірний запис.');const {db}=await storage();const existing=await db.prepare('SELECT kind,created FROM records WHERE id = ? AND owner = ?').bind(body.id,user.userId).first();if(!existing)return fail('Запис не знайдено.',404);if(existing.kind!=='car')return fail('Редагування цього типу недоступне.');const parsed=schemas.car.safeParse(body.data);if(!parsed.success)return fail('Перевірте заповнення полів.');const updated=await db.prepare('UPDATE records SET payload = ? WHERE id = ? AND owner = ?').bind(JSON.stringify(parsed.data),body.id,user.userId).run();if(updated.meta.changes===0)return fail('Автомобіль уже видалено.',404);return Response.json({record:{id:body.id,kind:'car',data:parsed.data,created:existing.created}});
 }catch(e){console.error('records update',e);return fail('Не вдалося оновити автомобіль. Спробуйте ще раз.',503);}
}
