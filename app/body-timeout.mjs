export class BodyTimeoutError extends Error{constructor(){super('Request body timed out');}}
// One deadline for the whole body, not a fresh timeout for each byte/chunk.
/** @param {ReadableStreamDefaultReader<Uint8Array>} reader @param {number} [milliseconds] */
export function streamDeadline(reader,milliseconds=15000){
 if(!Number.isInteger(milliseconds)||milliseconds<1||milliseconds>60000)throw new RangeError('Invalid body deadline');
 /** @type {ReturnType<typeof setTimeout>} */
 let timer;
 /** @type {Promise<never>} */
 const expired=new Promise((_,reject)=>{timer=setTimeout(()=>{reject(new BodyTimeoutError());void reader.cancel().catch(()=>{});},milliseconds);});
 return {read:()=>Promise.race([reader.read(),expired]),dispose:()=>clearTimeout(timer)};
}
