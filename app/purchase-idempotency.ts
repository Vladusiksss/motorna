import {schemas} from './validation';
const keyPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function validPurchaseKey(key:string){return keyPattern.test(key);}
// Scoped to the authenticated owner; the records primary key arbitrates concurrent retries.
export async function purchaseRecordId(owner:string,key:string){
 if(!validPurchaseKey(key))throw new Error('Invalid request key');
 const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(['motorna-purchase-v1',owner,key.toLowerCase()])));
 const hex=Array.from(new Uint8Array(bytes),n=>n.toString(16).padStart(2,'0')).join('');
 return `${hex.slice(0,8)}-${hex.slice(8,12)}-4${hex.slice(13,16)}-8${hex.slice(17,20)}-${hex.slice(20,32)}`;
}
export function samePurchaseInput(a:unknown,b:unknown){
 const left=schemas.purchaseRequest.safeParse(a),right=schemas.purchaseRequest.safeParse(b);
 return left.success&&right.success&&JSON.stringify(left.data)===JSON.stringify(right.data);
}
