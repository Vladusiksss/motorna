import {z} from 'zod';
import {analyzeConversation} from '@/app/diagnostic-conversation';
export const dynamic='force-dynamic';
const input=z.object({vehicle:z.string().min(2).max(200),symptoms:z.string().trim().min(2).max(1000),history:z.array(z.object({role:z.enum(['user','assistant']),content:z.string().min(1).max(2000)})).max(20).default([]),questionId:z.string().max(40).optional()});
export async function POST(request:Request){
 const headers={'Cache-Control':'no-store'};
 if(request.headers.get('sec-fetch-site')==='cross-site')return Response.json({error:'Недозволений запит'},{status:403,headers});
 try{const raw=await request.text();if(raw.length>32000)throw Error();const data=input.parse(JSON.parse(raw));return Response.json(analyzeConversation(data),{headers});}
 catch{return Response.json({error:'Опишіть, що змінилося в роботі авто.'},{status:400,headers});}
}
