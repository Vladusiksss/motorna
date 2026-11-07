"use client";
import {useState,useEffect} from 'react';
import {readApi} from './api-contracts';
const confirmation='ВИДАЛИТИ МОЇ ДАНІ';
export default function DataErasurePanel(){
 const [open,setOpen]=useState(false),[text,setText]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[complete,setComplete]=useState(false);
 useEffect(()=>{const controller=new AbortController();void fetch('/api/account-data',{signal:controller.signal}).then(readApi).then(value=>{const status=value as {state:string;pendingFiles:number};if(status.state==='pending'){setOpen(true);setText(confirmation);setMessage('Видалення вже підтверджено. Залишилося файлів: '+status.pendingFiles+'. Продовжіть очищення.');}else if(status.state==='complete'){setOpen(true);setComplete(true);setMessage('Дані Motorna видалено.');}}).catch(()=>{});return ()=>controller.abort();},[]);
 async function remove(){setBusy(true);setMessage('');let stalled=0;try{
  for(let round=0;round<60;round++){
   const response=await fetch('/api/account-data',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({confirmation:text})});
   if(response.status===429){const retry=Math.min(60,Math.max(1,Number(response.headers.get('Retry-After'))||2));setMessage('Продовжимо очищення через '+retry+' с…');await new Promise(resolve=>setTimeout(resolve,retry*1000));continue;}
   const result=await readApi(response) as {state:string;pendingFiles:number;deletedFiles?:number};
   if(result.state==='complete'){
    try{for(const storage of [localStorage,sessionStorage])for(const key of Object.keys(storage))if(key.startsWith('motorna-'))storage.removeItem(key);}catch{/* Browser storage may be disabled; server erasure is already complete. */}
    setComplete(true);setMessage('Дані Motorna видалено. Оновіть сторінку або вийдіть із застосунку.');return;
   }
   stalled=result.deletedFiles?0:stalled+1;
   setMessage('Очищення триває. Залишилося файлів: '+result.pendingFiles+'.');
   if(stalled>=3)throw new Error('Сховище тимчасово не завершує видалення файлів. Повторіть очищення пізніше; записи вже видалені.');
   await new Promise(resolve=>setTimeout(resolve,2000));
  }
  setMessage('Частину файлів очищено. Натисніть «Продовжити видалення», щоб завершити.');
 }catch(e){setMessage(e instanceof Error?e.message:'Не вдалося завершити. Повторний запуск безпечний.');}finally{setBusy(false);}}
 return <section className="panel data-erasure"><h2>Керування даними</h2><p>Видалення автомобілів, історії, чеків, фото, заявок, обраного, відгуків і спільних QR-каталогів Motorna.</p>{!open?<button className="outline-btn" onClick={()=>setOpen(true)}>Видалити всі мої дані</button>:<><p>Дію неможливо скасувати. Збережіть потрібні звіти перед видаленням. Старі QR-посилання перестануть працювати.</p><p className="fine">Обліковий запис ChatGPT не видаляється. Залишається лише технічна відмітка ідентифікатора, яка блокує відновлення даних старими запитами; нові записи для цього профілю будуть закриті.</p><label className="field-label">Введіть «{confirmation}»<input className="input" value={text} onChange={e=>setText(e.target.value)} disabled={busy||complete} autoComplete="off"/></label><div className="gallery-actions"><button className="outline-btn" disabled={busy||complete||text!==confirmation} onClick={()=>void remove()}>{busy?'Видалення…':message?'Продовжити видалення':'Підтвердити повне видалення'}</button>{!complete&&<button className="text-btn" disabled={busy} onClick={()=>{setOpen(false);setText('');}}>Скасувати</button>}</div>{message&&<p role="status">{message}</p>}{complete&&<form action="/signout-with-chatgpt" method="get"><input type="hidden" name="return_to" value="/"/><button className="outline-btn">Вийти</button></form>}</>}</section>;
}
