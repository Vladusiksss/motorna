import {apiBoundary} from '@/app/api-response';
import {storage} from '@/db/storage';
export const dynamic='force-dynamic';
let cached:{at:number;body:{status:string;checks:{database:string;files:string};checkedAt:string}}|undefined;
async function bounded(check:()=>Promise<unknown>){let timer:ReturnType<typeof setTimeout>|undefined;try{await Promise.race([check(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('timeout')),3000);})]);return 'ok';}catch{return 'unavailable';}finally{if(timer)clearTimeout(timer);}}
export async function GET(){
 return apiBoundary(async()=>{

 if(!cached||Date.now()-cached.at>15000){
  const checks={database:'unavailable',files:'unavailable'};
  try{const {db,bucket}=await storage();[checks.database,checks.files]=await Promise.all([bounded(()=>db.prepare('SELECT id FROM records LIMIT 0').all()),bounded(async()=>{if(!bucket)throw new Error();await bucket.get('_health/00000000-0000-4000-8000-000000000000');})]);}catch{/* Return no connection details or user data. */}
  cached={at:Date.now(),body:{status:Object.values(checks).every(v=>v==='ok')?'ok':'degraded',checks,checkedAt:new Date().toISOString()}};
 }
 return Response.json(cached.body.status==='ok'?cached.body:{error:'Частина сервісів тимчасово недоступна.',code:'HEALTH_DEGRADED',details:cached.body},{status:cached.body.status==='ok'?200:503,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});

 },"/api/health");
}
