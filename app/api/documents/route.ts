import {apiBoundary,dataConstraintFailure} from '@/app/api-response';
import {mutationGuard} from '@/app/mutation-security';
import {boundedUpload,verifyDocument,UploadError} from '@/app/document-upload';
import {catalogDb} from '@/app/car-catalog-store';
import {getChatGPTUser} from '@/app/chatgpt-auth';
export const dynamic='force-dynamic';
const privateHeaders={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
export async function GET(request:Request){
 return apiBoundary(async()=>{
const u=await getChatGPTUser();if(!u)return Response.json({error:'Потрібен вхід'},{status:401});try{const {db}=await catalogDb();const docs=await db.prepare('SELECT d.id,d.name,d.mime,d.size,d.created,c.car_id AS carId FROM documents d LEFT JOIN car_documents c ON c.document_id=d.id AND c.owner=d.owner WHERE d.owner = ? ORDER BY d.created DESC').bind(u.userId).all();return Response.json({documents:docs.results},{headers:privateHeaders});}catch{return Response.json({error:'Не вдалося завантажити документи'},{status:503});}
 },"/api/documents",request);
}
export async function POST(req:Request){
 return apiBoundary(async()=>{
const u=await getChatGPTUser();if(!u)return Response.json({error:'Потрібен вхід'},{status:401});const denied=mutationGuard(req,{format:'multipart'});if(denied)return denied;if(Number(req.headers.get('content-length'))>6*1024*1024)return Response.json({error:'Максимальний розмір — 5 МБ'},{status:413});try{const bytes=await boundedUpload(req);let form:FormData;try{form=await new Request(req.url,{method:'POST',headers:{'Content-Type':req.headers.get('content-type')||''},body:bytes}).formData();}catch{throw new UploadError('Не вдалося прочитати форму документа.');}const file=form.get('file');if(!(file instanceof File)||file.size>5*1024*1024||!['application/pdf','image/jpeg','image/png'].includes(file.type))return Response.json({error:'Додайте PDF, JPG або PNG до 5 МБ'},{status:400});const content=await file.arrayBuffer();verifyDocument(content,file.type);const {db,bucket}=await catalogDb();const carId=String(form.get('carId')||'');if(carId&&!await db.prepare("SELECT id FROM records WHERE id=? AND owner=? AND kind='car'").bind(carId,u.userId).first())return Response.json({error:'Оберіть своє авто'},{status:400});if(!bucket)throw new Error('Bucket unavailable');const id=crypto.randomUUID(),name=file.name.replace(/[\x00-\x1f\x7f]/g,'').slice(0,150)||'Документ',created=Date.now();await bucket.put(`${u.userId}/${id}`,content,{httpMetadata:{contentType:file.type}});try{await db.prepare('INSERT INTO documents (id,owner,name,mime,size,created) VALUES (?,?,?,?,?,?)').bind(id,u.userId,name,file.type,file.size,created).run();if(carId)await db.prepare('INSERT INTO car_documents(document_id,car_id,owner) VALUES (?,?,?)').bind(id,carId,u.userId).run();}catch(e){await db.prepare('DELETE FROM documents WHERE id=? AND owner=?').bind(id,u.userId).run();await bucket.delete(`${u.userId}/${id}`);throw e;}return Response.json({document:{id,name,mime:file.type,size:file.size,created,carId}},{status:201});}catch(e){const constraint=dataConstraintFailure(e);if(constraint)return constraint;if(e instanceof UploadError)return Response.json({error:e.message},{status:e.status});return Response.json({error:'Не вдалося зберегти документ. Спробуйте ще раз.'},{status:503});}
 },"/api/documents",req);
}
