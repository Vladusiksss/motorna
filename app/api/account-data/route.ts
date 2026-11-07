import {apiBoundary} from '@/app/api-response';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {mutationGuard} from '@/app/mutation-security';
import {readJsonObject,jsonBodyFailure} from '@/app/json-body';
import {erasureStatus,eraseUserData,ERASURE_CONFIRMATION} from '@/app/data-erasure';
export const dynamic='force-dynamic';
export async function GET(){
 return apiBoundary(async()=>{
  const user=await getChatGPTUser();if(!user)return Response.json({error:'Потрібен вхід.'},{status:401});
  return Response.json(await erasureStatus(user.userId),{headers:{'Cache-Control':'private, no-store'}});
 },'/api/account-data');
}
export async function DELETE(request:Request){
 return apiBoundary(async()=>{
  const user=await getChatGPTUser();if(!user)return Response.json({error:'Потрібен вхід.'},{status:401});const denied=mutationGuard(request);if(denied)return denied;
  try{const body=await readJsonObject(request,500);if(Object.keys(body).length!==1||body.confirmation!==ERASURE_CONFIRMATION)return Response.json({error:'Введіть фразу підтвердження.'},{status:400});
   const result=await eraseUserData(user.userId);return Response.json(result,{status:result.state==='complete'?200:202,headers:{'Cache-Control':'private, no-store','Retry-After':'2'}});
  }catch(e){const failure=jsonBodyFailure(e);if(failure)return failure;throw e;}
 },'/api/account-data');
}
