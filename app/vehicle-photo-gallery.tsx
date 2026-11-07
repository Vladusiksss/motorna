"use client";
import {useEffect,useState} from 'react';
import {readApi} from './api-contracts';
import {gallerySchema,type Gallery,type VehiclePhoto} from './vehicle-intelligence/contracts';

const providers:Record<string,string>={auto_dev:'Auto.dev',vehicles_dev:'Vehicles.dev',commons:'Wikimedia Commons',auto_ria:'AUTO.RIA',copart:'Copart',iaa:'IAA'};
const states:Record<string,string>={ok:'Знайдено',no_match:'Збігів немає',disabled:'Не підключено',missing_key:'Потрібен API-ключ',license_required:'Потрібен дозвіл на фото',agreement_required:'Потрібен договір доступу',unauthorized:'Доступ не підтверджено',rate_limited:'Ліміт джерела',timeout:'Час очікування вичерпано',unavailable:'Тимчасово недоступне',invalid_response:'Непідтримувана відповідь',conflict:'VIN джерела не збігається',budget_exhausted:'Денний ліміт запитів'};
type Props={carId:string;name:string;compact?:boolean};
export default function VehiclePhotoGallery(p:Props){return <GalleryContent key={p.carId} {...p}/>;}
function GalleryContent({carId,name,compact=false}:Props){
 const [data,setData]=useState<Gallery|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[rights,setRights]=useState(false),[broken,setBroken]=useState<string[]>([]),[tab,setTab]=useState('exact'),[started,setStarted]=useState(false);
 useEffect(()=>{
  const abort=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined,attempt=0,launched=false;
  async function load(){try{
   let result=gallerySchema.parse(await readApi(await fetch('/api/vehicle-photos?carId='+carId,{signal:abort.signal,cache:'no-store'})));
   if(result.status==='idle'&&!launched&&result.retryAt<=Date.now()){launched=true;result=gallerySchema.parse(await readApi(await fetch('/api/vehicle-photos',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({carId}),signal:abort.signal})));}
   if(abort.signal.aborted)return;setData(result);setError('');
   if(result.status==='running'&&attempt++<20)timer=setTimeout(()=>void load(),1800);
  }catch(e){if(!abort.signal.aborted)setError(e instanceof Error?e.message:'Не вдалося завантажити галерею.');}}
  void load();return()=>{abort.abort();if(timer)clearTimeout(timer);};
 },[carId,started]);
 async function mutate(method:string,body?:unknown,suffix=''){
  setBusy(true);setError('');try{const form=body instanceof FormData;const r=await fetch('/api/vehicle-photos'+suffix,{method,headers:body&&!form?{'Content-Type':'application/json'}:undefined,body:body?(form?body:JSON.stringify(body)):undefined});const result=gallerySchema.parse(await readApi(r));setData(result);setStarted(x=>!x);}
  catch(e){setError(e instanceof Error?e.message:'Спробуйте ще раз.');}finally{setBusy(false);}
 }
 const visible=data?.photos.filter(p=>!broken.includes(p.id))||[],primary=visible.find(p=>p.id===data?.primaryId)||visible.find(p=>p.owned)||visible.find(p=>p.match==='EXACT_VIN_MATCH')||visible[0];
 const sections=[{id:'exact',title:'Фото саме цього VIN',photos:visible.filter(p=>!p.owned&&p.match==='EXACT_VIN_MATCH')},{id:'model',title:'Фото моделі',photos:visible.filter(p=>!p.owned&&p.match==='MODEL_MATCH')},{id:'owned',title:'Мої фото',photos:visible.filter(p=>p.owned)}];
 function caption(p:VehiclePhoto){return p.owned?'Ваше приватне фото':p.match==='EXACT_VIN_MATCH'?'VIN у джерелі збігається. Автентичність фото не гарантована.':p.note||'Ілюстративне фото. Це не підтверджене фото вашого автомобіля.';}
 function provenance(p:VehiclePhoto){return <div className="gallery-provenance"><p>{caption(p)}</p>{p.source&&<a href={p.source} target="_blank" rel="noopener noreferrer">{providers[p.provider]||p.provider} · Джерело ↗</a>}<small>{p.author&&p.author+' · '}{p.licenseUrl?<a href={p.licenseUrl} target="_blank" rel="noopener noreferrer">{p.license}</a>:p.license} · Отримано {new Date(p.checkedAt).toLocaleDateString('uk-UA')}{p.publishedAt&&' · Опубліковано '+p.publishedAt}</small></div>;}
 return <section className={'vehicle-gallery '+(compact?'gallery-compact':'')} aria-label="Фотографії автомобіля">
  <div className="section-top"><div><h2>{compact?name:'Фотографії автомобіля'}</h2><p className="fine">{data?.vin||name}</p></div>{data?.status==='running'&&<span role="status" className="gallery-status">Перевіряємо джерела…</span>}</div>
  <div className="gallery-hero">{primary?<img src={primary.url} alt={name+' — '+(primary.owned?'моє фото':primary.match==='MODEL_MATCH'?'ілюстрація моделі':'фото з VIN джерела')} referrerPolicy="no-referrer" onError={()=>setBroken(b=>[...b,primary.id])}/>:<p role="status">{!data?'Завантажуємо галерею…':data.status==='running'?'Шукаємо доступні фото…':'Фото саме цього VIN поки немає. Ви можете додати власне фото.'}</p>}</div>
  {primary&&provenance(primary)}
  {error&&<p role="alert" className="warning">{error}</p>}
  <details open={!compact} className="gallery-details"><summary>Галерея та керування фото</summary>
   <div className="gallery-tabs" role="group" aria-label="Розділ фотографій">{sections.map(s=><button className="outline-btn" key={s.id} aria-pressed={tab===s.id} onClick={()=>setTab(s.id)}>{s.title} · {s.photos.length}</button>)}</div>
   <div className="gallery-grid">{sections.find(s=>s.id===tab)?.photos.map(p=><article key={p.id} className="gallery-card"><img loading="lazy" src={p.url} alt={p.title} referrerPolicy="no-referrer" onError={()=>setBroken(b=>[...b,p.id])}/>{provenance(p)}<div className="gallery-actions"><button disabled={busy||data?.primaryId===p.id} className="outline-btn" onClick={()=>void mutate('PATCH',{carId,primaryId:p.id})}>{data?.primaryId===p.id?'Головне фото':'Обрати головним'}</button><button disabled={busy} className="text-btn" onClick={()=>void mutate('DELETE',undefined,`?carId=${carId}&photoId=${p.id}`)}>Видалити фото</button></div></article>)}</div>
   {!sections.find(s=>s.id===tab)?.photos.length&&<p className="fine">У цьому розділі фотографій немає.</p>}
   <div className="gallery-upload"><strong>Додати моє фото</strong><p className="fine">JPG або PNG до 5 МБ, до 20 фото. Доступні лише вам; у QR-каталог не потрапляють. Файл зберігається з початковими метаданими.</p><label><input type="checkbox" checked={rights} onChange={e=>setRights(e.target.checked)}/> Я маю право завантажити це фото</label><label className={'outline-btn '+(!rights?'gallery-upload-disabled':'')}>Завантажити фото<input type="file" aria-label="Завантажити фото автомобіля" accept="image/jpeg,image/png" disabled={busy||!rights} onChange={e=>{const f=e.currentTarget.files?.[0];e.currentTarget.value='';if(!f)return;if(f.size>5*1024*1024){setError('Максимальний розмір — 5 МБ.');return;}const form=new FormData();form.set('carId',carId);form.set('rightsConfirmed','true');form.set('file',f);void mutate('POST',form);}}/></label></div>
   <div className="gallery-actions"><label><input type="checkbox" disabled={busy||!data} checked={data?.hideExternal||false} onChange={e=>void mutate('PATCH',{carId,hideExternal:e.target.checked})}/> Приховати зовнішні зображення</label><button className="outline-btn" disabled={busy||!data||data.status==='running'} onClick={()=>void mutate('POST',{carId,refresh:true})}>Оновити пошук фото</button><button className="text-btn" disabled={busy||!data} onClick={()=>void mutate('DELETE',undefined,'?carId='+carId)}>Видалити результати пошуку</button></div>
   {data?.retryAt? <p className="fine">Наступний пошук після {new Date(data.retryAt).toLocaleTimeString('uk-UA',{hour:'2-digit',minute:'2-digit'})}.</p>:null}
   <details><summary>Стан джерел</summary><ul className="gallery-provider-list">{data?.providers.map(p=><li key={p.provider}><span>{providers[p.provider]||p.provider}</span><span>{states[p.status]}{p.count?' · '+p.count:''}</span></li>)}</ul></details>
  </details>
 </section>;
}
