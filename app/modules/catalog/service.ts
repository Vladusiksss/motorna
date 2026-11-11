import {storage} from '@/db/storage';
import {matchesCatalogNumber} from '@/app/product-offers';
import {background} from '../jobs/background';
import {webOfferAdapter,offerMoney,type OfferSearch,type OfferAdapter} from '../integrations/offer-adapter';
const freshMs=5*60*1000,staleMs=30*60*1000;
const queued={pending:true,retryAfter:2,results:[]};
const pending=new Map<string,Promise<unknown>>();
export async function searchCatalog(owner:string,carId:string,vin:string,input:OfferSearch,adapter:OfferAdapter=webOfferAdapter){
 const keyBytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify([owner,carId,vin,adapter.id,input])));
 const key=Array.from(new Uint8Array(keyBytes),b=>b.toString(16).padStart(2,'0')).join('');
 const {db}=await storage();const now=Date.now();
 const cached=await db.prepare('SELECT payload,fresh_until,expires FROM catalog_offer_cache WHERE cache_key=? AND owner=? AND car_id=? AND vin=? AND expires>?').bind(key,owner,carId,vin,now).first<{payload:string;fresh_until:number;expires:number}>();
 const failed=await db.prepare("SELECT lease_until FROM catalog_search_jobs WHERE cache_key=? AND lease='failed' AND lease_until>?").bind(key,now).first();
 if(failed&&!cached)throw new Error('CATALOG_SEARCH_FAILED');
 const refresh=async()=>{
  const lease=crypto.randomUUID();
  const claim=await db.prepare("INSERT INTO catalog_search_jobs(cache_key,owner,car_id,vin,lease,lease_until) SELECT ?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM records WHERE owner=? AND id=? AND kind='car' AND json_extract(payload,'$.vin')=?) AND NOT EXISTS(SELECT 1 FROM user_data_erasure WHERE owner=?) ON CONFLICT(cache_key) DO UPDATE SET lease=excluded.lease,lease_until=excluded.lease_until WHERE catalog_search_jobs.lease_until<=?").bind(key,owner,carId,vin,lease,now+60000,owner,carId,vin,owner,now).run();
  if(!claim.meta.changes)return;
  const active=pending.get(key);if(active)return active;
  const task=(async()=>{
   const result=await adapter.search(input);
   const payload={...result,results:result.results.map(r=>({...r,money:offerMoney(r),dataMode:'live',numberMatch:r.matchClass==='exact_oem'||!!input.oem&&matchesCatalogNumber(r,input.oem),fitment:{status:'unverified',reason:r.matchClass==='exact_oem'?'Точний каталожний номер знайдено на сторінці. Застосовність до VIN не підтверджена.':r.matchClass==='alternative_oem'?'Джерело прямо вказує цей номер як альтернативний. Застосовність до VIN не підтверджена.':'Збіг назви не є підтвердженням сумісності; потрібна перевірка продавцем.'}})),carId,oem:input.oem,checkedAt:new Date().toISOString(),fitmentStatus:'unverified',notice:result.results.length?'Знайдені товари ще не підтверджені за комплектацією VIN.':'Точних товарів не знайдено. Перегляньте діагностику пошуку або створіть запит на підбір.'};
   const checked=Date.now();
   // Recheck the owned parent atomically: a late refresh cannot resurrect deleted data.
   await db.prepare("INSERT INTO catalog_offer_cache(cache_key,owner,car_id,vin,payload,fresh_until,expires) SELECT ?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM records WHERE owner=? AND id=? AND kind='car' AND json_extract(payload,'$.vin')=?) AND NOT EXISTS(SELECT 1 FROM user_data_erasure WHERE owner=?) AND EXISTS(SELECT 1 FROM catalog_search_jobs WHERE cache_key=? AND lease=? AND lease_until>?) ON CONFLICT(cache_key) DO UPDATE SET payload=excluded.payload,fresh_until=excluded.fresh_until,expires=excluded.expires").bind(key,owner,carId,vin,JSON.stringify(payload),checked+freshMs,checked+staleMs,owner,carId,vin,owner,key,lease,checked).run();
   await db.prepare('DELETE FROM catalog_offer_cache WHERE expires<=?').bind(checked).run();
   await db.prepare('DELETE FROM catalog_search_jobs WHERE lease_until<?').bind(checked-86400000).run();
   await db.prepare('DELETE FROM catalog_search_jobs WHERE cache_key=? AND lease=?').bind(key,lease).run();
   return payload;
  })().catch(async()=>{await db.prepare("UPDATE catalog_search_jobs SET lease='failed',lease_until=? WHERE cache_key=? AND lease=?").bind(Date.now()+5000,key,lease).run();throw new Error('CATALOG_SEARCH_FAILED');});pending.set(key,task);void task.finally(()=>pending.delete(key)).catch(()=>{});return task;
 };
 if(cached){if(cached.fresh_until<=now)await background(refresh().then(()=>{}));return {...JSON.parse(cached.payload),cache:{status:cached.fresh_until>now?'fresh':'refreshing',expiresAt:new Date(cached.expires).toISOString()}};}
 await background(refresh().then(()=>{}));
 return queued;
}
