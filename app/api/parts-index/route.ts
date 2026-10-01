import {randomUUID} from 'node:crypto';
import {partsIndexCars,partsIndexResults} from '@/app/parts-index';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {storage} from '@/db/storage';
import {z} from 'zod';
export const dynamic='force-dynamic';
const sessions=new Map<string,{owner:string;carId:string;expires:number;cars:Awaited<ReturnType<typeof partsIndexCars>>;selected?:number;parts:any[]}>();
const schema=z.object({carId:z.string().uuid(),session:z.string().uuid().optional(),action:z.enum(['vin','vehicle','root','part']),index:z.number().int().min(0).max(100000).optional()});
export async function POST(request:Request){
 const reply=(d:any,status=200)=>Response.json(d,{status,headers:{'Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow'}});
 if(request.headers.get('sec-fetch-site')==='cross-site')return reply({error:'Недозволений запит'},403);
 const user=await getChatGPTUser();if(!user)return reply({error:'Увійдіть у кабінет.'},401);
 if(!process.env.PARTS_INDEX_API_KEY)return reply({error:'Parts Index не активовано. Потрібен API-ключ із доступом «Деталі за VIN».',code:'CATALOG_NOT_CONFIGURED'},503);
 let input:z.infer<typeof schema>;try{const raw=await request.text();if(raw.length>2000)throw Error();input=schema.parse(JSON.parse(raw));}catch{return reply({error:'Некоректний запит.'},400);}
 try{
 let id=input.session,s=id?sessions.get(id):undefined;
 if(input.action==='vin'){
 const {db}=await storage();const row=await db.prepare("SELECT payload FROM records WHERE id=? AND owner=? AND kind='car'").bind(input.carId,user.userId).first();if(!row)return reply({error:'Авто не знайдено.'},404);
 const vin=String(JSON.parse(String(row.payload)).vin||'').toUpperCase();if(!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin))return reply({error:'Потрібен коректний VIN.'},400);
 const cars=await partsIndexCars(vin);for(const [k,v] of sessions)if(v.expires<Date.now())sessions.delete(k);if(sessions.size>=100)sessions.delete(sessions.keys().next().value!);
 id=randomUUID();s={owner:user.userId,carId:input.carId,expires:Date.now()+1800000,cars,parts:[]};sessions.set(id,s);
 if(cars.length!==1)return reply({session:id,vehicles:cars.map(c=>({name:[c.brand?.name,c.model,c.year,c.description].filter(Boolean).join(' · '),parameters:[{value:JSON.stringify(c.info||'')}]})),groups:[],parts:[]});s.selected=0;
 }else if(!s||s.owner!==user.userId||s.carId!==input.carId||s.expires<Date.now())return reply({error:'Сеанс завершено. Повторіть пошук за VIN.'},410);
 if(!s)return reply({error:'Сеанс не знайдено.'},410);
 if(input.action==='vehicle'){if(!s.cars[input.index??-1])return reply({error:'Оберіть автомобіль.'},400);s.selected=input.index;s.parts=[];}
 const vehicle=s.cars[s.selected??-1];if(!vehicle)return reply({error:'Оберіть модифікацію.'},400);
 if(input.action==='part'){const part=s.parts[input.index??-1];if(!part)return reply({error:'Оберіть деталь.'},400);return reply({part,provider:'Parts Index',checkedAt:new Date().toISOString()});}
 const data=await partsIndexResults(vehicle.id);if(data.status==='failed')return reply({error:'Parts Index не зміг отримати перелік деталей.'},502);
 s.parts=data.status==='success'?data.list.map(p=>({number:p.code,name:p.name.slice(0,140),description:p.groups.map(g=>g.name).filter(Boolean).join(' · '),notice:data.partsBrand?.name||''})):[];
 return reply({session:id,title:[vehicle.brand?.name,vehicle.model,vehicle.year].filter(Boolean).join(' '),vehicles:[],groups:[],parts:s.parts,pending:data.status!=='success',notice:data.status!=='success'?'Каталог готує перелік деталей. Оновіть результат.':'Артикули отримано від Parts Index для вибраного VIN. Звірте виробника й виконання товару.'});
 }catch(e){const c=e instanceof Error?e.message:'';return reply({error:c==='CATALOG_ACCESS_DENIED'?'Parts Index відхилив ключ або не надав доступ до Parts By VIN.':c==='CATALOG_RATE_LIMIT'?'Перевищено ліміт Parts Index. Спробуйте пізніше.':'Parts Index тимчасово недоступний або повернув неочікувані дані.'},502);}
}
