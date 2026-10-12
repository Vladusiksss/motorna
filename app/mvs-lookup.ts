import {runtimeConfig} from './runtime-config';
import {registeredVehicle} from './vehicle-resolution';
export async function lookupMvs(vin:string){
 try{
  const config=await runtimeConfig();
  const endpoint=config.CUSTOMER_HTTP_MVS||config.MVS_API_URL;
  if(!endpoint)return null;
  const url=new URL('/lookup',endpoint);
  if(!['http:','https:'].includes(url.protocol)||url.username||url.password)return null;
  const response=await fetch(url,{method:'POST',redirect:'error',headers:{'Content-Type':'application/json',...(config.MVS_API_TOKEN?{Authorization:'Bearer '+config.MVS_API_TOKEN}:{})},body:JSON.stringify({identifier:vin}),signal:AbortSignal.timeout(5000)});
  if(!response.ok)return null;
  const text=await response.text();if(text.length>32000)return null;
  return registeredVehicle(JSON.parse(text).vehicle,vin);
 }catch{return null;}
}
