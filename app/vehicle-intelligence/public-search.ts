import {findVinPhotos} from '../vin-listing-photos';
import {findWebModelPhotos} from '../web-model-photos';
import {dedupePhotos,type VehicleIdentity,type VehiclePhoto,type ProviderStatus} from './contracts';

type Result={photos:VehiclePhoto[];state:ProviderStatus};
const cache=new Map<string,{expires:number;result:Result}>();
const pending=new Map<string,Promise<Result>>();
// Restored public-page lookup, independent of commercial API adapters. No
// authentication, CAPTCHA solving, browser impersonation or private endpoints.
async function cached(key:string,provider:string,run:()=>Promise<Result>):Promise<Result>{
 const hit=cache.get(key);if(hit&&hit.expires>Date.now())return hit.result;
 const active=pending.get(key);if(active)return active;
 if(pending.size>=8)return {photos:[],state:{provider,status:'rate_limited',count:0,checkedAt:Date.now()}};
 const job=run().catch(()=>({photos:[],state:{provider,status:'unavailable' as const,count:0,checkedAt:Date.now()}})).then(result=>{
  if(cache.size>=100)cache.delete(cache.keys().next().value!);
  cache.set(key,{expires:Date.now()+(result.state.status==='ok'?3600000:60000),result});return result;
 }).finally(()=>pending.delete(key));pending.set(key,job);return job;
}
export async function lookupPublicVin(v:VehicleIdentity,fetcher:typeof fetch=fetch):Promise<Result>{
 return cached('vin:'+v.vin,'public_vin_search',async()=>{
  const checkedAt=Date.now(),result=await findVinPhotos(v.vin,fetcher,AbortSignal.timeout(19000));
  const photos=dedupePhotos(result.photos.map(p=>({id:crypto.randomUUID(),provider:p.host,url:p.url,source:p.source,title:p.title,sourceVin:p.vin,match:'EXACT_VIN_MATCH' as const,evidence:'exact_vin_on_public_listing',license:'Права на фото належать правовласнику джерела',checkedAt,expiresAt:checkedAt+3600000,owned:false}))).slice(0,12);
  return {photos,state:{provider:'public_vin_search',status:result.partial?'unavailable':photos.length?'ok':'no_match',count:photos.length,checkedAt}};
 });
}
export async function lookupPublicModel(v:VehicleIdentity,fetcher:typeof fetch=fetch):Promise<Result>{
 return cached('model:'+JSON.stringify([v.make,v.model,v.year,v.body,v.color]),'public_model_search',async()=>{
  const checkedAt=Date.now();if(!v.make||!v.model||!/^\d{4}$/.test(v.year))return {photos:[],state:{provider:'public_model_search',status:'no_match',count:0,checkedAt}};
  const result=await findWebModelPhotos(v,fetcher,AbortSignal.timeout(19000));
  const photos=dedupePhotos(result.photos.map(p=>({id:crypto.randomUUID(),provider:p.host,url:p.url,source:p.source,title:p.title,match:'MODEL_MATCH' as const,evidence:'public_listing_model_year_body_color',author:p.author,license:'Права на фото належать правовласнику джерела',checkedAt,expiresAt:checkedAt+3600000,owned:false}))).slice(0,6);
  return {photos,state:{provider:'public_model_search',status:result.partial?'unavailable':photos.length?'ok':'no_match',count:photos.length,checkedAt}};
 });
}
