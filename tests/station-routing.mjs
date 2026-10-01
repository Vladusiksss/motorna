import assert from 'node:assert/strict';
import {directions,routeStations} from '../app/station-routing.ts';
const origin={lat:50.4,lon:30.5},shops=[{id:'A',lat:50.41,lon:30.51,distance:1},{id:'B',lat:50.42,lon:30.52,distance:2}];
const url=new URL(directions(origin,shops[0]));assert.equal(url.searchParams.get('origin'),'50.4,30.5');assert.equal(url.searchParams.get('destination'),'50.41,30.51');assert.equal(url.searchParams.get('travelmode'),'driving');
const original=globalThis.fetch;globalThis.fetch=async()=>Response.json({code:'Ok',distances:[[0,5000,3000]],durations:[[0,600,300]]});
const result=await routeStations(origin,shops);assert.equal(result[0].id,'B');assert.equal(result[0].roadDistance,3);assert.equal(result[0].minutes,5);
globalThis.fetch=async()=>{throw new Error('offline')};assert.equal((await routeStations(origin,shops))[0].roadDistance,null);
globalThis.fetch=async()=>Response.json({code:'Ok',distances:[[0,null,3000]],durations:[[0,null,300]]});assert.equal((await routeStations(origin,shops))[1].routeStatus,'unavailable');globalThis.fetch=original;
console.log('PASS: explicit origin, road distance sorting, unreachable and offline fallback');
if(process.argv.includes('--live')){const real=await routeStations(origin,shops);console.log('Live routing:',JSON.stringify(real));const r=await fetch('http://localhost:5173/api/stations',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({address:'Київ, Васильківська, 30'})});console.log('Live geocoder:',r.status,await r.text());}
