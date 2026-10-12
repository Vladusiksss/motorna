import {storage} from '@/db/storage';
import {registeredVehicle} from './vehicle-resolution';
const fields=['Марка','Модель','Рік','Колір','Кузов','Паливо','Об’єм двигуна, см³','Тип','Призначення','Споряджена маса, кг','Повна маса, кг','Потужність, кВт'];
export function registryRecord(line:string,vin:string){
 try{
  const v=JSON.parse(line);
  if(!Array.isArray(v)||v.length!==14||v[0]!==vin||v.some(x=>typeof x!=='string'))return null;
  return registeredVehicle({vin,make:v[2],model:v[3],year:v[4],engine:[v[8]?v[8]+' см³':'',v[7]].filter(Boolean).join(' · '),fields:fields.flatMap((label,i)=>v[i+2]?[{label,value:v[i+2]}]:[]),checkedAt:v[1]},vin);
 }catch{return null;}
}
export async function lookupCloudRegistry(vin:string){
 try{
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(vin));
  const shard=new Uint8Array(digest)[0].toString(16).padStart(2,'0');
  const {bucket}=await storage();if(!bucket)return null;
  const object=await bucket.get('vehicle-registry/mvs-v1/'+shard+'.gz');if(!object)return null;
  const reader=object.body.pipeThrough(new DecompressionStream('gzip')).getReader();
  const decoder=new TextDecoder();let pending='',bytes=0;
  try{while(true){const {value,done}=await reader.read();if(done)break;bytes+=value.length;if(bytes>16*1024*1024)return null;pending+=decoder.decode(value,{stream:true});let end;
   while((end=pending.indexOf('\n'))>=0){const line=pending.slice(0,end);pending=pending.slice(end+1);if(line.startsWith('["'+vin+'"')){const result=registryRecord(line,vin);if(result)return result;}}
  }}finally{await reader.cancel();}
  return null;
 }catch{return null;}
}
