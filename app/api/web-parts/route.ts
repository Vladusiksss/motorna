import {decodeVpic,VpicError} from '@/app/vpic';
import {findOffers} from '@/app/product-offers';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {storage} from '@/db/storage';
import {z} from 'zod';
const schema=z.object({carId:z.string().uuid(),part:z.string().trim().min(2).max(140),oem:z.string().trim().max(40).regex(/^[A-Za-z0-9 .-]*$/).default('')});
const cache=new Map<string,{at:number;data:any}>();
export const dynamic='force-dynamic';
export async function POST(request:Request){
 if(request.headers.get('sec-fetch-site')==='cross-site')return Response.json({error:'Недозволений запит'},{status:403});
 const user=await getChatGPTUser();if(!user)return Response.json({error:'Увійдіть і підтвердьте автомобіль.'},{status:401});
 let data:z.infer<typeof schema>;try{const raw=await request.text();if(raw.length>2000)throw new Error();data=schema.parse(JSON.parse(raw));}catch{return Response.json({error:'Оберіть автомобіль у гаражі та вкажіть деталь.'},{status:400});}
 try{
 const {db}=await storage();const row=await db.prepare("SELECT payload FROM records WHERE id=? AND owner=? AND kind='car'").bind(data.carId,user.userId).first();
 if(!row)return Response.json({error:'Автомобіль не знайдено у вашому гаражі.'},{status:404});
 const savedCar=JSON.parse(String(row.payload));
 const decoded=data.oem?null:await decodeVpic(String(savedCar.vin||''));
 const car=decoded?{...savedCar,make:decoded.make,model:decoded.model,name:[decoded.make,decoded.model].join(' '),year:decoded.year,engine:decoded.engine}:savedCar;
 const engine=String(car.engine||'').replace(/(\d{3,4})\s*см[³3]/g,(_,cc)=>(Number(cc)/1000).toFixed(1)+' л').replace(/ДИЗЕЛЬНЕ ПАЛИВО/gi,'дизель').replace(/БЕНЗИН/gi,'бензин').replace(/[·]/g,' ').replace(/\s+/g,' ').trim();
 const vehicle=[car.name,car.year,engine].filter(Boolean).join(' ').slice(0,160);
 const key=JSON.stringify([user.userId,data.carId,car.vin,vehicle,data.part,data.oem]);const cached=cache.get(key);if(cached&&Date.now()-cached.at<300000)return Response.json(cached.data);
 const result=await findOffers(vehicle,data.part,car.model||'',data.oem);
 const payload={...result,results:result.results.map(r=>({...r,fitment:{status:'unverified',reason:data.oem?'Каталожний номер збігається зі сторінкою товару. Його застосовність до VIN не підтверджена.':'Модель і назву деталі зіставлено. Відповідність комплектації за VIN не підтверджена.'}})),carId:data.carId,oem:data.oem,checkedAt:new Date().toISOString(),fitmentStatus:'unverified',notice:result.results.length?'Знайдені товари ще не підтверджені за комплектацією VIN.':'Не знайдено конкретних товарів із ціною. Уточніть назву деталі або артикул.'};
 if(cache.size>=50)cache.delete(cache.keys().next().value!);cache.set(key,{at:Date.now(),data:payload});return Response.json(payload);
 }catch(e){if(e instanceof VpicError)return Response.json({error:e.message,code:'VIN_NOT_VERIFIED'},{status:e.status});return Response.json({error:'Автоматичний пошук тимчасово недоступний. Повторіть спробу.',code:'SEARCH_UNAVAILABLE'},{status:503});}
}
