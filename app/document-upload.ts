export const MAX_DOCUMENT_BYTES=5*1024*1024;
const MAX_FORM_BYTES=6*1024*1024;
export class UploadError extends Error{status:number;constructor(message:string,status=400){super(message);this.status=status;}}
// Bound the actual stream, not just the untrusted Content-Length header.
export async function boundedUpload(request:Request):Promise<ArrayBuffer>{
 if(Number(request.headers.get('content-length'))>MAX_FORM_BYTES)throw new UploadError('Максимальний розмір — 5 МБ',413);
 const reader=request.body?.getReader();if(!reader)throw new UploadError('Додайте документ.');
 const chunks:Uint8Array[]=[];let size=0;
 try{while(true){const item=await reader.read();if(item.done)break;size+=item.value.byteLength;if(size>MAX_FORM_BYTES){await reader.cancel();throw new UploadError('Максимальний розмір — 5 МБ',413);}chunks.push(item.value);}}finally{reader.releaseLock();}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}return bytes.buffer;
}
export function verifyDocument(bytes:ArrayBuffer,mime:string){
 const data=new Uint8Array(bytes);
 if(!data.length||data.length>MAX_DOCUMENT_BYTES)throw new UploadError('Додайте PDF, JPG або PNG до 5 МБ');
 const starts=(signature:number[])=>signature.every((byte,i)=>data[i]===byte);
 const pdf=data.length>=12&&new TextDecoder().decode(data.subarray(0,8)).startsWith('%PDF-')&&/%%EOF\s*$/.test(new TextDecoder().decode(data.subarray(Math.max(0,data.length-1024))));
 const png=data.length>=45&&starts([137,80,78,71,13,10,26,10])&&new TextDecoder().decode(data.subarray(12,16))==='IHDR'&&new TextDecoder().decode(data.subarray(data.length-8,data.length-4))==='IEND';
 const jpeg=data.length>=4&&starts([255,216,255])&&data[data.length-2]===255&&data[data.length-1]===217;
 if(!(mime==='application/pdf'&&pdf||mime==='image/png'&&png||mime==='image/jpeg'&&jpeg))throw new UploadError('Вміст документа не відповідає PDF, JPG або PNG.');
 // This checks type/structure markers. It is not malware scanning or PDF sanitization.
}
