import {apiBoundary} from '@/app/api-response';
import {readJsonObject,jsonBodyFailure} from '@/app/json-body';
import {mutationGuard} from '@/app/mutation-security';
import {analyzeConversation,diagnosticQuerySchema as input} from '@/app/modules/diagnostics/service';
export const dynamic='force-dynamic';
export async function POST(request:Request){
 return apiBoundary(async()=>{

 const headers={'Cache-Control':'no-store'};
 const denied=mutationGuard(request);if(denied)return denied;
 try{const bodyJson=await readJsonObject(request,32000);const data=input.parse(bodyJson);return Response.json(analyzeConversation(data),{headers});}
 catch(error){const rejected=jsonBodyFailure(error);if(rejected)return rejected;return Response.json({error:'Опишіть, що змінилося в роботі авто.'},{status:400,headers});}

 },"/api/analyze",request);
}
