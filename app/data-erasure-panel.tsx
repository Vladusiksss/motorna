"use client";
import {useState} from 'react';
import {readApi} from './api-contracts';
const confirmation='ВИДАЛИТИ МОЇ ДАНІ';
export default function DataErasurePanel(){
 const [open,setOpen]=useState(false),[text,setText]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[complete,setComplete]=useState(false);
 async function remove(){setBusy(true);setMessage('');try{
  const result=await readApi(await fetch('/api/account-data',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({confirmation:text})})) as {state:string;pendingFiles:number};
  if(result.state==='complete'){
   for(const storage of [localStorage,sessionStorage])for(const key of Object.keys(storage))if(key.startsWith('motorna-'))storage.removeItem(key);
   setComplete(true);setMessage('Дані Motorna видалено. Оновіть сторінку або вийдіть із застосунку.');
  }else setMessage('Записи вже видалено. Залишилося файлів: '+result.pendingFiles+'. Натисніть «Продовжити видалення».');
 }catch(e){setMessage(e instanceof Error?e.message:'Не вдалося завершити. Повторний запуск безпечний.');}finally{setBusy(false);}}
 return <section className="panel data-erasure"><h2>Керування даними</h2><p>Видалення автомобілів, історії, чеків, фото, заявок, обраного, відгуків і спільних QR-каталогів Motorna.</p>{!open?<button className="outline-btn" onClick={()=>setOpen(true)}>Видалити всі мої дані</button>:<><p>Дію неможливо скасувати. Збережіть потрібні звіти перед видаленням. Старі QR-посилання перестануть працювати.</p><p className="fine">Обліковий запис ChatGPT не видаляється. Залишається лише технічна відмітка ідентифікатора, яка блокує відновлення даних старими запитами; нові записи для цього профілю будуть закриті.</p><label className="field-label">Введіть «{confirmation}»<input className="input" value={text} onChange={e=>setText(e.target.value)} disabled={busy||complete} autoComplete="off"/></label><div className="gallery-actions"><button className="outline-btn" disabled={busy||complete||text!==confirmation} onClick={()=>void remove()}>{busy?'Видалення…':message?'Продовжити видалення':'Підтвердити повне видалення'}</button>{!complete&&<button className="text-btn" disabled={busy} onClick={()=>{setOpen(false);setText('');}}>Скасувати</button>}</div>{message&&<p role="status">{message}</p>}{complete&&<button className="outline-btn" onClick={()=>window.location.assign("/signout-with-chatgpt?return_to=/")}>Вийти</button>}</>}</section>;
}
