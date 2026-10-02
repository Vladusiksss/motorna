"use client";
import {useRef,useState,useEffect} from 'react';
function PaidOemCatalog({carId,onSelect}:{carId:string;onSelect:(part:{part:string;oem:string})=>void}){
 const [data,setData]=useState<any>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');const generation=useRef(0);
 useEffect(()=>{generation.current++;setData(null);setError('');setBusy(false);return()=>{generation.current++;};},[carId]);
 async function load(action:string,index?:number){const id=++generation.current;setBusy(true);setError('');try{const r=await fetch('/api/parts-index',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({carId,session:data?.session,action,index})});const d:any=await r.json();if(id!==generation.current)return;if(!r.ok)throw Error(d.error);if(action==='part')onSelect({part:d.part.name,oem:d.part.number});else setData(d);}catch(e){if(id===generation.current)setError(e instanceof Error?e.message:'Не вдалося відкрити каталог.');}finally{if(id===generation.current)setBusy(false);}}
 return <section className="panel"><h3>Каталог деталей за VIN · Parts Index</h3><button className="outline-btn" disabled={busy} onClick={()=>load('vin')}>{busy?'Завантажуємо каталог…':'Знайти деталь у каталозі'}</button>{error&&<p role="alert">{error}</p>}{data&&<><h4>{data.title}</h4>{data.vehicles?.map((v:any,i:number)=><button className="outline-btn" key={i} disabled={busy} onClick={()=>load('vehicle',i)}>{v.name} {v.parameters?.map((p:any)=>p.value).join(' · ')}</button>)}{data.groups?.map((g:any,i:number)=><button className="outline-btn" key={i} disabled={busy} onClick={()=>load('group',i)}>{g.name}</button>)}{data.parts?.map((p:any,i:number)=><article key={i}><strong>{p.name} · {p.number}</strong><p>{p.description}</p><p>{p.notice}</p><button className="outline-btn" disabled={busy} onClick={()=>load('part',i)}>Знайти цей артикул у магазинах</button></article>)}{!data.pending&&!data.groups?.length&&!data.parts?.length&&!data.vehicles?.length&&<p>Для цього запиту каталог не повернув деталей.</p>}{data.title&&<button className="text-btn" disabled={busy} onClick={()=>load('root')}>Оновити перелік деталей</button>}<p className="fine">{data.notice}</p></>}</section>;
}

type CatalogProps={carId:string;vin:string;vehicle:string;requestedPart:string;onSelect:(part:{part:string;oem:string})=>void};
export default function OemCatalog({carId,vin,vehicle,requestedPart,onSelect}:CatalogProps){
 const [name,setName]=useState(requestedPart),[number,setNumber]=useState(''),[notice,setNotice]=useState('');
 useEffect(()=>{setName(requestedPart);},[requestedPart]);
 const request=`Добрий день! Прошу підібрати деталь за оригінальним заводським каталогом.\nАвтомобіль: ${vehicle}\nVIN: ${vin}\nДеталь: ${name.trim()||'уточніть назву деталі'}\nПрошу повідомити OEM-номер, назву каталогу, застосовність до цього VIN, обмеження за комплектацією та актуальні заміни номера. Також потрібні ціна і посилання на товар.`;
 async function copy(text:string){try{await navigator.clipboard.writeText(text);setNotice('Скопійовано.');}catch{setNotice('Не вдалося скопіювати. Виділіть текст і скопіюйте вручну.');}}
 return <section className="panel oem-free"><h3>Підібрати оригінальний номер за VIN</h3>
 <p>Відкрийте каталог або отримайте підбір продавця. Потім введіть OEM-номер для пошуку пропозицій.</p>
 <label>Потрібна деталь<input value={name} onChange={e=>setName(e.target.value)} placeholder="Наприклад, передні гальмівні колодки" maxLength={200}/></label>
 <div className="oem-options"><article><h4>PartSouq · оригінальні каталоги</h4><p>Скопіюйте VIN і вставте його в пошук каталогу. Доступність залежить від марки та автомобіля.</p><code>{vin}</code><div className="oem-actions"><button type="button" className="outline-btn" onClick={()=>void copy(vin)}>Скопіювати VIN</button><a className="outline-btn" href="https://partsouq.com/" target="_blank" rel="noopener noreferrer">Відкрити каталог ↗</a></div></article>
 <article><h4>DOK.ua · безкоштовний підбір</h4><p>Передайте продавцю VIN і назву деталі. Попросіть перевірити номер у заводському каталозі.</p><div className="oem-actions"><a className="outline-btn" href="https://dok.ua/ua/page/price_check" target="_blank" rel="noopener noreferrer">Звернутися до продавця ↗</a><a href="tel:0800330707">0 800 330 707</a></div></article></div>
 <details><summary>Готовий запит продавцю</summary><textarea aria-label="Запит продавцю" readOnly value={request} rows={7}/><button type="button" className="outline-btn" onClick={()=>void copy(request)}>Скопіювати запит</button><p className="fine">Надішліть цей текст продавцю самостійно.</p></details>
 <form onSubmit={e=>{e.preventDefault();const oem=number.trim().toUpperCase();if(!/^[A-Z0-9][A-Z0-9 .\/-]{2,49}$/.test(oem)||!/[0-9]/.test(oem)){setNotice('Перевірте OEM-номер: потрібен артикул із цифрами, а не назва деталі.');return;}setNotice('Шукаємо пропозиції за вказаним номером.');onSelect({part:name.trim(),oem});}}>
 <label>OEM-номер із каталогу або відповіді продавця<input required value={number} onChange={e=>setNumber(e.target.value)} minLength={3} maxLength={50} placeholder="Введіть отриманий артикул"/></label>
 <button className="outline-btn" disabled={!name.trim()||!number.trim()}>Знайти пропозиції за OEM</button></form>
 <p role="status">{notice}</p><p className="fine">Введений номер сам по собі не підтверджує сумісність. Збережіть відповідь продавця з перевіркою саме вашого VIN.</p>
 <details><summary>Parts Index · за наявності підключеного доступу</summary><PaidOemCatalog carId={carId} onSelect={onSelect}/></details>
 </section>;
}
