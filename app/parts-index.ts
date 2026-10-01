import {z} from 'zod';
const car=z.object({id:z.string().min(1).max(500),brand:z.object({name:z.string().optional()}).passthrough().optional(),model:z.string().optional(),year:z.string().optional(),description:z.string().optional(),info:z.unknown().optional()});
const part=z.object({code:z.string().min(2).max(40).regex(/^[A-Za-z0-9 .-]+$/),name:z.string(),groups:z.array(z.object({name:z.string().optional()}).passthrough())});
export async function partsIndexRequest(path:string,key=process.env.PARTS_INDEX_API_KEY,fetcher:typeof fetch=fetch){
 if(!key)throw Error('CATALOG_NOT_CONFIGURED');
 if(!path.startsWith('/v1/parts-by-vin/cars'))throw Error('INVALID_PATH');
 const r=await fetcher('https://api.parts-index.com'+path,{headers:{Authorization:key,Accept:'application/json'},redirect:'error',cache:'no-store',signal:AbortSignal.timeout(25000)});
 if(!r.ok)throw Error(r.status===401||r.status===403?'CATALOG_ACCESS_DENIED':r.status===429?'CATALOG_RATE_LIMIT':'CATALOG_UNAVAILABLE');
 return r.json();
}
export async function partsIndexCars(vin:string){if(!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin))throw Error('INVALID_VIN');const d=await partsIndexRequest('/v1/parts-by-vin/cars?'+new URLSearchParams({q:vin,lang:'ru'}));return z.object({list:z.array(car)}).parse(d).list;}
export function parsePartsIndexResults(d:unknown){return z.object({status:z.enum(['pending','in_progress','success','failed']),partsBrand:z.object({id:z.string().optional(),name:z.string().optional()}).optional(),list:z.array(part).optional().default([])}).parse(d);}
export async function partsIndexResults(carId:string){return parsePartsIndexResults(await partsIndexRequest('/v1/parts-by-vin/cars/'+encodeURIComponent(carId)+'/results?timeout=15000&lang=ru'));}
