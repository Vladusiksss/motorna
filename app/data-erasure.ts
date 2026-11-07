import {rateSubject} from '@/app/rate-limit';
import {storage} from '@/db/storage';
export const ERASURE_CONFIRMATION='ВИДАЛИТИ МОЇ ДАНІ';
export async function erasureStatus(owner:string){
 const {db}=await storage();const row=await db.prepare('SELECT state,created,updated FROM user_data_erasure WHERE owner=?').bind(owner).first<{state:string;created:number;updated:number}>();
 const queued=await db.prepare('SELECT COUNT(*) AS n FROM user_data_erasure_blobs WHERE owner=?').bind(owner).first<{n:number}>();
 return {state:row?.state||'none',pendingFiles:queued?.n||0,updatedAt:row?.updated||0};
}
export async function eraseUserData(owner:string){
 const {db,bucket}=await storage();if(!bucket)throw new Error('File storage unavailable');const now=Date.now(),subject=await rateSubject('owner:'+owner);
 // This tombstone is the write barrier. Triggers reject old in-flight writes,
 // including photo jobs. A minimal platform subject ID is retained for this
 // purpose; no profile, VIN, record payload or file content is retained here.
 await db.prepare("INSERT INTO user_data_erasure(owner,state,created,updated) VALUES(?,'pending',?,?) ON CONFLICT(owner) DO NOTHING").bind(owner,now,now).run();
 await db.batch([
  db.prepare("DELETE FROM api_rate_limits WHERE subject=? AND scope<>'erasure'").bind(subject),
  db.prepare('INSERT OR IGNORE INTO user_data_erasure_blobs(owner,object_key) SELECT owner,owner || ? || id FROM documents WHERE owner=?').bind('/',owner),
  db.prepare('INSERT OR IGNORE INTO user_data_erasure_blobs(owner,object_key) SELECT owner,object_key FROM vehicle_photos WHERE owner=? AND object_key IS NOT NULL').bind(owner),
  ...['car_shares','car_documents','records','documents','vehicle_photos','vehicle_photo_search','station_reviews'].map(table=>db.prepare('DELETE FROM '+table+' WHERE owner=?').bind(owner)),
  db.prepare('DELETE FROM vehicle_photo_budget WHERE scope IN (?,?,?)').bind('search:'+owner,'paid:'+owner,'upload:'+owner),
 ]);
 // Also discover interrupted uploads which never gained a metadata row. New
 // photo uploads share the owner's R2 prefix with documents. Legacy photo keys
 // were captured above before their rows were removed.
 const listed=await bucket.list({prefix:owner+'/',limit:100});
 if(listed.objects.length)await db.prepare('INSERT OR IGNORE INTO user_data_erasure_blobs(owner,object_key) SELECT ?,value FROM json_each(?)').bind(owner,JSON.stringify(listed.objects.map(obj=>obj.key))).run();
 const keys=await db.prepare('SELECT object_key FROM user_data_erasure_blobs WHERE owner=? LIMIT 25').bind(owner).all<{object_key:string}>();
 const deleted=await Promise.allSettled(keys.results.map(async row=>{await bucket.delete(row.object_key);return row.object_key;}));
 const removed=deleted.flatMap(result=>result.status==='fulfilled'?[result.value]:[]);
 if(removed.length){const encoded=JSON.stringify(removed);await db.batch([
  db.prepare('DELETE FROM vehicle_photo_gc WHERE object_key IN (SELECT value FROM json_each(?))').bind(encoded),
  db.prepare('DELETE FROM user_data_erasure_blobs WHERE owner=? AND object_key IN (SELECT value FROM json_each(?))').bind(owner,encoded),
 ]);}
 const pending=await db.prepare('SELECT COUNT(*) AS n FROM user_data_erasure_blobs WHERE owner=?').bind(owner).first<{n:number}>();
 const remaining=await bucket.list({prefix:owner+'/',limit:1});
 const done=!pending?.n&&!remaining.objects.length;
 await db.prepare('UPDATE user_data_erasure SET state=?,updated=? WHERE owner=?').bind(done?'complete':'pending',Date.now(),owner).run();
 return {...await erasureStatus(owner),deletedFiles:removed.length};
}
