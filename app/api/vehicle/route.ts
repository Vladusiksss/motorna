import {apiBoundary} from '@/app/api-response';
import {readJsonObject,jsonBodyFailure} from '@/app/json-body';
import {mutationGuard} from '@/app/mutation-security';
import {decodeVpic,VpicError} from '@/app/vpic';
import {cleanIdentifier,type VehicleInfo} from '@/app/vehicle-search';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {storage} from '@/db/storage';
export const dynamic='force-dynamic';
export async function POST(request:Request){
 return apiBoundary(async()=>{

 const denied=mutationGuard(request);if(denied)return denied;
 let identifier:string;try{const bodyJson=await readJsonObject(request,1000);const body=bodyJson;if(typeof body.identifier!=='string')throw new Error();identifier=body.identifier;}catch(error){const rejected=jsonBodyFailure(error);if(rejected)return rejected;return Response.json({error:'Введіть VIN автомобіля.'},{status:400});}
 try{
  const vin=cleanIdentifier(identifier);
  if(!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin))throw new VpicError('Перевірте 17 символів VIN.',400);
  const user=await getChatGPTUser();
  if(user){
   const {db}=await storage();
   const row=await db.prepare("SELECT payload FROM records WHERE owner=? AND kind='car' AND json_extract(payload,'$.vin')=? LIMIT 1").bind(user.userId,vin).first();
   if(row){const car=JSON.parse(String(row.payload));if(car.make&&car.model&&car.year){const vehicle:VehicleInfo={vin,make:car.make,model:car.model,year:String(car.year),engine:car.engine||'',fields:car.specifications||[],source:car.source||'Мій гараж',warning:'',checkedAt:new Date().toISOString()};return Response.json({vehicle},{headers:{'Cache-Control':'private, no-store'}});}}
  }
  return Response.json({vehicle:await decodeVpic(vin)},{headers:{'Cache-Control':'private, no-store'}});
 }catch(e){return Response.json({error:e instanceof VpicError?e.message:'Пошук авто тимчасово недоступний.'},{status:e instanceof VpicError?e.status:503});}

 },"/api/vehicle");
}
