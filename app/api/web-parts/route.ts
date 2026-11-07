import {apiBoundary} from '@/app/api-response';
import {readJsonObject,jsonBodyFailure} from '@/app/json-body';
import {mutationGuard} from '@/app/mutation-security';
import {decodeVpic,VpicError} from '@/app/vpic';
import {searchCatalog} from '@/app/modules/catalog/service';
import {findOwnedCar,vehicleSearchLabel} from '@/app/modules/garage/service';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {catalogQuerySchema as schema} from '@/app/modules/shared/contracts';
import {z} from 'zod';
export const dynamic='force-dynamic';
export async function POST(request:Request){
 return apiBoundary(async()=>{

 const denied=mutationGuard(request);if(denied)return denied;
 const user=await getChatGPTUser();if(!user)return Response.json({error:'Увійдіть і підтвердьте автомобіль.'},{status:401});
 let data:z.infer<typeof schema>;try{const bodyJson=await readJsonObject(request,2000);data=schema.parse(bodyJson);}catch(error){const rejected=jsonBodyFailure(error);if(rejected)return rejected;return Response.json({error:'Оберіть автомобіль у гаражі та вкажіть деталь.'},{status:400});}
 try{
 const savedCar=await findOwnedCar(user.userId,data.carId);
 if(!savedCar)return Response.json({error:'Автомобіль не знайдено у вашому гаражі.'},{status:404});
 const decoded=data.oem?null:await decodeVpic(String(savedCar.vin||''));
 const car=decoded?{...savedCar,make:decoded.make||savedCar.make,model:savedCar.model||decoded.model,name:[decoded.make||savedCar.make,savedCar.model||decoded.model].filter(Boolean).join(' '),year:savedCar.year||decoded.year,engine:savedCar.engine||decoded.engine}:savedCar;
 const vehicle=vehicleSearchLabel(car);
 const result=await searchCatalog(user.userId,data.carId,String(car.vin||''),{vehicle,part:data.part,model:String(car.model||''),oem:data.oem});
 return Response.json(result,{status:'pending' in result?202:200,headers:{'Cache-Control':'private, no-store',...('pending' in result?{'Retry-After':'2'}:{})}});
 }catch(e){if(e instanceof VpicError)return Response.json({error:e.message,code:'VIN_NOT_VERIFIED'},{status:e.status});return Response.json({error:'Автоматичний пошук тимчасово недоступний. Повторіть спробу.',code:'SEARCH_UNAVAILABLE'},{status:503});}

 },"/api/web-parts",request);
}
