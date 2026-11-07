import {apiBoundary} from '@/app/api-response';
import {readJsonObject,jsonBodyFailure} from '@/app/json-body';
import {mutationGuard} from '@/app/mutation-security';

export const dynamic='force-dynamic';

export async function POST(request:Request){
 return apiBoundary(async()=>{

 const denied=mutationGuard(request);if(denied)return denied;
 let vin:string;try{const bodyJson=await readJsonObject(request,200);if(typeof bodyJson.vin!=='string')throw new Error();vin=bodyJson.vin.trim().toUpperCase();if(!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin))throw new Error();}catch(error){const rejected=jsonBodyFailure(error);if(rejected)return rejected;return Response.json({error:'Введіть повний VIN із 17 символів.'},{status:400});}
 // Legacy preview compatibility: private licensed lookups require a saved car
 // and run through /api/vehicle-photos, never anonymous HTML scraping.
 return Response.json({vin,photos:[],status:'save_vehicle_required'});

 },"/api/vin-photos");
}
