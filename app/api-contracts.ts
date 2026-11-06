import {z} from 'zod';
export const vehicleSchema=z.object({vin:z.string(),make:z.string(),model:z.string(),year:z.string(),engine:z.string(),fields:z.array(z.object({label:z.string(),value:z.string()})),warning:z.string(),source:z.string(),checkedAt:z.string(),needsConfirmation:z.boolean().optional()});
export const photoSchema=z.object({note:z.string().optional(),url:z.string().url(),source:z.string().url(),host:z.string().optional(),vin:z.string().optional(),author:z.string().optional(),license:z.string().optional(),title:z.string()});
export const photosSchema=z.object({photos:z.array(photoSchema)});
export const causeSchema=z.object({title:z.string(),explanation:z.string(),check:z.string(),condition:z.string(),evidence:z.string(),parts:z.array(z.string())});
export const analysisSchema=z.object({causes:z.array(causeSchema),questions:z.array(z.string()).default([]),questionId:z.string().default(''),choices:z.array(z.string()).default([]),note:z.string()});
export const linkSchema=z.object({title:z.string(),url:z.string().url(),host:z.string(),price:z.number().positive().optional(),currency:z.string().optional(),availability:z.string().optional(),brand:z.string().optional(),catalogNumbers:z.array(z.string()).optional(),dataMode:z.enum(['live','demo']).optional(),numberMatch:z.boolean().optional(),checkedAt:z.string().optional(),part:z.string().optional(),fitment:z.object({status:z.string(),reason:z.string()}).optional()});
export const catalogPartSchema=z.object({name:z.string(),number:z.string(),description:z.string().optional(),notice:z.string().optional()});
export const catalogSchema=z.object({session:z.string(),title:z.string().optional(),vehicles:z.array(z.object({name:z.string(),parameters:z.array(z.object({value:z.string()})).optional()})).optional(),groups:z.array(z.object({name:z.string()})).optional(),parts:z.array(catalogPartSchema).optional(),pending:z.boolean().optional(),notice:z.string().optional()});
export const addressSchema=z.object({lat:z.number(),lon:z.number(),precision:z.string(),label:z.string()});
export const stationSchema=z.object({id:z.string(),name:z.string(),lat:z.number(),lon:z.number(),distance:z.number(),address:z.string(),sourceUrl:z.string(),checkedAt:z.string(),locationPrecision:z.enum(['point','area-center']),phones:z.array(z.string()),hours:z.string(),maps:z.string(),waze:z.string(),roadDistance:z.number().nullable().optional(),minutes:z.number().nullable().optional()});
export const summarySchema=z.object({station:z.string(),count:z.number().int().nonnegative(),rating:z.number().min(0).max(5),positive:z.number().int().nonnegative()});
export const reviewSchema=z.object({author:z.string(),rating:z.number().int().min(1).max(5),text:z.string(),updatedAt:z.string().datetime()});
export const apiErrorSchema=z.object({code:z.string().regex(/^[A-Z][A-Z0-9_]{1,63}$/),message:z.string().trim().min(1).max(1000),requestId:z.string().uuid()});
export class ApiError extends Error {
 readonly code:string;readonly requestId:string;readonly status:number;
 constructor(message:string,code:string,requestId:string,status:number){super(message);this.name='ApiError';this.code=code;this.requestId=requestId;this.status=status;}
}
export function apiFailure(value:unknown,status:number,headerId?:string|null):ApiError {
 const parsed=apiErrorSchema.safeParse(value);if(parsed.success)return new ApiError(parsed.data.message,parsed.data.code,parsed.data.requestId,status);
 // Read compatibility for an older cached site version and external/test responses only.
 const legacy=z.object({error:z.string().trim().min(1).max(1000)}).safeParse(value);
 const requestId=z.string().uuid().safeParse(headerId);
 return new ApiError(legacy.success?legacy.data.error:'Сервіс повернув неочікувану відповідь.','UNEXPECTED_RESPONSE',requestId.success?requestId.data:'',status);
}
export async function readApi(response:Response):Promise<unknown>{
 let value:unknown;try{value=await response.json();}catch{throw apiFailure(null,response.status,response.headers.get('X-Request-Id'));}
 if(!response.ok)throw apiFailure(value,response.status,response.headers.get('X-Request-Id'));
 return value;
}
