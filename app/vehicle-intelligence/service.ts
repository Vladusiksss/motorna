import {lookupPublicVin,lookupPublicModel} from './public-search';
import {storage} from '@/db/storage';
import {runtimeConfig} from '../runtime-config';
import {lookupPaid,lookupCommons,paidProviders} from './providers';
import {ownedVehicle,savePhoto,reserveBudget,finishJob,collectPhotoObjects,PhotoError} from './store';
import type {ProviderStatus} from './contracts';

const pending=new Set<Promise<void>>();
async function background(task:Promise<void>){
 try{const {waitUntil}=await import('cloudflare:workers');waitUntil(task);}catch{
  // Local Node development only. Production uses the Workers lifecycle.
  pending.add(task);void task.finally(()=>pending.delete(task));
 }
}
export async function startPhotos(owner:string,carId:string,force=false){
 const v=await ownedVehicle(owner,carId),{db}=await storage(),now=Date.now(),lease=crypto.randomUUID();
 await collectPhotoObjects();
 const old=await db.prepare('SELECT retry_at,lease_until,providers FROM vehicle_photo_search WHERE owner=? AND car_id=?').bind(owner,carId).first<{retry_at:number;lease_until:number;providers:string}>();
 const previous=JSON.parse(old?.providers||'[]') as ProviderStatus[];const legacy=previous.length>0&&!previous.some(p=>p.provider==='public_vin_search');
 if(old&&old.lease_until>now)return;
 if(old&&old.retry_at>now&&!legacy){if(force)throw new PhotoError('Пошук уже виконано. Повторіть пізніше.',429,'PHOTO_RATE_LIMIT');return;}
 if(!await reserveBudget('search:'+owner,30))throw new PhotoError('Денний ліміт пошуку вичерпано.',429,'PHOTO_RATE_LIMIT');
 const claimed=await db.prepare("INSERT INTO vehicle_photo_search(owner,car_id,vin,status,lease,lease_until,retry_at) SELECT ?,?,?,'running',?,?,? WHERE EXISTS(SELECT 1 FROM records WHERE owner=? AND id=? AND kind='car' AND json_extract(payload,'$.vin')=?) ON CONFLICT(owner,car_id) DO UPDATE SET vin=excluded.vin,status='running',lease=excluded.lease,lease_until=excluded.lease_until,retry_at=excluded.retry_at WHERE vehicle_photo_search.lease_until < ? AND (vehicle_photo_search.retry_at <= ? OR ?=1)").bind(owner,carId,v.vin,lease,now+25000,now+60000,owner,carId,v.vin,now,now,Number(legacy)).run();
 if(!claimed.meta.changes)return;
 const task=(async()=>{
  const states:ProviderStatus[]=[];
  try{
   const c=await runtimeConfig();
   const jobs=paidProviders.map(id=>async()=>lookupPaid(id,v,c,async()=>{
    const globalLimit=Math.min(1000,Math.max(1,Number(c.VEHICLE_PHOTO_DAILY_CALL_LIMIT)||20));
    if(!await reserveBudget('paid:global',globalLimit))return false;
    return reserveBudget('paid:'+owner,Math.min(20,globalLimit));
   }));
   await Promise.allSettled([...jobs,...(c.VEHICLE_WEB_PHOTOS_ENABLED==='false'?[async()=>({photos:[],state:{provider:'public_vin_search',status:'disabled' as const,count:0,checkedAt:Date.now()}})]:[async()=>lookupPublicVin(v),async()=>lookupPublicModel(v)]),async()=>c.VEHICLE_COMMONS_ENABLED==='false'?{photos:[],state:{provider:'commons',status:'disabled' as const,count:0,checkedAt:Date.now()}}:lookupCommons(v)].map(async run=>{
    const result=await run();states.push(result.state);for(const p of result.photos)await savePhoto(owner,carId,v.vin,p,lease);
   }));
   for(const provider of ['auto_ria','copart','iaa'])states.push({provider,status:'agreement_required',count:0,checkedAt:Date.now()});
   await finishJob(owner,carId,lease,states);
  }catch{await finishJob(owner,carId,lease,[...states,{provider:'motorna',status:'unavailable',count:0,checkedAt:Date.now()}]);}
 })().catch(()=>{console.warn('vehicle_photo_job_failed');});
 await background(task);
}
