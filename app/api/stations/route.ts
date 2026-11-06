import {apiBoundary} from '@/app/api-response';
import {readJsonObject,jsonBodyFailure} from '@/app/json-body';
import {mutationGuard} from '@/app/mutation-security';
import {usableStation,uniqueStations} from '@/app/station-quality';
import {geocoderParameters,stationQuery,approximateDistance,uniqueAddresses,loadStationData} from '@/app/station-geography';
import {stationContacts} from '@/app/station-contacts';
import {directions} from '@/app/station-routing';
import {runtimeConfig} from '@/app/runtime-config';
import {z} from 'zod';
const cache=new Map<string,{at:number;value:unknown}>();const lastRequest=new Map<string,number>();
const input=z.union([z.object({address:z.string().trim().min(4).max(180)}),z.object({lat:z.number().min(44).max(52.5),lon:z.number().min(22).max(40.3),radius:z.union([z.literal(8),z.literal(15),z.literal(30)]).default(8)})]);

export async function POST(request:Request){
 return apiBoundary(async()=>{

 const denied=mutationGuard(request);if(denied)return denied;
 let data:z.infer<typeof input>;try{const bodyJson=await readJsonObject(request,1000);data=input.parse(bodyJson);}catch(error){const rejected=jsonBodyFailure(error);if(rejected)return rejected;return Response.json({error:'Укажіть адресу в Україні.'},{status:400});}
 const key=JSON.stringify(data),cached=cache.get(key);if(cached&&Date.now()-cached.at<3600000)return Response.json(cached.value);
 const throttleKey='address' in data?'geocode':'stations';if(Date.now()-(lastRequest.get(throttleKey)||0)<1200)return Response.json({error:'Зачекайте кілька секунд і повторіть пошук.'},{status:429});lastRequest.set(throttleKey,Date.now());
 const cfg=await runtimeConfig();const headers={'User-Agent':'Motorna/1.0 (Ukraine vehicle service finder)'};
 try{
 let value:unknown;
 if('address' in data){
 const url=new URL(cfg.ADDRESS_GEOCODER_URL||'https://nominatim.openstreetmap.org/search');url.search=geocoderParameters(data.address).toString();
 const r=await fetch(url,{headers,signal:AbortSignal.timeout(12000)});if(!r.ok)throw new Error();const body=z.array(z.object({lat:z.string(),lon:z.string(),address:z.record(z.string(),z.string()).default({})})).parse(await r.json());
 const locations=body.filter((p)=>{const a=p.address||{};return a.road&&a.country_code==='ua';}).map((p)=>{const a=p.address;return {lat:Number(p.lat),lon:Number(p.lon),precision:a.house_number?'building':'street',label:[a.road,a.house_number,a.city||a.town||a.village,a.suburb||a.city_district,a.state].filter(Boolean).join(', ')};});
 value={locations:uniqueAddresses(locations)};
 }else{const query=stationQuery(data.lat,data.lon,data.radius);
 const body=await loadStationData(cfg.OVERPASS_URL||'https://overpass-api.de/api/interpreter',query,headers);
 const elements=z.array(z.object({id:z.union([z.string(),z.number()]),type:z.string(),lat:z.number().optional(),lon:z.number().optional(),center:z.object({lat:z.number(),lon:z.number()}).optional(),tags:z.record(z.string(),z.string()).optional()})).parse(body.elements||[]);const stations=elements.filter(usableStation).flatMap((e)=>{const t=e.tags||{},lat=e.lat??e.center?.lat,lon=e.lon??e.center?.lon;if(lat===undefined||lon===undefined)return [];const distance=approximateDistance(data,{lat,lon});return [{id:`${e.type}/${e.id}`,name:t['name:uk']||t.name||t.brand,sourceUrl:`https://www.openstreetmap.org/${e.type}/${e.id}`,checkedAt:new Date().toISOString(),locationPrecision:e.type==='node'?'point':'area-center',lat,lon,distance:Math.round(distance*10)/10,address:[t['addr:city'],t['addr:street'],t['addr:housenumber']].filter(Boolean).join(', '),...stationContacts(t),maps:directions(data,{lat,lon}),waze:`https://www.waze.com/ul?ll=${lat},${lon}&navigate=yes`}];}).filter(s=>Number.isFinite(s.distance)).sort((a,b)=>a.distance-b.distance);value={stations:uniqueStations(stations).filter(s=>s.distance<=data.radius),origin:{lat:data.lat,lon:data.lon}};
 }
 if(cache.size>=100)cache.delete(cache.keys().next().value!);cache.set(key,{at:Date.now(),value});return Response.json(value);
 }catch{return Response.json({error:'address' in data?'Сервіс адрес тимчасово не відповідає. Повторіть пошук.':'Адресу визначено, але сервіс СТО тимчасово не відповідає. Повторіть пошук СТО або відкрийте Google Maps.'},{status:503});}

 },"/api/stations");
}
