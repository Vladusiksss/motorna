import {storage} from '@/db/storage';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {z} from 'zod';
const station=z.string().regex(/^(node|way|relation)\/\d{1,20}$/);
async function database(){const {db}=await storage();await db.prepare("CREATE TABLE IF NOT EXISTS station_reviews (station TEXT NOT NULL, owner TEXT NOT NULL, author TEXT NOT NULL, rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5), text TEXT NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY(station,owner))").run();return db;}
export async function GET(request:Request){
 try{if(new URL(request.url).searchParams.get('summary')==='1'){const db=await database();const rows=await db.prepare('SELECT station, COUNT(*) AS count, AVG(rating) AS rating, SUM(CASE WHEN rating>=4 THEN 1 ELSE 0 END) AS positive FROM station_reviews GROUP BY station').all();return Response.json({summaries:rows.results});}const id=station.parse(new URL(request.url).searchParams.get('station'));const db=await database();const user=await getChatGPTUser();
 const rows=await db.prepare('SELECT author,rating,text,updated_at,owner FROM station_reviews WHERE station=? ORDER BY updated_at DESC').bind(id).all();
 return Response.json({reviews:rows.results.map((r:any)=>({author:r.author,rating:r.rating,text:r.text,updatedAt:r.updated_at,mine:r.owner===user?.userId}))});
 }catch{return Response.json({error:'Не вдалося завантажити відгуки.'},{status:400});}}
export async function POST(request:Request){
 if(request.headers.get('sec-fetch-site')==='cross-site')return Response.json({error:'Недозволений запит'},{status:403});
 const user=await getChatGPTUser();if(!user)return Response.json({error:'Увійдіть, щоб залишити відгук.'},{status:401});
 try{const raw=await request.text();if(raw.length>5000)throw Error();const d=z.object({station,rating:z.number().int().min(1).max(5),text:z.string().trim().min(10).max(1500),author:z.string().trim().min(2).max(60)}).parse(JSON.parse(raw));
 const db=await database();await db.prepare('INSERT INTO station_reviews(station,owner,author,rating,text,updated_at) VALUES (?,?,?,?,?,?) ON CONFLICT(station,owner) DO UPDATE SET author=excluded.author,rating=excluded.rating,text=excluded.text,updated_at=excluded.updated_at').bind(d.station,user.userId,d.author,d.rating,d.text,new Date().toISOString()).run();return Response.json({ok:true});
 }catch{return Response.json({error:'Вкажіть ім’я, оцінку 1–5 та відгук від 10 до 1500 символів.'},{status:400});}}
