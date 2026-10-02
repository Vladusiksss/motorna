import assert from 'node:assert/strict';
import {geocoderParameters,stationQuery,approximateDistance} from '../app/station-geography.ts';
for(const [city,lat,lon] of [['Львів',49.84,24.03],['Одеса',46.48,30.73],['Харків',49.99,36.23],['Ужгород',48.62,22.30],['Сімферополь',44.95,34.10]]){
 const p=geocoderParameters(city+' вулиця Центральна 1');
 assert.equal(p.get('countrycodes'),'ua');assert.equal(p.has('bounded'),false);assert.equal(p.has('viewbox'),false);
 const q=stationQuery(lat,lon);assert.ok(q.includes(`around:8000,${lat},${lon}`));assert.ok(q.includes('"ISO3166-1"="UA"'));assert.ok(!q.includes('UA-32'));
 assert.equal(approximateDistance({lat,lon},{lat,lon}),0);
 assert.ok(approximateDistance({lat,lon},{lat:lat+0.01,lon})>1);
}
console.log('PASS: nationwide geocoding, country scope, local radius, distance across latitudes');
const {uniqueAddresses,loadStationData}=await import('../app/station-geography.ts');
const a={lat:49,lon:25,precision:'building',label:'Тестова, 6А, Тестове'};
assert.equal(uniqueAddresses([a,{...a,lat:49.0001,label:'Тестова, 6-А, Тестове'}]).length,1);
assert.equal(uniqueAddresses([a,{...a,label:'Тестова, 6Б, Тестове'}]).length,2);
assert.equal(uniqueAddresses([a,{...a,lat:50}]).length,2);
const originalFetch=globalThis.fetch;let calls=0;
globalThis.fetch=async()=>++calls===1?new Response('Unavailable',{status:504}):Response.json({elements:[]});
assert.deepEqual(await loadStationData('https://example.com','test',{}),{elements:[]});assert.equal(calls,2);
globalThis.fetch=async()=>Response.json({elements:[],remark:'runtime error: Query timed out'});
await assert.rejects(loadStationData('https://example.com','test',{}),/INCOMPLETE/);
globalThis.fetch=originalFetch;
console.log('PASS: address aliases, distinct houses, retry, incomplete responses');
