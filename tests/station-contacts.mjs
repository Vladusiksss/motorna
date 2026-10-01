import assert from 'node:assert/strict';
import {stationContacts} from '../app/station-contacts.ts';
const c=stationContacts({phone:'067 123 45 67; +380 (50) 765-43-21','contact:phone':'+380671234567',opening_hours:'Mo-Fr 09:00-18:00; Sa 10:00-15:00; Su off'});
assert.deepEqual(c.phones,['+380671234567','+380507654321']);assert.ok(c.hours.includes('Пн-Пт'));assert.ok(c.hours.includes('Нд зачинено'));assert.equal(stationContacts({opening_hours:'24/7'}).hours,'Цілодобово, щодня');assert.deepEqual(stationContacts({phone:'немає'}).phones,[]);console.log('PASS: separate dialable numbers, deduplication, Ukrainian hours, missing data');
const r=await fetch('http://localhost:5173/api/stations',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({lat:50.5153393,lon:30.7786693})});const d=await r.json();console.log(r.status,JSON.stringify(d.stations?.map(s=>({name:s.name,phones:s.phones,hours:s.hours,source:s.sourceUrl}))||d));
