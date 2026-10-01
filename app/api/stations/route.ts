import {stationContacts} from '@/app/station-contacts';
import {directions,routeStations} from '@/app/station-routing';
import {runtimeConfig} from '@/app/runtime-config';
import {z} from 'zod';
const cache=new Map<string,{at:number;value:any}>();const lastRequest=new Map<string,number>();
const input=z.union([z.object({address:z.string().trim().min(4).max(180)}),z.object({lat:z.number().min(49.1).max(51.7),lon:z.number().min(29.1).max(32.2)})]);

export async function POST(request:Request){
 if(request.headers.get('sec-fetch-site')==='cross-site')return Response.json({error:'Недозволений запит'},{status:403});
 let data:z.infer<typeof input>;try{const text=await request.text();if(text.length>1000)throw new Error();data=input.parse(JSON.parse(text));}catch{return Response.json({error:'Укажіть адресу в Києві або Київській області.'},{status:400});}
 const key=JSON.stringify(data),cached=cache.get(key);if(cached&&Date.now()-cached.at<3600000)return Response.json(cached.value);
 const throttleKey='address' in data?'geocode':'stations';if(Date.now()-(lastRequest.get(throttleKey)||0)<1200)return Response.json({error:'Зачекайте кілька секунд і повторіть пошук.'},{status:429});lastRequest.set(throttleKey,Date.now());
 const cfg=await runtimeConfig();const headers={'User-Agent':'Motorna/1.0 (Kyiv vehicle service finder)'};
 try{
 let value:any;
 if('address' in data){
 const url=new URL(cfg.ADDRESS_GEOCODER_URL||'https://nominatim.openstreetmap.org/search');url.search=new URLSearchParams({q:data.address,format:'jsonv2',addressdetails:'1',countrycodes:'ua',limit:'8',viewbox:'29.1,51.7,32.2,49.1',bounded:'1','accept-language':'uk'}).toString();
 const r=await fetch(url,{headers,signal:AbortSignal.timeout(12000)});if(!r.ok)throw new Error();const body:any=await r.json();
 const locations=(Array.isArray(body)?body:[]).filter((p:any)=>{const a=p.address||{};return a.road&&a.country_code==='ua'&&(a['ISO3166-2-lvl4']==='UA-30'||a['ISO3166-2-lvl4']==='UA-32'||/Київ|Kyiv/i.test([a.state,a.city].join(' ')));}).map((p:any)=>{const a=p.address;return {lat:Number(p.lat),lon:Number(p.lon),precision:a.house_number?'building':'street',label:[a.road,a.house_number,a.city||a.town||a.village,a.suburb||a.city_district].filter(Boolean).join(', ')};});
 value={locations:Array.from(new Map(locations.map((p:any)=>[p.label,p])).values())};
 }else{const query=`[out:json][timeout:20];(area["ISO3166-2"="UA-32"];area["ISO3166-2"="UA-30"];)->.scope;nwr["shop"="car_repair"](area.scope)(around:8000,${data.lat},${data.lon});out center tags;`;
 const r=await fetch(cfg.OVERPASS_URL||'https://overpass-api.de/api/interpreter',{method:'POST',headers:{...headers,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({data:query}),signal:AbortSignal.timeout(25000)});if(!r.ok)throw new Error();const body:any=await r.json();
 value={stations:(body.elements||[]).filter((e:any)=>{const t=e.tags||{};return (t['name:uk']||t.name||t.brand)&&! /^(сто|автомайстерня|гбо|шиномонтаж)$/i.test((t['name:uk']||t.name||t.brand||'').trim())&&!['yes','true'].includes(t.disused)&&!['yes','true'].includes(t.abandoned)&&t.shop==='car_repair';}).map((e:any)=>{const t=e.tags||{},lat=e.lat??e.center?.lat,lon=e.lon??e.center?.lon;const distance=Math.sqrt(((lat-data.lat)*111.2)**2+((lon-data.lon)*70.8)**2);return {id:`${e.type}/${e.id}`,name:t['name:uk']||t.name||t.brand,sourceUrl:`https://www.openstreetmap.org/${e.type}/${e.id}`,checkedAt:new Date().toISOString(),lat,lon,distance:Math.round(distance*10)/10,address:[t['addr:city'],t['addr:street'],t['addr:housenumber']].filter(Boolean).join(', '),...stationContacts(t),maps:directions(data,{lat,lon}),waze:`https://www.waze.com/ul?ll=${lat},${lon}&navigate=yes`};}).filter((s:any)=>Number.isFinite(s.distance)).sort((a:any,b:any)=>a.distance-b.distance).slice(0,20)};value.stations=await routeStations(data,value.stations,cfg.ROUTER_URL);value.origin={lat:data.lat,lon:data.lon};
 }
 if(cache.size>=100)cache.delete(cache.keys().next().value!);cache.set(key,{at:Date.now(),value});return Response.json(value);
 }catch{return Response.json({error:'Карти тимчасово не відповідають. Повторіть пошук або відкрийте Google Maps.'},{status:503});}
}
