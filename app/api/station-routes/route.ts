import {z} from 'zod';
import {routeStations} from '@/app/station-routing';
import {runtimeConfig} from '@/app/runtime-config';
const point=z.object({lat:z.number().min(44).max(52.5),lon:z.number().min(22).max(40.3)});
export async function POST(request:Request){
 if(request.headers.get('sec-fetch-site')==='cross-site')return Response.json({error:'Недозволений запит'},{status:403});
 try{const raw=await request.text();if(raw.length>40000)throw Error();const data=z.object({origin:point,stations:z.array(point.extend({id:z.string().max(60),distance:z.number().nonnegative()})).max(200)}).parse(JSON.parse(raw));const cfg=await runtimeConfig();return Response.json({stations:await routeStations(data.origin,data.stations,cfg.ROUTER_URL)});
 }catch{return Response.json({error:'Не вдалося розрахувати маршрути.'},{status:400});}}
