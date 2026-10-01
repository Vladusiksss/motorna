"use client";
import {useState} from 'react';
import {ArrowUpRight,Heart,SlidersHorizontal,Wrench} from 'lucide-react';
import type {LinkResult} from './vehicle-finder';
import type {RecordItem} from './data';
import {filterOffers,emptyOfferFilters} from './offer-filters';
export default function OfferResults({results,vehicle,records,signedIn,save}:{results:LinkResult[];vehicle:string;records:RecordItem[];signedIn:boolean;save:(kind:string,data:any)=>Promise<any>}){
 const [filters,setFilters]=useState(emptyOfferFilters),[open,setOpen]=useState(false),[saving,setSaving]=useState<string[]>([]);
 const visible=filterOffers(results,filters),sellers=[...new Set(results.map(o=>o.host))].sort(),currencies=[...new Set(results.map(o=>o.currency).filter((v):v is string=>!!v))];
 async function favorite(r:LinkResult){setSaving(old=>[...old,r.url]);try{await save('webFavorite',{title:r.title.slice(0,200),url:r.url,vehicle:vehicle.slice(0,200),host:r.host,price:r.price,currency:r.currency,checkedAt:r.checkedAt});}finally{setSaving(old=>old.filter(url=>url!==r.url));}}
 return <><div className="offer-toolbar"><p role="status">Показано {visible.length} із {results.length}</p><button className="outline-btn" aria-expanded={open} aria-controls="offer-filters" onClick={()=>setOpen(!open)}><SlidersHorizontal size={17}/>Фільтри</button></div>
 {open&&<section className="panel offer-filters" id="offer-filters" aria-label="Фільтри пропозицій">
  <label>Назва деталі<input className="input" value={filters.text} onChange={e=>setFilters({...filters,text:e.target.value})} placeholder="Знайти у результатах…"/></label>
  <label>Магазин<select className="input" value={filters.seller} onChange={e=>setFilters({...filters,seller:e.target.value})}><option value="">Усі магазини</option>{sellers.map(s=><option key={s}>{s}</option>)}</select></label>
  <label>Валюта<select className="input" value={filters.currency} onChange={e=>setFilters({...filters,currency:e.target.value,min:'',max:'',sort:'relevance'})}><option value="">Усі валюти</option>{currencies.map(c=><option key={c}>{c}</option>)}</select></label>
  <label>Ціна від<input className="input" type="number" min="0" disabled={!filters.currency} value={filters.min} onChange={e=>setFilters({...filters,min:e.target.value})}/></label>
  <label>Ціна до<input className="input" type="number" min="0" disabled={!filters.currency} value={filters.max} onChange={e=>setFilters({...filters,max:e.target.value})}/></label>
  <label>Сортування<select className="input" value={filters.sort} onChange={e=>setFilters({...filters,sort:e.target.value})}><option value="relevance">За релевантністю</option><option value="ascending" disabled={!filters.currency}>Спочатку дешевші</option><option value="descending" disabled={!filters.currency}>Спочатку дорожчі</option></select></label>
  {!filters.currency&&<p className="fine">Оберіть валюту для фільтрації та сортування за ціною.</p>}
  {filters.min!==''&&filters.max!==''&&Number(filters.min)>Number(filters.max)&&<p role="alert">Мінімальна ціна перевищує максимальну.</p>}
  <button className="text-btn" onClick={()=>setFilters(emptyOfferFilters)}>Скинути фільтри</button>
 </section>}
 <div className="web-result-grid">{visible.map(r=><article className="panel web-result refreshed-offer" key={r.url}><div className="offer-card-icon"><Wrench size={30}/><span>{r.host}</span><button className="icon-btn" aria-label={'Зберегти: '+r.title} disabled={!signedIn||saving.includes(r.url)||records.some(x=>x.kind==='webFavorite'&&x.data.url===r.url)} onClick={()=>void favorite(r)}><Heart size={18}/></button></div><h3>{r.title}</h3><details className="compatibility-detail"><summary>Сумісність потребує перевірки</summary><p>Звірте артикул, двигун і комплектацію за OEM-каталогом або з продавцем.</p></details>{r.price!=null&&<strong className="offer-price">{new Intl.NumberFormat('uk-UA',{style:'currency',currency:r.currency||'UAH'}).format(r.price)}</strong>}<p className="fine">{r.availability||'Наявність уточнюйте'}{r.checkedAt&&<> · Перевірено {new Date(r.checkedAt).toLocaleString('uk-UA')}</>}</p><a className="primary" href={r.url} target="_blank" rel="noopener noreferrer">Переглянути <ArrowUpRight size={17}/></a></article>)}</div>
 {results.length>0&&!visible.length&&<div className="panel empty-filter"><h3>Нічого не знайдено за цими фільтрами</h3><button className="outline-btn" onClick={()=>setFilters(emptyOfferFilters)}>Скинути фільтри</button></div>}
 </>;
}
