"use client";
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {z} from 'zod';
import {readApi} from '../../api-contracts';
import type {Catalog} from '../../catalog-export';
export default function PublicCatalog({token}:{token:string}){
 const [data,setData]=useState<Catalog|null>(null),[error,setError]=useState('');
 useEffect(()=>{fetch('/api/shared-car/'+token,{cache:'no-store'}).then(async r=>{const d=z.object({vehicle:z.object({name:z.string(),year:z.number(),vin:z.string().optional(),engine:z.string().optional(),mileage:z.number()}),history:z.array(z.object({date:z.string(),title:z.string(),amount:z.number(),mileage:z.number()})),documents:z.array(z.object({id:z.string(),name:z.string(),size:z.number()})),created:z.number()}).parse(await readApi(r));setData(d);}).catch(e=>setError(e.message));},[token]);
 return <main className="public-catalog"><Link prefetch={false} className="brand" href="/">моторна</Link>{error?<section className="dossier"><h1>Каталог недоступний</h1><p>{error}</p></section>:!data?<p role="status">Завантаження каталогу…</p>:<><header className="dossier"><small>КАТАЛОГ АВТОМОБІЛЯ</small><h1>{data.vehicle.name} · {data.vehicle.year}</h1><p>{data.vehicle.engine} · {data.vehicle.mileage.toLocaleString('uk-UA')} км</p><p>VIN: {data.vehicle.vin||'Не вказано'}</p><small>Оновлено власником {new Date(data.created).toLocaleDateString('uk-UA')}. Дані внесені власником.</small></header><section className="dossier"><h2>Історія обслуговування</h2>{data.history.length?data.history.map((e,i)=><article className="catalog-event" key={i}><small>{e.date} · {e.mileage.toLocaleString('uk-UA')} км</small><h3>{e.title}</h3><strong>{e.amount.toLocaleString('uk-UA')} грн</strong></article>):<p>Історію ще не додано.</p>}</section><section className="dossier"><h2>Чеки, відкриті власником</h2>{data.documents.length?data.documents.map(d=><a className="receipt-choice" key={d.id} href={'/api/shared-car/'+token+'?document='+encodeURIComponent(d.id)}>{d.name} ↓</a>):<p>Власник не надав доступу до чеків.</p>}</section></>}</main>;
}
