import {getChatGPTUser} from '@/app/chatgpt-auth';
import {storage} from '@/db/storage';
import {schemas} from '@/app/validation';
import {purchaseText} from '@/app/purchase-model';
export const dynamic='force-dynamic';
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
 const user=await getChatGPTUser();if(!user)return new Response('Потрібен вхід.',{status:401});
 const {id}=await params;if(!/^[a-f0-9-]{36}$/.test(id))return new Response(null,{status:400});
 try{
  const {db}=await storage();const row=await db.prepare("SELECT payload FROM records WHERE id=? AND owner=? AND kind='purchaseRequest'").bind(id,user.userId).first();
  if(!row)return new Response(null,{status:404});
  const raw=JSON.parse(String(row.payload)),data=schemas.purchaseRequest.parse(raw);
  const text=purchaseText({...data,vehicle:String(raw.vehicle||''),vin:String(raw.vin||'')});
  return new Response('\uFEFF'+text,{headers:{'Content-Type':'text/plain; charset=utf-8','Content-Disposition':`attachment; filename="motorna-request-${id}.txt"`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
 }catch{return new Response('Не вдалося сформувати файл.',{status:503});}
}
