"use client";
import {useEffect,useState} from 'react';
import {photosSchema,readApi} from './api-contracts';
import {createPortal} from 'react-dom';
import {vehicleAppearance} from './vehicle-appearance';
type Photo={note?:string;url:string;source:string;host?:string;vin?:string;author?:string;license?:string;title:string};
type Props={vin?:string;fields?:{label:string;value:string}[];name?:string;make?:string;model?:string;year?:string;onSelect:(i:number)=>void};
export default function VehicleVisual(p:Props){const [retry,setRetry]=useState(0);return <VehiclePhoto key={JSON.stringify([p.vin,p.make,p.model,p.year,p.fields,retry])} {...p} retry={()=>setRetry(v=>v+1)}/>;}
function VehiclePhoto(p:Props&{retry:()=>void}){
 const a=vehicleAppearance(p.fields);
 const vin=/^[A-HJ-NPR-Z0-9]{17}$/.test(p.vin||'')?p.vin!:'';
 const modelQuery=p.make&&p.model&&p.year?new URLSearchParams({make:p.make,model:p.model,year:p.year,body:a.knownBody?a.body:'',color:a.color}).toString():'';
 const [photos,setPhotos]=useState<Photo[]>([]),[creditTarget]=useState<HTMLElement|null>(()=>typeof document==='undefined'?null:document.getElementById('photo-credits')),[loading,setLoading]=useState(!!(vin||modelQuery)),[similar,setSimilar]=useState(false),[error,setError]=useState('');
 useEffect(()=>{
  const abort=new AbortController();if(!vin&&!modelQuery)return;
  async function run(){
   let unavailable=false;
   if(vin){try{const r=await fetch('/api/vin-photos',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({vin}),signal:abort.signal,cache:'no-store'});const d=photosSchema.parse(await readApi(r));if(d.photos.length){if(!abort.signal.aborted)setPhotos(d.photos);return;}}catch{unavailable=true;}}
   if(abort.signal.aborted)return;
   if(modelQuery){for(const suffix of ['']){
    try{const r=await fetch('/api/vehicle-image?'+modelQuery+suffix,{signal:abort.signal,cache:'no-store'});const d=photosSchema.parse(await readApi(r));if(d.photos.length){if(!abort.signal.aborted){setPhotos(d.photos);setSimilar(true);}return;}}catch{unavailable=true;}
    if(abort.signal.aborted)return;
   }}
   if(!abort.signal.aborted)setError(unavailable?'Не вдалося завантажити фото. Спробуйте ще раз.':'Фото з відповідними моделлю, роком, кузовом і кольором поки не знайдено.');
  }
  void run().finally(()=>{if(!abort.signal.aborted)setLoading(false);});return()=>abort.abort();
 },[vin,modelQuery]);
 const photo=photos[0];
 return <div className="vehicle-visual"><section className="vehicle-photo"><div className="model-caption"><strong>{p.name||'Ваш автомобіль'}</strong><span>{[a.knownBody?a.bodyLabel:'',a.knownColor?a.colorLabel:''].filter(Boolean).join(' · ')||(vin||modelQuery?'':'Додайте автомобіль, щоб персоналізувати пошук')}</span></div>{loading?<div className="vehicle-photo-empty" role="status">Підбираємо фото автомобіля…</div>:photo?<><div className="vehicle-photo-stage"><img src={photo.url} alt={similar?`${p.name||'Автомобіль'}: ілюстративне фото моделі`:`Фото автомобіля з оголошення за VIN ${vin}`} onError={()=>{setPhotos(old=>old.filter(x=>x.url!==photo.url));setError('Фото недоступне. Повторіть пошук.');}} referrerPolicy="no-referrer"/></div><p className="vehicle-photo-note">{photo.note|| (similar?'Ілюстративне фото моделі, підібране за даними авто. Комплектація може відрізнятися.':`VIN оголошення збігається: ${photo.vin}. Фото на момент публікації.`)}</p>{creditTarget&&createPortal(<details className="photo-credits-details"><summary>Джерело фото</summary><a href={photo.source} target="_blank" rel="noopener noreferrer">{photo.title} · {similar?`${photo.author} · ${photo.license}`:photo.host} ↗</a></details>,creditTarget)}</>:<div className="vehicle-photo-empty"><p>{error||'Введіть VIN, щоб побачити автомобіль.'}</p>{(vin||modelQuery)&&<><button className="outline-btn" onClick={p.retry}>Повторити пошук</button></>}</div>}</section></div>;
}
