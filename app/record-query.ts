import {z} from 'zod';
import {schemas} from './validation';
const integer=z.string().regex(/^(0|[1-9][0-9]*)$/).transform(Number).pipe(z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER));
const querySchema=z.object({limit:integer.pipe(z.number().min(1).max(100)).default('50'),kind:z.string().refine(v=>Object.hasOwn(schemas,v)).optional(),carId:z.string().uuid().optional(),id:z.string().uuid().optional(),from:integer.optional(),to:integer.optional(),cursor:z.string().min(1).max(600).regex(/^[A-Za-z0-9_-]+$/).optional()}).refine(v=>v.from===undefined||v.to===undefined||v.from<=v.to);
const cursorSchema=z.object({v:z.literal(1),created:z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),id:z.string().uuid(),scope:z.string().regex(/^[a-f0-9]{64}$/)});
export class RecordQueryError extends Error{}
export type RecordRow={id:string;kind:string;payload:string;created:number};
export async function recordQuery(owner:string,params:URLSearchParams){
 try{
  const allowed=new Set(['limit','kind','carId','id','from','to','cursor']);
  for(const key of params.keys())if(!allowed.has(key)||params.getAll(key).length!==1)throw new Error();
  const query=querySchema.parse(Object.fromEntries(params));
  const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify([owner,query.kind,query.carId,query.id,query.from,query.to])));
  const scope=Array.from(new Uint8Array(bytes),n=>n.toString(16).padStart(2,'0')).join('');
  const clauses=['owner = ?'],values:(string|number)[]=[owner];
  if(query.kind){clauses.push('kind = ?');values.push(query.kind);}
  if(query.carId){clauses.push("json_extract(payload, '$.carId') = ?");values.push(query.carId);}
  if(query.id){clauses.push('id = ?');values.push(query.id);}
  if(query.from!==undefined){clauses.push('created >= ?');values.push(query.from);}
  if(query.to!==undefined){clauses.push('created <= ?');values.push(query.to);}
  const countSql='SELECT COUNT(*) AS total FROM records WHERE '+clauses.join(' AND '),countValues=[...values];
  if(query.cursor){const cursor=cursorSchema.parse(JSON.parse(atob(query.cursor.replace(/-/g,'+').replace(/_/g,'/'))));if(cursor.scope!==scope)throw new Error();clauses.push('(created, id) < (?, ?)');values.push(cursor.created,cursor.id);}
  const sql='SELECT id, kind, payload, created FROM records WHERE '+clauses.join(' AND ')+' ORDER BY created DESC, id DESC LIMIT ?';values.push(query.limit+1);
  return {sql,values,countSql,countValues,limit:query.limit,scope};
 }catch{throw new RecordQueryError('Некоректні параметри фільтра або курсор.');}
}
export function recordPage(rows:RecordRow[],limit:number,scope:string,total:number){const hasMore=rows.length>limit,records=rows.slice(0,limit),last=records.at(-1);const nextCursor=hasMore&&last?btoa(JSON.stringify({v:1,created:last.created,id:last.id,scope})).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''):null;return {records:records.map(r=>({id:r.id,kind:r.kind,data:JSON.parse(r.payload) as unknown,created:r.created})),page:{limit,total,hasMore,nextCursor}};}
