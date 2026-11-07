import {graph,object} from './json-graph';
import {decodeEntities,parseWebResults} from './vehicle-search';
export type ListingPhoto={url:string;source:string;host:string;title:string;vin:string;checkedAt:string};
const hosts=['auto.ria.com','rst.ua','avtopoisk.ua','bid.cars','stat.vin','autoauctionhistory.com'];
export function allowedListing(value:string){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&hosts.some(h=>u.hostname===h||u.hostname.endsWith('.'+h));}catch{return false;}}
export function listingLinks(html:string){
 const urls=parseWebResults(html).map(r=>r.url);
 for(const m of html.matchAll(/href=["']([^"']+)["']/g)){try{
  let u=new URL(decodeEntities(m[1]),'https://www.google.com');
  if(u.hostname==='www.google.com'&&u.pathname==='/url')u=new URL(u.searchParams.get('q')||u.searchParams.get('url')||'');
  else if(u.hostname==='duckduckgo.com'||u.hostname.endsWith('.duckduckgo.com'))u=new URL(u.searchParams.get('uddg')||'');
  if(allowedListing(u.href))urls.push(u.href);
 }catch{}}
 return [...new Set(urls)].filter(allowedListing).slice(0,4);
}
function safeImage(value:unknown,source:string){try{if(typeof value!=='string')return '';const u=new URL(decodeEntities(value),source);const trusted=[...hosts,'cdn.riastatic.com','riastatic.com','img.rst.ua','bidfax.info'];return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&trusted.some(h=>u.hostname===h||u.hostname.endsWith('.'+h))?u.href:'';}catch{return '';}}
function attributes(tag:string){return Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*["']([^"']*)["']/g)].map(m=>[m[1].toLowerCase(),decodeEntities(m[2])]));}
export function extractListingPhotos(html:string,source:string,vin:string):ListingPhoto[]{
 if(!allowedListing(source)||!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin))return [];
 const photos:ListingPhoto[]=[];let structuredVehicle=false;
 const add=(image:unknown,title:string)=>{const url=safeImage(image,source);if(url&&!photos.some(p=>p.url===url))photos.push({url,source,host:new URL(source).hostname,title:decodeEntities(title).replace(/<[^>]*>/g,'').slice(0,200),vin,checkedAt:new Date().toISOString()});};
 // Images must belong to the same structured vehicle as the exact VIN.
 for(const m of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){
 try{for(const item of graph(JSON.parse(m[1]))){if(![item['@type']].flat().some(t=>typeof t==='string'&&['Car','Vehicle','Product'].includes(t)))continue;
 structuredVehicle=true;if(String(item.vehicleIdentificationNumber||'').toUpperCase().trim()!==vin)continue;
 for(const image of [item.image].flat())add(typeof image==='string'?image:object(image).contentUrl||object(image).url,typeof item.name==='string'?item.name:'Оголошення про автомобіль');}}catch{}
 }
 if(photos.length||structuredVehicle)return photos.slice(0,8);
 // Fallback only for a detail page whose primary heading/title identifies the VIN.
 const meta=Object.fromEntries([...html.matchAll(/<meta\b[^>]*>/gi)].map(m=>{const a=attributes(m[0]);return [a.property||a.name||'',a.content||''];}));
 const heading=decodeEntities((html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1]||'').replace(/<[^>]*>/g,' '));
 const title=meta['og:title']||decodeEntities(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||'');
 const exact=new RegExp('(^|[^A-Z0-9])'+vin+'([^A-Z0-9]|$)','i');
 const path=new URL(source).pathname;
 if(!/search|\/car\/|\/catalog|\/category/i.test(path)&&exact.test(heading+' '+title))add(meta['og:image'],title);
 return photos;
}
async function readHtml(url:string,search=false,fetcher:typeof fetch=fetch,signal?:AbortSignal){
 let target=url;for(let hop=0;hop<3;hop++){
 if(!search&&!allowedListing(target))throw new Error('SOURCE_UNAVAILABLE');
 const r=await fetcher(target,{redirect:'manual',signal:signal?AbortSignal.any([signal,AbortSignal.timeout(7000)]):AbortSignal.timeout(7000),headers:{Accept:'text/html'}});
 if(r.status>=300&&r.status<400){const next=r.headers.get('location');if(!next||search)throw new Error('SOURCE_UNAVAILABLE');target=new URL(next,target).href;continue;}
 if(!r.ok||!r.headers.get('content-type')?.includes('text/html'))throw new Error('SOURCE_UNAVAILABLE');
 const reader=r.body?.getReader();if(!reader)throw new Error('SOURCE_UNAVAILABLE');let html='',size=0;const decoder=new TextDecoder();
 while(true){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>1000000){await reader.cancel();throw new Error('SOURCE_UNAVAILABLE');}html+=decoder.decode(part.value,{stream:true});}
 html+=decoder.decode();if(/challenge-form|anomaly\.js|cf-chl-|captcha/i.test(html))throw new Error('SOURCE_UNAVAILABLE');return {html,url:target};
 }throw new Error('SOURCE_UNAVAILABLE');
}
export async function findVinPhotos(vin:string,fetcher:typeof fetch=fetch,signal?:AbortSignal){
 const q=encodeURIComponent('"'+vin+'"');
 const searches=await Promise.allSettled(['https://html.duckduckgo.com/html/?q='+q,'https://www.google.com/search?q='+q].map(url=>readHtml(url,true,fetcher,signal)));
 const candidates=[...new Set(searches.flatMap(r=>r.status==='fulfilled'?listingLinks(r.value.html):[]))].slice(0,4);
 const results=await Promise.allSettled(candidates.map(async url=>{const page=await readHtml(url,false,fetcher,signal);return extractListingPhotos(page.html,page.url,vin);}));
 return {photos:results.flatMap(r=>r.status==='fulfilled'?r.value:[]).slice(0,12),partial:searches.some(r=>r.status==='rejected')||results.some(r=>r.status==='rejected')};
}
