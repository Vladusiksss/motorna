import {randomUUID} from 'node:crypto';
import {acatRequest,catalogPath,catalogParts,type CatalogVehicle} from '@/app/autodealer';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {storage} from '@/db/storage';
import {z} from 'zod';
export const dynamic='force-dynamic';
type Session={owner:string;carId:string;expires:number;vehicles:CatalogVehicle[];vehicle?:CatalogVehicle;groups:any[];parts:any[]};
const sessions=new Map<string,Session>();
const schema=z.object({carId:z.string().uuid(),session:z.string().uuid().optional(),action:z.enum(['vin','vehicle','group','root','part']),index:z.number().int().min(0).max(10000).optional()});
const headers={'Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow'};
export async function POST(request:Request){
 const reply=(data:any,status=200)=>Response.json(data,{status,headers});
 if(request.headers.get('sec-fetch-site')==='cross-site')return reply({error:'Недозволений запит'},403);
 const user=await getChatGPTUser();if(!user)return reply({error:'Увійдіть у кабінет.'},401);
 if(!process.env.AUTODEALER_TOKEN)return reply({error:'Каталог AutoDealer ще не активовано: потрібен токен постачальника.',code:'CATALOG_NOT_CONFIGURED'},503);
 let input:z.infer<typeof schema>;try{const raw=await request.text();if(raw.length>2000)throw Error();input=schema.parse(JSON.parse(raw));}catch{return reply({error:'Некоректний запит.'},400);}
 try{
 let id=input.session,s=id?sessions.get(id):undefined;
 if(input.action==='vin'){
 const {db}=await storage();const row=await db.prepare("SELECT payload FROM records WHERE id=? AND owner=? AND kind='car'").bind(input.carId,user.userId).first();if(!row)return reply({error:'Авто не знайдено.'},404);
 const vin=String(JSON.parse(String(row.payload)).vin||'').toUpperCase();if(!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin))return reply({error:'Для каталогу потрібен VIN із 17 символів.'},400);
 const result:any=await acatRequest('/api/catalogs/search2?'+new URLSearchParams({text:vin}));
 const vehicles=(Array.isArray(result.vins)?result.vins:[]).filter((v:any)=>['type','mark','model','modification'].every(k=>typeof v[k]==='string'&&v[k]));
 for(const [key,value] of sessions)if(value.expires<Date.now())sessions.delete(key);
 if(sessions.size>=100)sessions.delete(sessions.keys().next().value!);
 id=randomUUID();s={owner:user.userId,carId:input.carId,expires:Date.now()+1800000,vehicles,groups:[],parts:[]};sessions.set(id,s);
 if(vehicles.length!==1)return reply({session:id,vehicles:vehicles.map((v:CatalogVehicle)=>({name:v.title||v.modelName,parameters:v.parameters})),groups:[],parts:[]});
 s.vehicle=vehicles[0];
 }else if(!s||s.owner!==user.userId||s.carId!==input.carId||s.expires<Date.now())return reply({error:'Сеанс каталогу завершився. Відкрийте його повторно.'},410);
 if(!s)return reply({error:'Сеанс не знайдено.'},410);
 if(input.action==='vehicle'){s.vehicle=s.vehicles[input.index??-1];s.groups=[];s.parts=[];}
 if(!s.vehicle)return reply({error:'Оберіть модифікацію.'},400);
 if(input.action==='part'){const part=s.parts[input.index??-1];if(!part)return reply({error:'Оберіть деталь із каталогу.'},400);return reply({part,provider:'AutoDealer',fitmentStatus:'catalog_candidate',checkedAt:new Date().toISOString()});}
 let segments:string[]=[];
 if(input.action==='group'){const g=s.groups[input.index??-1];if(!g)return reply({error:'Оберіть групу.'},400);segments=g.hasParts?[g.parentId,g.id]:[g.id];}
 const data:any=await acatRequest(catalogPath(s.vehicle,segments));
 s.groups=Array.isArray(data.groups)?data.groups:[];s.parts=catalogParts(data);
 return reply({session:id,title:s.vehicle.title||s.vehicle.modelName,groups:s.groups.map(g=>({name:g.name})),parts:s.parts,vehicles:[],notice:'Перевірте примітки, коди комплектації та варіанти виконання перед замовленням.'});
 }catch(e){const code=e instanceof Error?e.message:'';return reply({error:code==='CATALOG_ACCESS_DENIED'?'AutoDealer відхилив доступ. Перевірте токен і підписку.':'Каталог тимчасово недоступний. Повторіть спробу.'},502);}
}
