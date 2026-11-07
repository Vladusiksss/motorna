import {apiBoundary,dataConstraintFailure} from '@/app/api-response';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {mutationGuard} from '@/app/mutation-security';
import {readJsonObject,jsonBodyFailure} from '@/app/json-body';
import {boundedUpload,UploadError} from '@/app/document-upload';
import {z} from 'zod';
import {storage} from '@/db/storage';
import {gallery,ownedVehicle,savePhoto,PhotoError,collectPhotoObjects,reserveBudget} from '@/app/vehicle-intelligence/store';
import {startPhotos} from '@/app/vehicle-intelligence/service';
import {verifyPhoto} from '@/app/vehicle-intelligence/upload';
import {photoSchema,type VehiclePhoto} from '@/app/vehicle-intelligence/contracts';
export const dynamic='force-dynamic';
const idSchema=z.string().uuid();
const fail=(error:unknown)=>{const body=jsonBodyFailure(error);if(body)return body;if(error instanceof PhotoError||error instanceof UploadError)return Response.json({error:error.message,code:error instanceof PhotoError?error.code:'INVALID_UPLOAD'},{status:error.status});if(error instanceof z.ZodError)return Response.json({error:'Перевірте параметри запиту.'},{status:400});throw error;};
export async function GET(request:Request){
 return apiBoundary(async()=>{
  const user=await getChatGPTUser();if(!user)return Response.json({error:'Увійдіть, щоб переглянути фото.'},{status:401});
  try{const query=new URL(request.url).searchParams,carId=idSchema.parse(query.get('carId'));await ownedVehicle(user.userId,carId);
   if(query.has('photoId')){
    const photoId=idSchema.parse(query.get('photoId')),{db,bucket}=await storage();
    const row=await db.prepare('SELECT payload FROM vehicle_photos WHERE id=? AND owner=? AND car_id=? AND object_key IS NOT NULL').bind(photoId,user.userId,carId).first<{payload:string}>();
    if(!row)throw new PhotoError('Фото не знайдено.',404,'NOT_FOUND');const p=photoSchema.parse(JSON.parse(row.payload));if(!bucket)throw new PhotoError('Сховище тимчасово недоступне.',503,'STORAGE_UNAVAILABLE');const object=await bucket.get(p.objectKey!);
    if(!object)throw new PhotoError('Фото не знайдено.',404,'NOT_FOUND');
    return new Response(object.body,{headers:{'Content-Type':p.mime!,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Cross-Origin-Resource-Policy':'same-origin','Content-Security-Policy':"default-src 'none'; sandbox"}});
   }
   return Response.json(await gallery(user.userId,carId));
  }catch(e){const constraint=dataConstraintFailure(e);if(constraint)return constraint;return fail(e);}
 },'/api/vehicle-photos');
}
export async function POST(request:Request){
 return apiBoundary(async()=>{
  const user=await getChatGPTUser();if(!user)return Response.json({error:'Увійдіть для збереження фото.'},{status:401});
  const multipart=request.headers.get('content-type')?.startsWith('multipart/form-data');const denied=mutationGuard(request,{format:multipart?'multipart':'json'});if(denied)return denied;
  try{
   if(!multipart){const body=z.object({carId:idSchema,refresh:z.boolean().optional()}).strict().parse(await readJsonObject(request,1000));await startPhotos(user.userId,body.carId,body.refresh);return Response.json(await gallery(user.userId,body.carId),{status:202});}
   if(!await reserveBudget('upload:'+user.userId,50))throw new PhotoError('Денний ліміт завантажень вичерпано.',429,'PHOTO_RATE_LIMIT');
   const bytes=await boundedUpload(request),form=await new Request(request.url,{method:'POST',headers:{'Content-Type':request.headers.get('content-type')!},body:bytes}).formData();
   const carId=idSchema.parse(form.get('carId')),v=await ownedVehicle(user.userId,carId),file=form.get('file');
   if(form.get('rightsConfirmed')!=='true'||!(file instanceof File))throw new PhotoError('Підтвердьте право на завантаження фото.');
   const image=await file.arrayBuffer();verifyPhoto(image,file.type);
   const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',image)),n=>n.toString(16).padStart(2,'0')).join(''),{db,bucket}=await storage();
   const duplicate=await db.prepare('SELECT id FROM vehicle_photos WHERE owner=? AND car_id=? AND dedupe_key=?').bind(user.userId,carId,'upload:'+digest).first();
   if(!duplicate){
    const count=await db.prepare('SELECT COUNT(*) AS n FROM vehicle_photos WHERE owner=? AND car_id=? AND object_key IS NOT NULL').bind(user.userId,carId).first<{n:number}>();
    if((count?.n||0)>=20)throw new PhotoError('До 20 власних фото на автомобіль.',429,'PHOTO_LIMIT');
    if(!bucket)throw new PhotoError('Сховище тимчасово недоступне.',503,'STORAGE_UNAVAILABLE');
    const id=crypto.randomUUID(),key=user.userId+'/'+id;
    const p:VehiclePhoto={id,provider:'owner',url:'upload:'+digest,source:'',title:'Моє фото',match:'NO_MATCH',evidence:'owner_upload_not_vin_proof',license:'Приватне фото власника',checkedAt:Date.now(),expiresAt:8640000000000000,owned:true,mime:file.type as 'image/jpeg'|'image/png',objectKey:key};
    await db.prepare('INSERT OR IGNORE INTO vehicle_photo_gc(object_key,not_before) VALUES(?,?)').bind(key,Date.now()+60000).run();
    await bucket.put(key,image,{httpMetadata:{contentType:file.type}});
    try{if(!await savePhoto(user.userId,carId,v.vin,p)){await bucket.delete(key);await ownedVehicle(user.userId,carId);return Response.json(await gallery(user.userId,carId),{status:201});}}catch(e){await bucket.delete(key);throw e;}
    await db.prepare('DELETE FROM vehicle_photo_gc WHERE object_key=? AND EXISTS(SELECT 1 FROM vehicle_photos WHERE object_key=? AND owner=? AND car_id=?)').bind(key,key,user.userId,carId).run();
   }
   return Response.json(await gallery(user.userId,carId),{status:201});
  }catch(e){const constraint=dataConstraintFailure(e);if(constraint)return constraint;return fail(e);}
 },'/api/vehicle-photos');
}
export async function PATCH(request:Request){
 return apiBoundary(async()=>{
  const user=await getChatGPTUser();if(!user)return Response.json({error:'Потрібен вхід.'},{status:401});const denied=mutationGuard(request);if(denied)return denied;
  try{const body=z.object({carId:idSchema,primaryId:idSchema.nullable().optional(),hideExternal:z.boolean().optional()}).strict().parse(await readJsonObject(request,1000)),v=await ownedVehicle(user.userId,body.carId),{db}=await storage();
   if(body.primaryId){const p=await db.prepare('SELECT id FROM vehicle_photos WHERE id=? AND owner=? AND car_id=? AND vin=? AND expires>?').bind(body.primaryId,user.userId,body.carId,v.vin,Date.now()).first();if(!p)throw new PhotoError('Фото недоступне.',404,'NOT_FOUND');}
   await db.prepare("INSERT INTO vehicle_photo_search(owner,car_id,vin) SELECT ?,?,? WHERE EXISTS(SELECT 1 FROM records WHERE owner=? AND id=? AND kind='car' AND json_extract(payload,'$.vin')=?) ON CONFLICT(owner,car_id) DO NOTHING").bind(user.userId,body.carId,v.vin,user.userId,body.carId,v.vin).run();
   if(body.primaryId!==undefined)await db.prepare('UPDATE vehicle_photo_search SET primary_id=? WHERE owner=? AND car_id=? AND vin=?').bind(body.primaryId,user.userId,body.carId,v.vin).run();
   if(body.hideExternal!==undefined)await db.prepare('UPDATE vehicle_photo_search SET hide_external=? WHERE owner=? AND car_id=? AND vin=?').bind(Number(body.hideExternal),user.userId,body.carId,v.vin).run();
   return Response.json(await gallery(user.userId,body.carId));
  }catch(e){const constraint=dataConstraintFailure(e);if(constraint)return constraint;return fail(e);}
 },'/api/vehicle-photos');
}
export async function DELETE(request:Request){
 return apiBoundary(async()=>{
  const user=await getChatGPTUser();if(!user)return Response.json({error:'Потрібен вхід.'},{status:401});const denied=mutationGuard(request);if(denied)return denied;
  try{const q=new URL(request.url).searchParams,carId=idSchema.parse(q.get('carId'));await ownedVehicle(user.userId,carId);const {db}=await storage();
   if(q.has('photoId')){const id=idSchema.parse(q.get('photoId'));await db.prepare('INSERT OR IGNORE INTO vehicle_photo_gc(object_key) SELECT object_key FROM vehicle_photos WHERE owner=? AND car_id=? AND id=? AND object_key IS NOT NULL').bind(user.userId,carId,id).run();await db.prepare('DELETE FROM vehicle_photos WHERE owner=? AND car_id=? AND id=?').bind(user.userId,carId,id).run();await db.prepare('UPDATE vehicle_photo_search SET primary_id=NULL WHERE owner=? AND car_id=? AND primary_id=?').bind(user.userId,carId,id).run();}
   else{
    // Cancel the lease before deletion, so a running provider cannot repopulate.
    await db.prepare("UPDATE vehicle_photo_search SET lease=NULL,lease_until=0,status='idle',primary_id=NULL,providers='[]',checked=0,retry_at=? WHERE owner=? AND car_id=?").bind(Date.now()+60000,user.userId,carId).run();
    await db.prepare('DELETE FROM vehicle_photos WHERE owner=? AND car_id=? AND object_key IS NULL').bind(user.userId,carId).run();
   }
   await collectPhotoObjects();return Response.json(await gallery(user.userId,carId));
  }catch(e){const constraint=dataConstraintFailure(e);if(constraint)return constraint;return fail(e);}
 },'/api/vehicle-photos');
}
