import {z} from 'zod';
import {matchVehicle,safePhotoUrl,safeSource,dedupePhotos,type VehiclePhoto,type ProviderStatus,type VehicleIdentity} from './contracts';
import {verifiedModelPhoto} from '../verified-model-photos';
import {photoMatches,photoYearMatches,plain} from '../vehicle-photo-search';

export type Config=Record<string,string|undefined>;
type Fetch=typeof fetch;
export const paidProviders=['auto_dev','vehicles_dev'] as const;
export function providerAccess(id:string,c:Config):ProviderStatus['status']|null{
 if(!paidProviders.includes(id as typeof paidProviders[number]))return 'agreement_required';
 const prefix=id.toUpperCase();if(c[prefix+'_ENABLED']!=='true')return 'disabled';
 if(!c[prefix+'_API_KEY'])return 'missing_key';
 if(c[prefix+'_PHOTO_RIGHTS_CONFIRMED']!=='true'||!c[prefix+'_IMAGE_HOSTS'])return 'license_required';
 return null;
}
export function providerHosts(id:string,c:Config){return (c[id.toUpperCase()+'_IMAGE_HOSTS']||'').split(',').map(s=>s.trim().toLowerCase()).filter(s=>/^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/.test(s)&&!s.endsWith('.local'));}
const autoResponse=z.object({data:z.object({retail:z.array(z.string().max(2048)).max(100)}),removedAt:z.string().nullable().optional()});
const vehiclesResponse=z.object({vin:z.string(),photos:z.array(z.string().max(2048)).max(100),source:z.literal('vehicles.dev'),listingUrl:z.string().nullable().optional(),galleryComplete:z.boolean(),galleryCount:z.number().int(),photoCount:z.number().int().nullable()});

export async function providerJson(url:string,headers:Record<string,string>,fetcher:Fetch=fetch){
 // One retry only for transport/5xx. No retry on 401, 403, 404 or 429;
 // every attempt must reserve a budget slot before entering this function.
 const r=await fetcher(url,{headers,redirect:'error',signal:AbortSignal.timeout(6500)});
 if(!r.ok)return {status:r.status,data:null};
 const reader=r.body?.getReader();if(!reader)throw Error('invalid_response');let size=0;const chunks:Uint8Array[]=[];
 try{while(true){const x=await reader.read();if(x.done)break;size+=x.value.byteLength;if(size>256000){await reader.cancel();throw Error('invalid_response');}chunks.push(x.value);}}finally{reader.releaseLock();}
 const bytes=new Uint8Array(size);let offset=0;for(const x of chunks){bytes.set(x,offset);offset+=x.length;}return {status:r.status,data:JSON.parse(new TextDecoder().decode(bytes)) as unknown};
}
export async function lookupPaid(id:typeof paidProviders[number],v:VehicleIdentity,c:Config,reserve:()=>Promise<boolean>,fetcher:Fetch=fetch){
 const stamp=Date.now(),status=(s:ProviderStatus['status'],count=0):ProviderStatus=>({provider:id,status:s,count,checkedAt:stamp});
 const access=providerAccess(id,c);if(access)return {photos:[],state:status(access)};
 const endpoint=id==='auto_dev'?`https://api.auto.dev/photos/${v.vin}`:`https://api.vehicles.dev/v1/vehicles/photos/${v.vin}`;
 let response:Awaited<ReturnType<typeof providerJson>>|undefined;
 for(let attempt=0;attempt<2;attempt++){
  if(!await reserve())return {photos:[],state:status('budget_exhausted')};
  try{response=await providerJson(endpoint,{Authorization:'Bearer '+c[id.toUpperCase()+'_API_KEY'],Accept:'application/json'},fetcher);
   if(response.status<500||attempt===1)break;
  }catch(e){if(attempt===1)return {photos:[],state:status(e instanceof Error&&e.message==='invalid_response'?'invalid_response':e instanceof Error&&e.name==='TimeoutError'?'timeout':'unavailable')};}
  await new Promise(r=>setTimeout(r,250*2**attempt));
 }
 if(!response)return {photos:[],state:status('unavailable')};
 if(response.status!==200)return {photos:[],state:status(response.status===404?'no_match':response.status===401||response.status===403?'unauthorized':response.status===429?'rate_limited':'unavailable')};
 try{
  const auto=id==='auto_dev'?autoResponse.parse(response.data):null;
  const other=id==='vehicles_dev'?vehiclesResponse.parse(response.data):null;
  // Auto.dev documents a VIN-keyed resource, but does not echo the VIN. It
  // cannot satisfy Motorna's strict explicit-source-VIN proof; keep it illustrative.
  const match=matchVehicle(v.vin,other?.vin,true);
  if(match==='CONFLICT')return {photos:[],state:status('conflict')};
  if(auto?.removedAt)return {photos:[],state:status('no_match')};
  const urls=other?.photos||auto?.data.retail||[];
  const photos=dedupePhotos(urls.flatMap(raw=>{const url=safePhotoUrl(raw,providerHosts(id,c));if(!url)return [];
   return [{id:crypto.randomUUID(),provider:id,url,source:safeSource(other?.listingUrl||'')||endpoint,title:id==='auto_dev'?'Фото з VIN-ресурсу Auto.dev (VIN не повторено у відповіді)':'Фото з оголошення',match,sourceVin:other?.vin,evidence:other?'source_vin':'vin_endpoint_without_echo',license:'Дозвіл оператора за договором; без копіювання',checkedAt:stamp,expiresAt:stamp+Math.min(86400,Math.max(60,Number(c[id.toUpperCase()+'_TTL_SECONDS'])||3600))*1000,owned:false} satisfies VehiclePhoto];})).slice(0,20);
  return {photos,state:status(photos.length?'ok':'no_match',photos.length)};
 }catch{return {photos:[],state:status('invalid_response')};}
}

export async function lookupCommons(v:VehicleIdentity,fetcher:Fetch=fetch){
 const stamp=Date.now(),photos:VehiclePhoto[]=[];
 const state=(s:ProviderStatus['status']):ProviderStatus=>({provider:'commons',status:s,count:photos.length,checkedAt:stamp});
 if(!v.make||!v.model||!/^\d{4}$/.test(v.year))return {photos,state:state('no_match')};
 const add=(p:{url:string;source:string;title:string;author:string;license:string;licenseUrl?:string;note?:string})=>photos.push({...p,id:crypto.randomUUID(),provider:'commons',match:'MODEL_MATCH',evidence:p.note?'reviewed_generation_illustration':'model_year_body_color',checkedAt:stamp,expiresAt:stamp+86400000,owned:false});
 const reviewed=verifiedModelPhoto(v);if(reviewed)add(reviewed);
 try{
  const q=new URLSearchParams({action:'query',format:'json',generator:'search',gsrsearch:`${v.make} ${v.model} ${v.year}`,gsrnamespace:'6',gsrlimit:'12',prop:'imageinfo',iiprop:'url|extmetadata|mime',iiurlwidth:'960'});
  const result=await providerJson('https://commons.wikimedia.org/w/api.php?'+q,{'User-Agent':'Motorna/1.0 (licensed model illustrations)'},fetcher);
  if(result.status!==200)return {photos,state:state(photos.length?'ok':'unavailable')};
  const parsed=z.object({query:z.object({pages:z.record(z.object({title:z.string(),imageinfo:z.array(z.object({mime:z.string(),url:z.string(),thumburl:z.string().optional(),descriptionurl:z.string(),extmetadata:z.record(z.object({value:z.string().optional()}))})).optional()}))}).optional()}).parse(result.data);
  for(const page of Object.values(parsed.query?.pages||{})){
   const image=page.imageinfo?.[0];if(!image||!/^image\/(jpeg|png|webp)$/.test(image.mime))continue;
   const meta=image.extmetadata,text=page.title+' '+plain(meta.ImageDescription?.value);
   if(!photoYearMatches(text,v)||!photoMatches(text+' '+plain(meta.Categories?.value),v)||/\b(rear|back|interior|cockpit)\b/i.test(page.title))continue;
   const license=plain(meta.LicenseShortName?.value),author=plain(meta.Artist?.value),url=safePhotoUrl(image.thumburl||image.url,['upload.wikimedia.org','thumb.wikimedia.org']),source=safeSource(image.descriptionurl);
   if(url&&source&&author&&/CC BY|CC0|Public domain/i.test(license))add({url,source,title:plain(page.title),author,license,licenseUrl:safeSource(meta.LicenseUrl?.value||'')||undefined});
  }
  return {photos:dedupePhotos(photos).slice(0,6),state:state(photos.length?'ok':'no_match')};
 }catch{return {photos,state:state(photos.length?'ok':'unavailable')};}
}
