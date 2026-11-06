import {readJsonObject,jsonBodyFailure} from '@/app/json-body';
import {mutationGuard} from '@/app/mutation-security';
import {z} from 'zod';
import {routeStations} from '@/app/station-routing';
import {runtimeConfig} from '@/app/runtime-config';
const point=z.object({lat:z.number().min(44).max(52.5),lon:z.number().min(22).max(40.3)});
export async function POST(request:Request){
 const denied=mutationGuard(request);if(denied)return denied;
 try{const bodyJson=await readJsonObject(request,40000);const data=z.object({origin:point,stations:z.array(point.extend({id:z.string().max(60),distance:z.number().nonnegative()})).max(200)}).parse(bodyJson);const cfg=await runtimeConfig();return Response.json({stations:await routeStations(data.origin,data.stations,cfg.ROUTER_URL)});
 }catch(error){const rejected=jsonBodyFailure(error);if(rejected)return rejected;return Response.json({error:'Не вдалося розрахувати маршрути.'},{status:400});}}
