"use client";
import {z} from 'zod';
import {readApi,reviewSchema} from './api-contracts';
import {useState} from 'react';
export default function StationReviews({station,onChange}:{station:{id:string;name:string;address?:string;lat:number;lon:number;count?:number};onChange:()=>void}){
 const [reviews,setReviews]=useState<z.infer<typeof reviewSchema>[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(false),[loaded,setLoaded]=useState(false);
 async function load(){setError('');try{const r=await fetch('/api/station-reviews?station='+encodeURIComponent(station.id));const d=z.object({reviews:z.array(reviewSchema)}).parse(await readApi(r));setReviews(d.reviews);setLoaded(true);}catch(e){setError(e instanceof Error?e.message:'Не вдалося завантажити відгуки.');}}
 return <details onToggle={e=>{if(e.currentTarget.open&&!loaded)void load();}}><summary>Відгуки MOTORNA{station.count?` (${station.count})`:''}</summary>
 <p className="fine">Оцінки користувачів MOTORNA. Візити до СТО не перевірені.</p>
 {loaded&&!reviews.length&&<p>Відгуків ще немає.</p>}{reviews.map((r,i)=><blockquote key={i}><strong>{r.author} · {'★'.repeat(r.rating)}{'☆'.repeat(5-r.rating)}</strong><p>{r.text}</p><small>{new Date(r.updatedAt).toLocaleDateString('uk-UA')}</small></blockquote>)}
 <form onSubmit={async e=>{e.preventDefault();setBusy(true);setError('');const values=new FormData(e.currentTarget);try{const response=await fetch('/api/station-reviews',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({station:station.id,author:values.get('author'),text:values.get('text'),rating:Number(values.get('rating'))})});await readApi(response);await load();onChange();}catch(e){setError(e instanceof Error?e.message:'Не вдалося зберегти відгук.');}finally{setBusy(false);}}}>
 <label>Ім’я для публікації<input name="author" required minLength={2} maxLength={60}/></label><label>Ваша оцінка<select name="rating" defaultValue="5">{[5,4,3,2,1].map(n=><option key={n} value={n}>{'★'.repeat(n)} · {n} з 5</option>)}</select></label>
 <label>Ваш досвід<textarea name="text" required minLength={10} maxLength={1500}/></label><p className="fine">Відгук буде публічним. Один відгук на акаунт для кожної СТО; повторна публікація оновлює його.</p><button className="outline-btn" disabled={busy}>{busy?'Зберігаємо…':'Опублікувати відгук'}</button></form>{error&&<p role="alert">{error}</p>}
 <a target="_blank" rel="noopener noreferrer" href={'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent([station.name,station.address,`${station.lat},${station.lon}`].join(' '))}>Знайти СТО та відгуки в Google Maps ↗</a></details>;
}
