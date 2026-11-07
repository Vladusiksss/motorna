import {apiBoundary} from '@/app/api-response';
import {readJsonObject,jsonBodyFailure} from '@/app/json-body';
import {mutationGuard} from '@/app/mutation-security';
import {z} from 'zod';
import {analyzeConversation} from '@/app/diagnostic-conversation';
export const dynamic='force-dynamic';
const input=z.object({vehicle:z.string().min(2).max(200),symptoms:z.string().trim().min(2).max(1000),history:z.array(z.object({role:z.enum(['user','assistant']),content:z.string().min(1).max(2000)})).max(20).default([]),questionId:z.string().max(40).optional()});
export async function POST(request:Request){
 return apiBoundary(async()=>{

 const headers={'Cache-Control':'no-store'};
 const denied=mutationGuard(request);if(denied)return denied;
 try{const bodyJson=await readJsonObject(request,32000);const data=input.parse(bodyJson);return Response.json(analyzeConversation(data),{headers});}
 catch(error){const rejected=jsonBodyFailure(error);if(rejected)return rejected;return Response.json({error:'Опишіть, що змінилося в роботі авто.'},{status:400,headers});}

 },"/api/analyze",request);
}
