import {z} from 'zod';

export const vinSchema=z.string().trim().toUpperCase().regex(/^[A-HJ-NPR-Z0-9]{17}$/);
export const matchSchema=z.enum(['EXACT_VIN_MATCH','MODEL_MATCH','CONFLICT','NO_MATCH']);
export type Match=z.infer<typeof matchSchema>;
export function matchVehicle(requested:string,sourceVin?:string,modelMatches=false):Match{
 if(sourceVin)return vinSchema.safeParse(sourceVin).success&&sourceVin.toUpperCase()===requested.toUpperCase()?'EXACT_VIN_MATCH':'CONFLICT';
 return modelMatches?'MODEL_MATCH':'NO_MATCH';
}
export const photoSchema=z.object({
 id:z.string().uuid(),provider:z.string(),url:z.string(),source:z.string(),title:z.string(),
 match:matchSchema,sourceVin:z.string().optional(),evidence:z.string(),
 author:z.string().optional(),license:z.string(),licenseUrl:z.string().optional(),
 listingId:z.string().optional(),publishedAt:z.string().optional(),note:z.string().optional(),checkedAt:z.number(),expiresAt:z.number(),
 owned:z.boolean(),mime:z.enum(['image/jpeg','image/png']).optional(),objectKey:z.string().optional(),
});
export type VehiclePhoto=z.infer<typeof photoSchema>;
export const providerStatusSchema=z.object({provider:z.string(),status:z.enum(['ok','no_match','disabled','missing_key','license_required','agreement_required','unauthorized','rate_limited','timeout','unavailable','invalid_response','conflict','budget_exhausted']),count:z.number(),checkedAt:z.number()});
export type ProviderStatus=z.infer<typeof providerStatusSchema>;
export const gallerySchema=z.object({carId:z.string().uuid(),vin:vinSchema,status:z.enum(['idle','running','complete','partial','failed']),photos:z.array(photoSchema.omit({objectKey:true})),providers:z.array(providerStatusSchema),primaryId:z.string().nullable(),hideExternal:z.boolean(),checkedAt:z.number(),retryAt:z.number()});
export type Gallery=z.infer<typeof gallerySchema>;
export type VehicleIdentity={vin:string;make:string;model:string;year:string;body:string;color:string};

// Never fetch these URLs on the server. HTTPS + a configured CDN allowlist also
// prevents provider responses from turning the browser gallery into a local-network probe.
export function safePhotoUrl(value:string,hosts:string[]):string|null{
 try{const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password||u.port||u.search||u.hash)return null;
 if(!hosts.some(h=>u.hostname===h||u.hostname.endsWith('.'+h)))return null;
 return u.href;}catch{return null;}
}
export function safeSource(value:string):string|null{
 try{const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password||u.port||!/[a-z][a-z0-9-]*\.[a-z]{2,}$/i.test(u.hostname)||/\.(local|internal|localhost)$/i.test(u.hostname))return null;return u.href;}catch{return null;}
}
export function dedupePhotos(photos:VehiclePhoto[]):VehiclePhoto[]{
 const seen=new Set<string>();return photos.filter(p=>{const key=p.url;if(seen.has(key))return false;seen.add(key);return true;});
}
