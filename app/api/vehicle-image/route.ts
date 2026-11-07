import {lookupPublicModel} from '@/app/vehicle-intelligence/public-search';
import {dedupePhotos} from '@/app/vehicle-intelligence/contracts';
import {apiBoundary} from '@/app/api-response';
import {lookupCommons} from '@/app/vehicle-intelligence/providers';
import type {PhotoRequest} from '@/app/vehicle-photo-search';
export const dynamic='force-dynamic';
const cache=new Map<string,{at:number;photos:unknown[]}>();
export async function GET(request:Request){
 return apiBoundary(async()=>{

 const url=new URL(request.url),p=Object.fromEntries(['make','model','year','body','color'].map(k=>[k,(url.searchParams.get(k)||'').trim()])) as PhotoRequest;
 if(!/^[\p{L}\p{N} .-]{1,50}$/u.test(p.make)||!/^[\p{L}\p{N} .-]{1,70}$/u.test(p.model)||!/^\d{4}$/.test(p.year)||!/^#[a-f0-9]{6}$/i.test(p.color)||!/^$|^(sedan|suv|wagon|hatch|coupe|convertible|pickup|van)$/.test(p.body))return Response.json({error:'Недостатньо даних авто',photos:[]},{status:400});
 const key=JSON.stringify(p),hit=cache.get(key);if(hit&&Date.now()-hit.at<60000)return Response.json({photos:hit.photos});
 const results=await Promise.all([lookupPublicModel({vin:'',...p}),lookupCommons({vin:'',...p})]);
 const result={photos:dedupePhotos(results.flatMap(r=>r.photos)).slice(0,6)};
 if(cache.size>=100)cache.delete(cache.keys().next().value!);cache.set(key,{at:Date.now(),photos:result.photos});
 return Response.json({photos:result.photos});

 },"/api/vehicle-image",request);
}
