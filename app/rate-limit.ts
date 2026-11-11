import {storage} from '@/db/storage';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {mutationGuard} from '@/app/mutation-security';
const publicRoutes=new Set(['/api/analyze','/api/vehicle','/api/vehicle-image','/api/vin-photos','/api/web-parts','/api/stations','/api/station-routes','/api/oem-catalog','/api/parts-index','/api/station-reviews','/api/shared-car/[token]']);
export async function rateSubject(value:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),n=>n.toString(16).padStart(2,'0')).join('');}
export function budgetPolicy(route:string,method:string){
 const write=!['GET','HEAD'].includes(method);
 if(route==='/api/account-data'&&write)return {scope:'erasure',limit:30};
 if(['/api/documents','/api/vehicle-photos'].includes(route)&&method==='POST')return {scope:'uploads',limit:30};
 // Costly/public integrations get independent, conservative distributed budgets.
 // D1-backed consumeBudget makes these limits consistent across Worker instances.
 const externalLimits:Record<string,number>={'/api/analyze':12,'/api/vehicle':20,'/api/vin-photos':12,'/api/vehicle-image':24,'/api/web-parts':12,'/api/stations':12,'/api/station-routes':30,'/api/station-reviews':20,'/api/oem-catalog':30,'/api/parts-index':30,'/api/shared-car/[token]':120};
 if(route in externalLimits)return {scope:'external:'+route.slice('/api/'.length),limit:externalLimits[route]};
 if(publicRoutes.has(route)&&route!=='/api/station-reviews'&&!route.startsWith('/api/shared-car/'))return {scope:'external',limit:60};
 return {scope:write?'writes':'reads',limit:write?300:600};
}
export async function consumeBudget(db:D1Database,subject:string,scope:string,limit:number,now=Date.now()){
 const window=Math.floor(now/60000),expires=(window+2)*60000;
 const row=await db.prepare('INSERT INTO api_rate_limits(subject,scope,window,calls,expires) VALUES(?,?,?,1,?) ON CONFLICT(subject,scope) DO UPDATE SET window=excluded.window,calls=CASE WHEN api_rate_limits.window<excluded.window THEN 1 ELSE api_rate_limits.calls+1 END,expires=excluded.expires WHERE api_rate_limits.window<excluded.window OR (api_rate_limits.window=excluded.window AND api_rate_limits.calls<?) RETURNING calls').bind(subject,scope,window,expires,limit).first<{calls:number}>();
 if(row?.calls===1)await db.prepare('DELETE FROM api_rate_limits WHERE rowid IN (SELECT rowid FROM api_rate_limits WHERE expires<? LIMIT 100)').bind(now).run();
 return {allowed:!!row,retryAfter:Math.max(1,Math.ceil(((window+1)*60000-now)/1000))};
}
// Called by the common API boundary before reading bodies or doing external work.
export async function apiRateGuard(request:Request,route:string):Promise<Response|null>{
 if(route==='/api/health'||route==='/api/registry-import')return null;
 const user=await getChatGPTUser();
 // Let private routes return their ordinary 401 without consuming a D1 query.
 if(!user&&!publicRoutes.has(route))return null;
 if(!['GET','HEAD'].includes(request.method)){
  const denied=mutationGuard(request,{format:route==='/api/documents'||route==='/api/vehicle-photos'&&request.headers.get('content-type')?.startsWith('multipart/')?'multipart':'json'});
  if(denied)return denied;
 }
 // Cloudflare supplies CF-Connecting-IP at its edge. Never use X-Forwarded-For.
 // Missing edge metadata gets one shared anonymous bucket, not an unlimited bypass.
 const edge=request.headers.get('cf-connecting-ip');
 const identity=user?'owner:'+user.userId:'anonymous:'+(edge&&/^[\da-fA-F:.]{3,64}$/.test(edge)?edge:'shared');
 const subject=await rateSubject(identity),policy=budgetPolicy(route,request.method);
 try{const {db}=await storage();const result=await consumeBudget(db,subject,policy.scope,policy.limit);if(result.allowed)return null;
  return Response.json({code:'RATE_LIMITED',message:'Забагато запитів. Спробуйте трохи пізніше.'},{status:429,headers:{'Retry-After':String(result.retryAfter),'Cache-Control':'private, no-store','RateLimit-Limit':String(policy.limit),'RateLimit-Reset':String(result.retryAfter)}});
 }catch{return Response.json({code:'RATE_LIMIT_UNAVAILABLE',message:'Перевірка доступу тимчасово недоступна. Повторіть спробу.'},{status:503});}
}
