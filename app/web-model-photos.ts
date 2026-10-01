import {photoMatches,photoYearMatches,photoQuery,plain,type PhotoRequest} from './vehicle-photo-search';
import {decodeEntities,parseWebResults} from './vehicle-search';
const sources=['auto.ria.com','carandclassic.com','autohelperbot.com','bid.cars','stat.vin','caranddriver.com','rst.ua','avtopoisk.ua','mobile.de','autoscout24.com','cars.com','autotrader.com'];
const images=[...sources,'riastatic.com','img.classistatic.com','carandclassic.com','hearstapps.com','carsbase.com','mobile.de','autoscout24.net','classistatic.de','img.rst.ua'];
function allowed(raw:string,hosts:string[]){try{const u=new URL(raw);return u.protocol==='https:'&&!u.port&&!u.username&&!u.password&&hosts.some(h=>u.hostname===h||u.hostname.endsWith('.'+h));}catch{return false;}}
export function photoSearchLinks(html:string){const links=parseWebResults(html).map(r=>r.url);for(const m of html.matchAll(/href=["']([^"']+)["']/g)){try{let u=new URL(decodeEntities(m[1]),'https://www.google.com');if(u.hostname==='www.google.com'&&u.pathname==='/url')u=new URL(u.searchParams.get('q')||u.searchParams.get('url')||'');if(allowed(u.href,sources))links.push(u.href);}catch{}}return [...new Set(links)].filter(u=>allowed(u,sources)).slice(0,6);}
async function read(url:string,search=false){let target=url;for(let hop=0;hop<3;hop++){if(!allowed(target,search?['www.google.com','html.duckduckgo.com']:sources))throw Error('source');const r=await fetch(target,{redirect:'manual',signal:AbortSignal.timeout(8000),headers:{Accept:'text/html'}});if(r.status>=300&&r.status<400){target=new URL(r.headers.get('location')||'',target).href;continue;}if(!r.ok)throw Error('source');const reader=r.body?.getReader();if(!reader)throw Error('source');let size=0,html='';const decoder=new TextDecoder();while(true){const v=await reader.read();if(v.done)break;size+=v.value.length;if(size>2500000){await reader.cancel();throw Error('size');}html+=decoder.decode(v.value,{stream:true});}html+=decoder.decode();if(/challenge-form|anomaly\.js|unusual traffic|\/sorry\//i.test(html))throw Error('search blocked');return {html,url:target};}throw Error('redirect');}
function graph(x:any):any[]{if(Array.isArray(x))return x.flatMap(graph);if(!x||typeof x!=='object')return [];return [x,...graph(x['@graph']),...graph(x.mainEntity)];}
export function extractModelPhotos(html:string,source:string,p:PhotoRequest){
 if(!allowed(source,sources))return [];
 const result:any[]=[];let structuredVehicle=false;
 for(const script of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){try{for(const item of graph(JSON.parse(script[1]))){if(![item['@type']].flat().some(t=>['Car','Vehicle','Product'].includes(t)))continue;structuredVehicle=true;
 const year=String(item.vehicleModelDate||item.modelDate||item.productionDate||'').slice(0,4);
 const name=plain(item.name),brand=plain(item.brand?.name||item.brand||''),model=plain(item.model?.name||item.model||'');
 const identity=[name,brand,model].join(' '),details=[identity,plain(item.color),plain(item.bodyType)].join(' ');
 if(!photoMatches(details,p)||!(year?year===p.year:photoYearMatches(name,p)))continue;
 for(const image of [item.image].flat()){const raw=typeof image==='string'?image:image?.contentUrl||image?.url;if(!raw)continue;const url=new URL(raw,source).href;if(!allowed(url,images))continue;result.push({url,source,host:new URL(source).hostname,title:name,author:new URL(source).hostname,license:'Фото зі сторінки оголошення',checkedAt:new Date().toISOString()});}
 }}catch{}}
 // Only the primary detail-page preview may be used, never images of related cars.
 if(!result.length&&!structuredVehicle&&!/search|catalog|category|gallery/i.test(new URL(source).pathname)){
  const meta:Record<string,string>={};
  for(const m of html.matchAll(/<meta\b[^>]*>/gi)){
   const attrs=Object.fromEntries([...m[0].matchAll(/([\w:-]+)\s*=\s*["']([^"']*)["']/g)].map(a=>[a[1].toLowerCase(),decodeEntities(a[2])]));
   meta[attrs.property||attrs.name||'']=attrs.content||'';
  }
  const title=plain(meta['og:title']),description=plain(meta['og:description']||meta.description);
  if(photoYearMatches(title,p)&&photoMatches(title+' '+description,p)&&meta['og:image']){
   try{const url=new URL(meta['og:image'],source).href;if(allowed(url,images))result.push({url,source,host:new URL(source).hostname,title,author:new URL(source).hostname,license:'Фото зі сторінки джерела',checkedAt:new Date().toISOString()});}catch{}
  }
 }
 return result.slice(0,3);
}
export function marketplaceQueries(p:PhotoRequest){
 const q=photoQuery(p);
 return [q+' (site:auto.ria.com OR site:rst.ua OR site:avtopoisk.ua)',q+' (site:mobile.de OR site:autoscout24.com OR site:carandclassic.com)',q+' for sale front'];
}
export async function findWebModelPhotos(p:PhotoRequest){
 const queries=marketplaceQueries(p);
 const jobs=queries.map(q=>'https://html.duckduckgo.com/html/?q='+encodeURIComponent(q));
 jobs.push('https://www.google.com/search?q='+encodeURIComponent(queries[0]));
 const searches=await Promise.allSettled(jobs.map(async url=>photoSearchLinks((await read(url,true)).html)));
 const urls=[...new Set(searches.flatMap(s=>s.status==='fulfilled'?s.value:[]))].slice(0,12);
 const pages=await Promise.allSettled(urls.map(async url=>{const page=await read(url);return extractModelPhotos(page.html,page.url,p);}));
 return {photos:pages.flatMap(r=>r.status==='fulfilled'?r.value:[]).slice(0,3),partial:searches.some(s=>s.status==='rejected')||pages.some(s=>s.status==='rejected')};
}
