import {storage} from '@/db/storage';
import {cleanIdentifier,mapVehicle,type VehicleInfo} from './vehicle-search';
import {validateVpicResult,VpicError} from './vpic-validation';
export {VpicError};
const ttl=7*24*60*60*1000;
const pending=new Map<string,Promise<VehicleInfo>>();
async function cacheDb(){const {db}=await storage();await db.prepare('CREATE TABLE IF NOT EXISTS vin_decode_cache (vin TEXT PRIMARY KEY, payload TEXT NOT NULL, expires_at INTEGER NOT NULL)').run();return db;}
export async function decodeVpic(input:string):Promise<VehicleInfo>{
 const vin=cleanIdentifier(input);
 if(!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin))throw new VpicError('VIN має містити 17 латинських літер і цифр без I, O та Q.',400);
 const active=pending.get(vin);if(active)return active;
 const operation=(async()=>{
  try{const db=await cacheDb();const cached=await db.prepare('SELECT payload, expires_at FROM vin_decode_cache WHERE vin = ? AND expires_at > ?').bind(vin,Date.now()).first();if(cached){const raw=validateVpicResult(JSON.parse(String(cached.payload)));return {...mapVehicle(raw,vin),checkedAt:new Date(Number(cached.expires_at)-ttl).toISOString()};}}catch{/* Cache failure does not prevent decoding. */}
  let raw:Record<string,string>;
  try{const response=await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValuesExtended/${vin}?format=json`,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(18000)});if(!response.ok)throw new VpicError('Сервіс перевірки VIN тимчасово недоступний. Спробуйте ще раз.',503);const body=await response.json() as {Results?:unknown[]};raw=validateVpicResult(body.Results?.[0]);}catch(e){if(e instanceof VpicError)throw e;throw new VpicError('Не вдалося зв’язатися із сервісом VIN. Повторіть спробу.',503);}
  try{const db=await cacheDb();await db.prepare('INSERT INTO vin_decode_cache (vin,payload,expires_at) VALUES (?,?,?) ON CONFLICT(vin) DO UPDATE SET payload=excluded.payload,expires_at=excluded.expires_at').bind(vin,JSON.stringify(raw),Date.now()+ttl).run();}catch{/* Upstream results remain usable without cache. */}
  return mapVehicle(raw,vin);
 })();pending.set(vin,operation);try{return await operation;}finally{pending.delete(vin);}
}
