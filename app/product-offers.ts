import {decodeEntities,parseWebResults} from './vehicle-search';
export type ProductOffer={title:string;url:string;host:string;price:number;currency:string;checkedAt:string;availability:string;part:string;catalogNumbers?:string[]};
const sellers=['vag115.com.ua','autopartner.in.ua','renix.ua','evocar.ua','avto.pro','exist.ua','dok.ua','autodoc.ua','autoklad.ua','ukrparts.com.ua','avtochast.com.ua','atl.ua','rozetka.com.ua','prom.ua','epicentrk.ua','autodoc.co.uk'];
export function allowedSeller(value:string){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&(!u.port||u.port==='443')&&sellers.some(h=>u.hostname===h||u.hostname.endsWith('.'+h));}catch{return false;}}
function normalize(v:string){return v.toLowerCase().replace(/ё/g,'е').replace(/стійк|стойк|тяга|тяги/g,'linkrod').replace(/стабіліз|стабилиз/g,'stabiliz').replace(/гальмівн|тормозн/g,'brake').replace(/колодк/g,'pad').replace(/амортизатор/g,'shock').replace(/[^\p{L}\p{N}]+/gu,' ').trim();}
export function matchesPart(title:string,part:string){for(const direction of [/(передн|front)/i,/(задн|rear)/i,/(лів|лев|left)/i,/(прав|right)/i]){if(direction.test(part)&&!direction.test(title))return false;}const hay=normalize(title);const words=normalize(part).split(' ').filter(w=>w.length>2&&!['передня','передній','задня','задній','ліва','права','для','авто'].includes(w));return words.length>0&&words.every(w=>hay.includes(/\d/.test(w)?w:w.slice(0,w.length>5?5:w.length)));}
function nodes(value:any):any[]{if(Array.isArray(value))return value.flatMap(nodes);if(!value||typeof value!=='object')return [];return [value,...(value['@graph']?nodes(value['@graph']):[]),...(value.mainEntity?nodes(value.mainEntity):[]),...(value.itemListElement?nodes(value.itemListElement):[]),...(value.item?nodes(value.item):[])];}
export function extractOffers(html:string,url:string,part:string,oem=''):ProductOffer[]{
 const offers:ProductOffer[]=[];
 for(const script of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){
  let roots:any[];try{roots=nodes(JSON.parse(script[1].trim()));}catch{continue;}
  for(const product of roots){
   if(![product['@type']].flat().includes('Product')||typeof product.name!=='string')continue;
   const catalogNumbers=[product.sku,product.mpn,...(Array.isArray(product.additionalProperty)?product.additionalProperty.filter((p:any)=>/oem|oe number|артикул|каталож/i.test(p.name||'')).map((p:any)=>p.value):[])].filter((v:any)=>typeof v==='string');
   const numberOnly=!!oem&&part===oem&&matchesCatalogNumber({title:product.name,catalogNumbers},oem);
   if(!matchesPart(product.name,part)&&!numberOnly)continue;
   for(const offer of [product.offers].flat().filter(Boolean)){
    if(offer['@type']==='AggregateOffer'||offer.lowPrice||offer.highPrice)continue;
    const price=Number(String(offer.price??offer.priceSpecification?.price??'').replace(/\s/g,'').replace(',','.'));
    const currency=String(offer.priceCurrency||offer.priceSpecification?.priceCurrency||'').toUpperCase();
    if(!Number.isFinite(price)||price<=0||price>10000000||!['UAH','EUR','USD','GBP'].includes(currency))continue;
    const target=offer.url||product.url?new URL(offer.url||product.url,url).href:url;if(!allowedSeller(target)||new URL(target).hostname!==new URL(url).hostname)continue;
    offers.push({title:decodeEntities(product.name).slice(0,500),url:target,host:new URL(target).hostname,price,currency,availability:/OutOfStock|Discontinued|SoldOut/.test(offer.availability||'')?'Немає в наявності':/InStock/.test(offer.availability||'')?'Є в наявності':'Наявність уточнюйте',checkedAt:new Date().toISOString(),part,catalogNumbers:[product.sku,product.mpn,...(Array.isArray(product.additionalProperty)?product.additionalProperty.filter((p:any)=>/oem|oe number|артикул|каталож/i.test(p.name||'')).map((p:any)=>p.value):[])].filter((v:any)=>typeof v==='string')});
   }
  }
 }
 const title=decodeEntities((html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1]||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim());
 if(!offers.length&&matchesPart(title,part)){
  let price=0,currency='';
  const priceTag=html.match(/<[^>]+itemprop=["']price["'][^>]*>([\s\S]*?)<\//i);
  if(priceTag){const content=priceTag[0].match(/content=["']([\d., ]+)["']/i)?.[1];price=Number((content||priceTag[1].replace(/<[^>]*>/g,'')).replace(/\s/g,'').replace(',','.'));currency=html.match(/itemprop=["']priceCurrency["'][^>]*content=["']([A-Z]{3})["']/i)?.[1]||'';}
  if(new URL(url).hostname==='autopartner.in.ua'&&/^\/part-/.test(new URL(url).pathname)){
   const main=html.match(/Краща ціна\s*<span><span>([\d., ]+)<\/span>\s*грн/i);if(main){price=Number(main[1].replace(/\s/g,'').replace(',','.'));currency='UAH';}
  }
  if(price>0&&price<10000000&&['UAH','EUR','USD','GBP'].includes(currency))offers.push({title,url,host:new URL(url).hostname,price,currency,availability:'Наявність уточнюйте',checkedAt:new Date().toISOString(),part});
 }
 return offers;
}
async function readProduct(url:string,part:string,follow=true,oem=''):Promise<ProductOffer[]>{
 try{if(!allowedSeller(url))return [];let target=url;
 for(let hop=0;hop<3;hop++){
  const r=await fetch(target,{redirect:'manual',signal:AbortSignal.timeout(9000),headers:{Accept:'text/html'}});
  if(r.status>=300&&r.status<400){const location=r.headers.get('location');if(!location)return [];target=new URL(location,target).href;if(!allowedSeller(target))return [];continue;}
  if(!r.ok||!r.headers.get('content-type')?.includes('text/html'))return [];
  const reader=r.body?.getReader();if(!reader)return [];const decoder=new TextDecoder();let html='',size=0;
  while(true){const item=await reader.read();if(item.done)break;size+=item.value.length;if(size>2500000){await reader.cancel();return [];}html+=decoder.decode(item.value,{stream:true});}
  html+=decoder.decode();const found=extractOffers(html,target,part,oem);if(found.length||!follow)return found;
  const links:{url:string;title:string}[]=[];
  for(const a of html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)){
   if(!matchesPart(decodeEntities(a[2].replace(/<[^>]*>/g,' ')),part))continue;
   const candidate=new URL(decodeEntities(a[1]),target).href;
   if(candidate!==target&&allowedSeller(candidate)&&new URL(candidate).hostname===new URL(target).hostname&&!links.some(x=>x.url===candidate))links.push({url:candidate,title:decodeEntities(a[2].replace(/<[^>]*>/g,' ')).replace(/\s+/g,' ').trim()});
   if(links.length>=2)break;
  }
  return (await Promise.all(links.map(async link=>(await readProduct(link.url,part,false,oem)).map(offer=>({...offer,title:link.title.length>offer.title.length?link.title:offer.title}))))).flat();
 }
 }catch{}return [];
}
export async function findOffers(vehicle:string,part:string,model='',oem=''){
 const query=(oem?`${oem} ${part===oem?'':part} купити ціна Україна`:`${vehicle} ${part} купити ціна Київ`).replace(/\s+/g,' ').trim();
 const r=await fetch('https://html.duckduckgo.com/html/?q='+encodeURIComponent(query),{signal:AbortSignal.timeout(18000),headers:{Accept:'text/html'}});const html=await r.text();if(!r.ok||/anomaly.js|challenge-form/.test(html))throw new Error('SEARCH_UNAVAILABLE');
 const candidates=parseWebResults(html).filter(r=>allowedSeller(r.url)).slice(0,8);
 const results=(await Promise.all(candidates.map(r=>readProduct(r.url,part,true,oem)))).flat().filter(r=>oem?matchesCatalogNumber(r,oem):matchesVehicle(r.title,vehicle,model));
 return {query,results:Array.from(new Map(results.map(r=>[r.url,r])).values()).sort((a,b)=>a.currency.localeCompare(b.currency)||a.price-b.price).slice(0,20)};
}

export function matchesVehicle(title:string,vehicle:string,model:string){
 const words=(model||vehicle.split(' ').slice(1,2).join(' ')).toLowerCase().split(/\s+/).filter(w=>w.length>1&&!/^\d{4}$/.test(w));
 if(words.length&&!words.every(w=>title.toLowerCase().includes(w)))return false;
 // Do not substitute an explicitly different generation when the VIN source has no generation.
 if(words.length===1){const escaped=words[0].replace(/[.*+?^${}()|[\]\\]/g,'\\$&');const generation=title.match(new RegExp('\\b'+escaped+'\\s+(?:mk\\s*)?([ivx]{1,5}|[1-9])(?:\\s|[,(]|$)','i'));if(generation)return false;}
 // A platform explicitly advertised by a seller must also be present in vehicle data.
 const platforms=Array.from(title.matchAll(/(?:^|[\s(])([CcСсBbВв][3-9]|4[FGH]|8[KWT])(?=[\s),/]|$)/g)).map(m=>m[1].toUpperCase().replace(/С/g,'C').replace(/В/g,'B'));
 const vehicleCodes=vehicle.toUpperCase().replace(/С/g,'C').replace(/В/g,'B').split(/[^A-Z0-9]+/);
 if(platforms.length&&!platforms.some(code=>vehicleCodes.includes(code)))return false;
 const year=Number(vehicle.match(/\b(?:19|20)\d{2}\b/)?.[0]);
 const ranges=Array.from(title.matchAll(/\b((?:19|20)\d{2})\s*[-–]\s*((?:19|20)\d{2})\b/g));
 if(year&&ranges.length&&!ranges.some(r=>year>=Number(r[1])&&year<=Number(r[2])))return false;
 const shortRanges=Array.from(title.matchAll(/\b(\d{2})\s*[-–]\s*(\d{2})(?:\b|г|р)/g));
 const full=(n:string)=>Number(n)>30?1900+Number(n):2000+Number(n);
 if(year&&!ranges.length&&shortRanges.length&&!shortRanges.some(r=>year>=full(r[1])&&year<=full(r[2])))return false;
 return true;
}

export function matchesCatalogNumber(offer:Pick<ProductOffer,'title'|'catalogNumbers'>,number:string){
 const clean=(v:string)=>v.toUpperCase().replace(/[^A-Z0-9]/g,'');
 const wanted=clean(number);if(wanted.length<4)return false;
 if(offer.catalogNumbers?.some(n=>clean(n)===wanted))return true;
 // Exact token boundaries, optional printed separators; never match a prefix.
 const pattern=wanted.split('').join('[ .-]*');
 return new RegExp('(?:^|[^A-Z0-9])'+pattern+'(?![A-Z0-9]|[ .-]+[A-Z0-9]{1,3}(?![A-Z0-9]))','i').test(offer.title);
}

