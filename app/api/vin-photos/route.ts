import {readJsonObject,jsonBodyFailure} from '@/app/json-body';
import {mutationGuard} from '@/app/mutation-security';
import {findVinPhotos} from '@/app/vin-listing-photos';
export const dynamic='force-dynamic';
const cache=new Map<string,{at:number;data:unknown}>();
export async function POST(request:Request){
 const denied=mutationGuard(request);if(denied)return denied;
 let vin:string;try{const bodyJson=await readJsonObject(request,200);if(typeof bodyJson.vin!=='string')throw new Error();vin=bodyJson.vin.trim().toUpperCase();if(!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin))throw new Error();}catch(error){const rejected=jsonBodyFailure(error);if(rejected)return rejected;return Response.json({error:'Введіть повний VIN із 17 символів.'},{status:400});}
 const cached=cache.get(vin);if(cached&&Date.now()-cached.at<3600000)return Response.json(cached.data,{headers:{'Cache-Control':'no-store'}});
 try{const result=await findVinPhotos(vin);const data={...result,vin,checkedAt:new Date().toISOString()};if(cache.size>=100)cache.delete(cache.keys().next().value!);cache.set(vin,{at:Date.now(),data});return Response.json(data,{headers:{'Cache-Control':'no-store'}});}catch{return Response.json({error:'Пошук оголошень тимчасово недоступний. Спробуйте ще раз.',photos:[]},{status:503});}
}
