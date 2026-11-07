import {streamDeadline,BodyTimeoutError} from './body-timeout.mjs';
export class JsonBodyError extends Error {
 readonly status:400|408|413|415;
 constructor(message:string,status:400|408|413|415=400){super(message);this.status=status;this.name='JsonBodyError';}
}
export function jsonBodyFailure(error:unknown):Response|null {
 return error instanceof JsonBodyError?Response.json({error:error.message,code:error.status===408?'REQUEST_TIMEOUT':error.status===413?'JSON_BODY_TOO_LARGE':error.status===415?'UNSUPPORTED_CONTENT_ENCODING':'INVALID_JSON_BODY'},{status:error.status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}}):null;
}
// Limits are bytes on the actual stream. Content-Length is only an early rejection hint.
export async function readJsonObject(request:Request,maxBytes:number,timeoutMs=15000):Promise<Record<string,unknown>> {
 if(!Number.isSafeInteger(maxBytes)||maxBytes<1)throw new RangeError('Invalid JSON byte limit');
 const reject=(error:JsonBodyError):never=>{void request.body?.cancel().catch(()=>{});throw error;};
 const encoding=request.headers.get('content-encoding');
 if(encoding&&encoding.trim().toLowerCase()!=='identity')return reject(new JsonBodyError('Стиснені JSON-запити не підтримуються.',415));
 const declared=request.headers.get('content-length');
 if(declared!==null){
  if(!/^\d+$/.test(declared))return reject(new JsonBodyError('Некоректна довжина запиту.'));
  if(BigInt(declared)>BigInt(maxBytes))return reject(new JsonBodyError('Завеликий JSON-запит.',413));
 }
 const reader=request.body?.getReader();if(!reader)throw new JsonBodyError('Потрібен JSON-запит.');
 const deadline=streamDeadline(reader,timeoutMs);
 const cancel=()=>{void reader.cancel().catch(()=>{});};
 const aborted=()=>new JsonBodyError('Читання запиту перервано.');
 const decoder=new TextDecoder('utf-8',{fatal:true});let size=0,text='';
 request.signal.addEventListener('abort',cancel,{once:true});
 try {
  if(request.signal.aborted)throw aborted();
  while(true){
   const item=await deadline.read();if(request.signal.aborted)throw aborted();if(item.done)break;
   size+=item.value.byteLength;if(size>maxBytes)throw new JsonBodyError('Завеликий JSON-запит.',413);
   text+=decoder.decode(item.value,{stream:true});
  }
  text+=decoder.decode();const value:unknown=JSON.parse(text);
  if(!value||typeof value!=='object'||Array.isArray(value))throw new JsonBodyError('Потрібен JSON-об’єкт.');
  return value as Record<string,unknown>;
 }catch(error){cancel();throw error instanceof BodyTimeoutError?new JsonBodyError('Час читання запиту вичерпано.',408):error instanceof JsonBodyError?error:new JsonBodyError('Некоректний JSON-запит.');}
 finally{deadline.dispose();request.signal.removeEventListener('abort',cancel);reader.releaseLock();}
}
