import {storage} from '@/db/storage';
import {cleanIdentifier,mapVehicle,type VehicleInfo} from './vehicle-search';
import {validateVpicResult,internationalResult,VpicError} from './vpic-validation';
import {lookupMvs} from './mvs-lookup';
import {enrichFreeVin} from './free-vin';
export {VpicError};
const ttl=7*24*60*60*1000;
const pending=new Map<string,Promise<VehicleInfo>>();
async function cacheDb(){const {db}=await storage();await db.prepare('CREATE TABLE IF NOT EXISTS vin_decode_cache_world_v3 (vin TEXT PRIMARY KEY, payload TEXT NOT NULL, expires_at INTEGER NOT NULL)').run();return db;}
export async function decodeVpic(input:string):Promise<VehicleInfo>{
 const vin=cleanIdentifier(input);
 if(!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin))throw new VpicError('VIN має містити 17 латинських літер і цифр без I, O та Q.',400);
 if(/^[1-5]/.test(vin)){const alphabet='0123456789.ABCDEFGH..JKLMN.P.R..STUVWXYZ';const values=[0,1,2,3,4,5,6,7,8,9,0,1,2,3,4,5,6,7,8,0,0,1,2,3,4,5,0,7,0,9,0,0,2,3,4,5,6,7,8,9];const weights=[8,7,6,5,4,3,2,10,0,9,8,7,6,5,4,3,2];const sum=[...vin].reduce((total,c,i)=>total+values[alphabet.indexOf(c)]*weights[i],0)%11;if(vin[8]!==String(sum===10?'X':sum))throw new VpicError('Контрольний символ VIN не збігається. Перевірте введений код.',400);}
 const active=pending.get(vin);if(active)return active;
 const operation=(async()=>{
  const registered=await lookupMvs(vin);if(registered)return registered;
  try{const db=await cacheDb();const cached=await db.prepare('SELECT payload, expires_at FROM vin_decode_cache_world_v3 WHERE vin = ? AND expires_at > ?').bind(vin,Date.now()).first();if(cached){const vehicle=JSON.parse(String(cached.payload)) as VehicleInfo;if(vehicle.vin===vin&&Array.isArray(vehicle.fields))return vehicle;}}catch{/* Cache failure does not prevent decoding. */}
  let raw:Record<string,string>;
  try{const response=await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValuesExtended/${vin}?format=json`,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(18000)});if(!response.ok)throw new VpicError('Сервіс перевірки VIN тимчасово недоступний. Спробуйте ще раз.',503);const body=await response.json() as {Results?:unknown[]};raw=validateVpicResult(body.Results?.[0]);}catch(e){if(e instanceof VpicError)throw e;throw new VpicError('Не вдалося зв’язатися із сервісом VIN. Повторіть спробу.',503);}
  const vehicle=await enrichFreeVin(mapVehicle(internationalResult(raw,vin),vin));
  try{const db=await cacheDb();await db.prepare('INSERT INTO vin_decode_cache_world_v3 (vin,payload,expires_at) VALUES (?,?,?) ON CONFLICT(vin) DO UPDATE SET payload=excluded.payload,expires_at=excluded.expires_at').bind(vin,JSON.stringify(vehicle),Date.now()+ttl).run();}catch{/* Upstream results remain usable without cache. */}
  return vehicle;
 })();pending.set(vin,operation);try{return await operation;}finally{pending.delete(vin);}
}
