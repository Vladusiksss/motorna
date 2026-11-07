import {storage} from '@/db/storage';
import {schemas} from '../validation';
import {vehicleAppearance} from '../vehicle-appearance';
import {photoSchema,providerStatusSchema,type VehiclePhoto,type Gallery,type VehicleIdentity} from './contracts';
import type {ProviderStatus} from './contracts';

export class PhotoError extends Error{status:number;code:string;constructor(message:string,status=400,code='INVALID_REQUEST'){super(message);this.status=status;this.code=code;}}
export async function ownedVehicle(owner:string,carId:string):Promise<VehicleIdentity>{
 const {db}=await storage();const car=await db.prepare("SELECT payload FROM records WHERE owner=? AND id=? AND kind='car'").bind(owner,carId).first<{payload:string}>();
 if(!car)throw new PhotoError('Автомобіль не знайдено.',404,'NOT_FOUND');const data=schemas.car.parse(JSON.parse(car.payload));
 if(!data.vin)throw new PhotoError('Додайте VIN автомобіля.');const a=vehicleAppearance(data.specifications);
 return {vin:data.vin,make:data.make||'',model:data.model||'',year:String(data.year),body:a.knownBody?a.body:'',color:a.color};
}
export async function collectPhotoObjects(){
 const {db,bucket}=await storage();const rows=await db.prepare('SELECT object_key FROM vehicle_photo_gc WHERE not_before < ? AND NOT EXISTS(SELECT 1 FROM vehicle_photos WHERE vehicle_photos.object_key=vehicle_photo_gc.object_key) LIMIT 30').bind(Date.now()).all<{object_key:string}>();
 for(const row of rows.results){if(!bucket)break;await bucket.delete(row.object_key);await db.prepare('DELETE FROM vehicle_photo_gc WHERE object_key=?').bind(row.object_key).run();}
 await db.prepare("DELETE FROM vehicle_photo_budget WHERE day < date('now','-2 days')").run();
 await db.prepare('DELETE FROM vehicle_photos WHERE expires < ? AND object_key IS NULL').bind(Date.now()).run();
}
// Call from an authenticated account-deletion transaction before removing its
// records. Current Motorna has no account-deletion API; do not expose one here.
export async function removeOwnerPhotoData(owner:string){
 const {db}=await storage();
 await db.prepare('INSERT OR IGNORE INTO vehicle_photo_gc(object_key) SELECT object_key FROM vehicle_photos WHERE owner=? AND object_key IS NOT NULL').bind(owner).run();
 await db.prepare('DELETE FROM vehicle_photo_search WHERE owner=?').bind(owner).run();
 await db.prepare('DELETE FROM vehicle_photos WHERE owner=?').bind(owner).run();
 await collectPhotoObjects();
}
export async function gallery(owner:string,carId:string):Promise<Gallery>{
 const v=await ownedVehicle(owner,carId),{db}=await storage();
 const row=await db.prepare('SELECT * FROM vehicle_photo_search WHERE owner=? AND car_id=? AND vin=?').bind(owner,carId,v.vin).first<{status:Gallery['status'];lease_until:number;providers:string;primary_id:string|null;hide_external:number;checked:number;retry_at:number}>();
 const found=await db.prepare('SELECT payload FROM vehicle_photos WHERE owner=? AND car_id=? AND vin=? AND expires>? ORDER BY object_key IS NOT NULL DESC,id LIMIT 60').bind(owner,carId,v.vin,Date.now()).all<{payload:string}>();
 const photos=found.results.flatMap(r=>{const p=photoSchema.safeParse(JSON.parse(r.payload));if(!p.success)return [];const safe=photoSchema.omit({objectKey:true}).parse(p.data);return [{...safe,url:safe.owned?`/api/vehicle-photos?carId=${carId}&photoId=${safe.id}`:safe.url}];});
 const providers=providerStatusSchema.array().parse(JSON.parse(row?.providers||'[]'));
 const status=row?.status==='running'&&row.lease_until<Date.now()?'failed':row?.status||'idle';
 return {carId,vin:v.vin,status,photos:row?.hide_external?photos.filter(p=>p.owned):photos,providers,primaryId:photos.some(p=>p.id===row?.primary_id)?row!.primary_id:null,hideExternal:!!row?.hide_external,checkedAt:row?.checked||0,retryAt:row?.retry_at||0};
}
export async function reserveBudget(scope:string,limit:number){
 const {db}=await storage(),day=new Date().toISOString().slice(0,10);
 const r=await db.prepare('INSERT INTO vehicle_photo_budget(scope,day,calls) VALUES(?,?,1) ON CONFLICT(scope,day) DO UPDATE SET calls=calls+1 WHERE calls < ?').bind(scope,day,Math.max(1,limit)).run();return r.meta.changes>0;
}
export async function savePhoto(owner:string,carId:string,vin:string,p:VehiclePhoto,lease?:string){
 const {db}=await storage();
 const sql="INSERT INTO vehicle_photos(id,owner,car_id,vin,dedupe_key,payload,object_key,expires) SELECT ?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM records WHERE owner=? AND id=? AND kind='car' AND json_extract(payload,'$.vin')=?)"+(p.owned?' AND ((SELECT COUNT(*) FROM vehicle_photos WHERE owner=? AND car_id=? AND object_key IS NOT NULL)<20 OR EXISTS(SELECT 1 FROM vehicle_photos WHERE owner=? AND car_id=? AND dedupe_key=?))':'')+(lease?' AND EXISTS(SELECT 1 FROM vehicle_photo_search WHERE owner=? AND car_id=? AND lease=?)':'')+(p.owned?' ON CONFLICT(owner,car_id,dedupe_key) DO NOTHING':' ON CONFLICT(owner,car_id,dedupe_key) DO UPDATE SET expires=excluded.expires,payload=json_set(excluded.payload,\'$.id\',vehicle_photos.id)');
 const r=await db.prepare(sql).bind(p.id,owner,carId,vin,p.url,JSON.stringify(p),p.objectKey||null,p.expiresAt,owner,carId,vin,...(p.owned?[owner,carId,owner,carId,p.url]:[]),...(lease?[owner,carId,lease]:[])).run();
 return r.meta.changes>0;
}
export async function finishJob(owner:string,carId:string,lease:string,providers:ProviderStatus[]){
 const {db}=await storage(),now=Date.now();const good=providers.some(p=>p.status==='ok'||p.status==='no_match'),bad=providers.some(p=>['unavailable','timeout','invalid_response','unauthorized','rate_limited','budget_exhausted','conflict'].includes(p.status));
 await db.prepare('UPDATE vehicle_photo_search SET status=?,providers=?,checked=?,retry_at=?,lease_until=0 WHERE owner=? AND car_id=? AND lease=?').bind(bad?(good?'partial':'failed'):'complete',JSON.stringify(providers),now,now+(bad?60000:providers.some(p=>p.count>0)?3600000:900000),owner,carId,lease).run();
}
