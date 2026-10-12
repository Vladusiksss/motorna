import {runtimeConfig} from '@/app/runtime-config';
import {storage} from '@/db/storage';
export const dynamic='force-dynamic';
export async function PUT(request:Request){
 const env=await runtimeConfig();
 if(!env.REGISTRY_IMPORT_TOKEN||request.headers.get('authorization')!=='Bearer '+env.REGISTRY_IMPORT_TOKEN)return new Response(null,{status:403});
 const shard=new URL(request.url).searchParams.get('shard');
 if(!shard||!/^[a-f0-9]{2}$/.test(shard))return new Response(null,{status:400});
 if(Number(request.headers.get('content-length'))>2*1024*1024)return new Response(null,{status:413});
 try{
  const reader=request.body?.getReader();if(!reader)return new Response(null,{status:400});
  const chunks:Uint8Array[]=[];let length=0;
  while(true){const {value,done}=await reader.read();if(done)break;length+=value.length;if(length>2*1024*1024){await reader.cancel();return new Response(null,{status:413});}chunks.push(value);}
  const data=new Uint8Array(length);let at=0;for(const chunk of chunks){data.set(chunk,at);at+=chunk.length;}
  if(data[0]!==31||data[1]!==139)return new Response(null,{status:400});
  const {bucket}=await storage();if(!bucket)throw Error('Storage unavailable');
  await bucket.put('vehicle-registry/mvs-v1/'+shard+'.gz',data,{httpMetadata:{contentType:'application/gzip'}});
  return Response.json({shard,bytes:length});
 }catch{return new Response(null,{status:503});}
}
