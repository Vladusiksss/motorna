import {cleanIdentifier,mapVehicle} from '@/app/vehicle-search';
import {runtimeConfig} from '@/app/runtime-config';
export const dynamic='force-dynamic';
export async function POST(request:Request){
 if(request.headers.get('sec-fetch-site')==='cross-site')return Response.json({error:'Недозволений запит'},{status:403});
 let identifier:string;try{const text=await request.text();if(text.length>1000)throw new Error();const body=JSON.parse(text);if(typeof body.identifier!=='string')throw new Error();identifier=cleanIdentifier(body.identifier);}catch{return Response.json({error:'Введіть VIN автомобіля.'},{status:400});}
 if(!/^[A-HJ-NPR-Z0-9]{17}$/.test(identifier))return Response.json({error:'VIN має містити 17 латинських літер і цифр без I, O та Q.'},{status:400});
 const config=await runtimeConfig();
 if(config.MVS_API_URL){
  try{const response=await fetch(config.MVS_API_URL.replace(/\/$/,'')+'/lookup',{method:'POST',headers:{'Content-Type':'application/json',...(config.MVS_API_TOKEN?{Authorization:`Bearer ${config.MVS_API_TOKEN}`}:{})},body:JSON.stringify({identifier}),signal:AbortSignal.timeout(10000)});
   if(response.ok){const data:any=await response.json();if(data.vehicle?.make&&data.vehicle?.model)return Response.json(data,{headers:{'Cache-Control':'no-store'}});}
   if(![404,422].includes(response.status)&&!response.ok)return Response.json({error:'Пошук авто тимчасово недоступний. Повторіть спробу.'},{status:503});
  }catch{return Response.json({error:'Пошук авто тимчасово недоступний. Повторіть спробу.'},{status:503});}
 }
 try{const result=await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValuesExtended/${identifier}?format=json`,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(18000)});if(!result.ok)throw new Error();const body:any=await result.json();const raw=body.Results?.[0];if(!raw)throw new Error();const vehicle=mapVehicle(raw,identifier);if(!vehicle.make||!vehicle.model)return Response.json({error:'Авто не знайдено. Перевірте VIN або введіть характеристики вручну.'},{status:422});return Response.json({vehicle},{headers:{'Cache-Control':'no-store'}});}catch{return Response.json({error:'Пошук авто тимчасово недоступний. Спробуйте ще раз.'},{status:503});}
}