import {decodeEntities,parseWebResults} from './vehicle-search';
export type MatchClass='exact_oem'|'confirmed_fitment'|'alternative_oem'|'similar'|'unverified';
export type ProductOffer={title:string;url:string;host:string;price?:number;currency?:string;checkedAt:string;availability:string;part:string;catalogNumbers?:string[];alternativeNumbers?:string[];brand?:string;matchClass:MatchClass};
export type SearchDiagnostics={sources:{id:string;status:'ok'|'error'|'blocked';searchPages:number;allowedDomains:number;checkedDomains?:string[];downloadedPages:number;productsDetected:number;pricedProducts:number;rejected:Record<string,number>}[]};
const sellers=['vag115.com.ua','autopartner.in.ua','renix.ua','evocar.ua','avto.pro','exist.ua','dok.ua','autodoc.ua','autoklad.ua','ukrparts.com.ua','avtochast.com.ua','atl.ua','rozetka.com.ua','prom.ua','epicentrk.ua','autodoc.co.uk','avtozvuk.ua','partly.com.ua'];
export type ProductSourceAdapter={id:string;domains:readonly string[];parse:(html:string,url:string,part:string,oem?:string)=>ProductOffer[]};
export const productSourceAdapters:readonly ProductSourceAdapter[]=sellers.map(domain=>({id:domain,domains:[domain],parse:extractOffers}));
export function allowedSeller(value:string){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&(!u.port||u.port==='443')&&sellers.some(h=>u.hostname===h||u.hostname.endsWith('.'+h));}catch{return false;}}
function normalize(v:string){return v.toLowerCase().replace(/ё/g,'е').replace(/стійк|стойк|тяга|тяги/g,'linkrod').replace(/стабіліз|стабилиз/g,'stabiliz').replace(/гальмівн|тормозн/g,'brake').replace(/колодк/g,'pad').replace(/амортизатор/g,'shock').replace(/[^\p{L}\p{N}]+/gu,' ').trim();}
export function matchesPart(title:string,part:string){for(const direction of [/(передн|front)/i,/(задн|rear)/i,/(лів|лев|left)/i,/(прав|right)/i]){if(direction.test(part)&&!direction.test(title))return false;}const hay=normalize(title);const words=normalize(part).split(' ').filter(w=>w.length>2&&!['передня','передній','задня','задній','ліва','права','для','авто'].includes(w));return words.length>0&&words.every(w=>hay.includes(/\d/.test(w)?w:w.slice(0,w.length>5?5:w.length)));}
export function headlightMismatch(title:string,part:string){
 const token=(s:string,words:string[])=>{const set=new Set((s.toLowerCase().match(/[\p{L}\p{N}]+/gu)||[]));return words.some(w=>set.has(w));};
 const checks:[string[],string[],string][]=[[['ліва','ліву','лівий','left'],['права','праву','правий','right'],'side'],[['права','праву','правий','right'],['ліва','ліву','лівий','left'],'side'],[['led'],['xenon','ксенон','halogen','галоген'],'light_type'],[['xenon','ксенон'],['led','halogen','галоген'],'light_type'],[['matrix'],['halogen','галоген','standard'],'light_type'],[['рестайл','facelift','fl'],['дорестайл','prefacelift'],'generation'],[['дорестайл','prefacelift'],['рестайл','facelift'],'generation'],[['eu','європ','european'],['us','usa','американ','nar'],'market'],[['us','usa','американ','nar'],['eu','європ','european'],'market'],[['adaptive','адаптив'],['nonadaptive','звичайна','standard'],'adaptive'],[['nonadaptive','звичайна'],['adaptive','адаптив'],'adaptive']];
 for(const [asked,opposite,reason] of checks)if(token(part,asked)&&token(title,opposite))return reason;
 return '';
}
function object(value:unknown):Record<string,unknown>{return value!==null&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};}
function nodes(value:unknown):Record<string,unknown>[]{if(Array.isArray(value))return value.flatMap(nodes);if(!value||typeof value!=='object')return [];const node=object(value);return [node,...nodes(node['@graph']),...nodes(node.mainEntity),...nodes(node.itemListElement),...nodes(node.item)];}
export function extractOffers(html:string,url:string,part:string,oem=''):ProductOffer[]{
 const offers:ProductOffer[]=[];
 for(const script of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){
  let roots:Record<string,unknown>[];try{roots=nodes(JSON.parse(script[1].trim()));}catch{continue;}
  for(const product of roots){
   if(![product['@type']].flat().includes('Product')||typeof product.name!=='string')continue;
   const properties=Array.isArray(product.additionalProperty)?product.additionalProperty.map(object):[];
   const catalogNumbers=[product.sku,product.mpn,...properties.filter(p=>/oem|oe number|артикул|каталож/i.test(typeof p.name==='string'?p.name:'')).map(p=>p.value)].filter((v):v is string=>typeof v==='string');
   const alternativeNumbers=properties.filter(p=>/cross|interchange|alternative|replacement|замін|аналог|крос.?номер/i.test(typeof p.name==='string'?p.name:'')).map(p=>p.value).filter((v):v is string=>typeof v==='string');
   const brandName=typeof product.brand==='string'?product.brand:object(product.brand).name;
   const brand=typeof brandName==='string'?brandName:undefined;
   const exact=!!oem&&matchesCatalogNumber({title:product.name,catalogNumbers,brand},oem);
   const alternative=!!oem&&alternativeNumbers.some(n=>matchesCatalogNumber({title:n,catalogNumbers:[n]},oem));
   const numberOnly=exact||alternative;
   if(!matchesPart(product.name,part)&&!numberOnly)continue;
   const productOffers=[product.offers].flat().filter(Boolean);let emitted=false;
   for(const value of productOffers){
    const offer=object(value),spec=object(offer.priceSpecification);
    if(offer['@type']==='AggregateOffer'||offer.lowPrice||offer.highPrice)continue;
    const price=Number(String(offer.price??spec.price??'').replace(/\s/g,'').replace(',','.'));
    const currency=String(offer.priceCurrency||spec.priceCurrency||'').toUpperCase();
    if(!Number.isFinite(price)||price<=0||price>10000000||!['UAH','EUR','USD','GBP'].includes(currency))continue;
    const link=offer.url||product.url;if(link!==undefined&&typeof link!=='string')continue;
    let target:string;try{target=link?new URL(link,url).href:url;}catch{continue;}
    if(!allowedSeller(target)||new URL(target).hostname!==new URL(url).hostname)continue;
    const availability=typeof offer.availability==='string'?offer.availability:'';
    offers.push({title:decodeEntities(product.name).slice(0,500),url:target,host:new URL(target).hostname,price,currency,availability:/OutOfStock|Discontinued|SoldOut/.test(availability)?'Немає в наявності':/InStock/.test(availability)?'Є в наявності':'Наявність уточнюйте',checkedAt:new Date().toISOString(),part,brand,catalogNumbers,alternativeNumbers,matchClass:exact?'exact_oem':alternative?'alternative_oem':'similar'});emitted=true;
   }
   if(!emitted&&!offers.some(o=>o.url===url)&&allowedSeller(url))offers.push({title:decodeEntities(product.name).slice(0,500),url,host:new URL(url).hostname,availability:'Ціну уточнюйте',checkedAt:new Date().toISOString(),part,brand,catalogNumbers,alternativeNumbers,matchClass:exact?'exact_oem':alternative?'alternative_oem':'unverified'});
  }
 }
 const title=decodeEntities((html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1]||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim());
 if(!offers.length&&(oem?matchesCatalogNumber({title},oem):matchesPart(title,part))){
  let price=0,currency='';
  const priceTag=html.match(/<[^>]+itemprop=["']price["'][^>]*>([\s\S]*?)<\//i)||html.match(/<meta[^>]+(?:property|name)=["'](?:product:price:amount|og:price:amount|twitter:data1)["'][^>]+content=["']([\d., ]+)/i);
  if(priceTag){const content=priceTag[0].match(/content=["']([\d., ]+)["']/i)?.[1];price=Number((content||priceTag[1].replace(/<[^>]*>/g,'')).replace(/\s/g,'').replace(',','.'));currency=html.match(/itemprop=["']priceCurrency["'][^>]*content=["']([A-Z]{3})["']/i)?.[1]||'';}
  if(new URL(url).hostname==='autopartner.in.ua'&&/^\/part-/.test(new URL(url).pathname)){
   const main=html.match(/Краща ціна\s*<span><span>([\d., ]+)<\/span>\s*грн/i);if(main){price=Number(main[1].replace(/\s/g,'').replace(',','.'));currency='UAH';}
  }
  const pagePrice=price>0&&price<10000000&&['UAH','EUR','USD','GBP'].includes(currency);
  const exact=!!oem&&matchesCatalogNumber({title},oem);
  if(pagePrice||allowedSeller(url))offers.push({title:title||oem||part,url,host:new URL(url).hostname,...(pagePrice?{price,currency}:{}),availability:'Наявність уточнюйте',checkedAt:new Date().toISOString(),part,matchClass:exact?'exact_oem':'unverified'});
 }
 return offers;
}
type Counters={downloadedPages:number;productsDetected:number;pricedProducts:number;rejected:Record<string,number>};
function reject(c:Counters,reason:string){c.rejected[reason]=(c.rejected[reason]||0)+1;}
async function readProduct(url:string,part:string,follow=true,oem='',c:Counters):Promise<ProductOffer[]>{
 try{if(!allowedSeller(url)){reject(c,'domain_not_allowed');return [];}let target=url;
 for(let hop=0;hop<3;hop++){
  const r=await fetch(target,{redirect:'manual',signal:AbortSignal.timeout(9000),headers:{Accept:'text/html'}});
  if(r.status>=300&&r.status<400){const location=r.headers.get('location');if(!location){reject(c,'redirect_without_location');return [];}target=new URL(location,target).href;if(!allowedSeller(target)){reject(c,'redirect_domain_denied');return [];}continue;}
  if(!r.ok){reject(c,'http_error');return [];}if(!r.headers.get('content-type')?.includes('text/html')){reject(c,'not_html');return [];}
  const reader=r.body?.getReader();if(!reader){reject(c,'empty_body');return [];}const decoder=new TextDecoder();let html='',size=0;
  while(true){const item=await reader.read();if(item.done)break;size+=item.value.length;if(size>2500000){await reader.cancel();reject(c,'page_too_large');return [];}html+=decoder.decode(item.value,{stream:true});}
  html+=decoder.decode();c.downloadedPages++;const sourceAdapter=productSourceAdapters.find(a=>a.domains.some(d=>new URL(target).hostname===d||new URL(target).hostname.endsWith('.'+d)));const found=sourceAdapter?.parse(html,target,part,oem)||[];c.productsDetected+=found.length;c.pricedProducts+=found.filter(x=>x.price!==undefined).length;if(found.length||!follow)return found;
  const links:{url:string;title:string}[]=[];
  for(const a of html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)){
   const linkTitle=decodeEntities(a[2].replace(/<[^>]*>/g,' '));if(!(oem?matchesCatalogNumber({title:linkTitle},oem):matchesPart(linkTitle,part)))continue;
   const candidate=new URL(decodeEntities(a[1]),target).href;
   if(candidate!==target&&allowedSeller(candidate)&&new URL(candidate).hostname===new URL(target).hostname&&!links.some(x=>x.url===candidate))links.push({url:candidate,title:decodeEntities(a[2].replace(/<[^>]*>/g,' ')).replace(/\s+/g,' ').trim()});
   if(links.length>=2)break;
  }
  return (await Promise.all(links.map(async link=>(await readProduct(link.url,part,false,oem,c)).map(offer=>({...offer,title:link.title.length>offer.title.length?link.title:offer.title}))))).flat();
 }
 }catch(error){reject(c,error instanceof DOMException&&error.name==='TimeoutError'?'timeout':'fetch_error');return [];}return [];
}
export async function findOffers(vehicle:string,part:string,model='',oem=''){
 const base=(oem?`${oem} ${part}`:part)+' '+[vehicle,model].filter(Boolean).join(' ');
 const queries=[`${oem||''} ${part} купити Україна`,`${part} ${model} ${vehicle.match(/\b(?:19|20)\d{2}\b/)?.[0]||''} ${vehicle.match(/\b\d[.,]\d\s*(?:л|l|tdi|diesel|дизел)\b/i)?.[0]||''} купити`,base].map(q=>q.replace(/\s+/g,' ').trim()).filter((q,i,a)=>q&&a.indexOf(q)===i).slice(0,3);
 const source:SearchDiagnostics['sources'][number]={id:'DuckDuckGo public search',status:'ok',searchPages:0,allowedDomains:sellers.length,checkedDomains:[],downloadedPages:0,productsDetected:0,pricedProducts:0,rejected:{}};
 const counters:Counters=source;
 const candidates=new Map<string,{url:string}>();
 for(const query of queries){try{const r=await fetch('https://html.duckduckgo.com/html/?q='+encodeURIComponent(query),{signal:AbortSignal.timeout(12000),headers:{Accept:'text/html'}});const html=await r.text();source.searchPages++;if(!r.ok||/anomaly.js|challenge-form/.test(html)){reject(counters,'search_blocked_or_http_error');continue;}for(const item of parseWebResults(html)){if(allowedSeller(item.url)){const host=new URL(item.url).hostname;source.checkedDomains=Array.from(new Set([...(source.checkedDomains||[]),host])).slice(0,30);const clean=offerIdentity(item.url);candidates.set(clean,{url:item.url});}else reject(counters,'search_domain_denied');}}catch(error){source.status='error';reject(counters,error instanceof DOMException&&error.name==='TimeoutError'?'search_timeout':'search_error');}}
 const selected=[...candidates.values()].slice(0,12);
 const settled=await Promise.allSettled(selected.map(r=>readProduct(r.url,part,true,oem,counters)));
 for(const item of settled)if(item.status==='rejected')reject(counters,'product_fetch_rejected');
 let results=settled.flatMap(x=>x.status==='fulfilled'?x.value:[]);
 results=results.filter(r=>{const headlightReason=headlightMismatch(r.title,part);if(headlightReason){reject(counters,'headlight_'+headlightReason);return false;}if(oem){if(matchesCatalogNumber(r,oem)){r.matchClass='exact_oem';return true;}if(r.alternativeNumbers?.some(n=>matchesCatalogNumber({title:n,catalogNumbers:[n]},oem))){r.matchClass='alternative_oem';return true;}if(matchesPart(r.title,part)&&matchesVehicle(r.title,vehicle,model)){r.matchClass='similar';reject(counters,'similar_without_oem_confirmation');return true;}reject(counters,'oem_mismatch');return false;}if(!matchesPart(r.title,part)){reject(counters,'part_mismatch');return false;}if(!matchesVehicle(r.title,vehicle,model)){reject(counters,'vehicle_mismatch');return false;}return true;});
 const unique=Array.from(new Map(results.map(r=>[offerIdentity(r.url),r])).values());
 const diagnostics:SearchDiagnostics={sources:[source]};
 // Count-only telemetry: never include query text, VIN, account identifiers, URLs or response bodies.
 console.info(JSON.stringify({event:'part_search_complete',source:source.id,searchPages:source.searchPages,allowedDomains:source.allowedDomains,downloadedPages:source.downloadedPages,productsDetected:source.productsDetected,pricedProducts:source.pricedProducts}));
 return {query:queries.length,results:unique.sort((a,b)=>Number(b.matchClass==='exact_oem')-Number(a.matchClass==='exact_oem')||Number(b.matchClass==='alternative_oem')-Number(a.matchClass==='alternative_oem')||(a.price??Infinity)-(b.price??Infinity)).slice(0,20),diagnostics};
}

export function offerIdentity(url:string){const u=new URL(url);if(u.hostname==='prom.ua')u.pathname=u.pathname.replace(/^\/(?:ua|ru)\//,'/');u.search='';u.hash='';return u.href;}

export function matchesVehicle(title:string,vehicle:string,model:string){
 const words=(model||vehicle.split(' ').slice(1,2).join(' ')).toLowerCase().split(/\s+/).filter(w=>w.length>1&&!/^\d{4}$/.test(w));
 if(words.length&&!words.every(w=>title.toLowerCase().includes(w)))return false;
 // Compare explicit platform/generation markers when either side supplies one.
 const platformPattern=/(?:^|[\s(])([CcСсBbВв][3-9]|4[FGH]|8[KWT])(?=[\s),/]|$)/g;
 const platforms=Array.from(title.matchAll(platformPattern),m=>m[1].toUpperCase().replace(/С/g,'C').replace(/В/g,'B'));
 const vehicleCodes=Array.from(vehicle.toUpperCase().replace(/С/g,'C').replace(/В/g,'B').matchAll(platformPattern),m=>m[1].toUpperCase().replace(/С/g,'C').replace(/В/g,'B'));
 if(platforms.length&&(!vehicleCodes.length||!platforms.some(code=>vehicleCodes.includes(code))))return false;
 // Reject an explicitly incompatible model generation (e.g. A6 C5 for A6 C7).
 if(words.length===1){
  const escaped=words[0].replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const generationPattern=new RegExp('\\b'+escaped+'\\s+(?:mk\\s*)?([ivx]{1,5}|[1-9])(?:\\s|[,(]|$)','ig');
  const advertised=Array.from(title.matchAll(generationPattern),m=>m[1].toUpperCase());
  const expected=vehicle.match(new RegExp('\\b'+escaped+'\\s+(?:mk\\s*)?([ivx]{1,5}|[1-9])(?:\\s|[,(]|$)','i'))?.[1]?.toUpperCase();
  if(advertised.length&&(!expected||!advertised.includes(expected)))return false;
 }
 const year=Number(vehicle.match(/\b(?:19|20)\d{2}\b/)?.[0]);
 const litres=Number(vehicle.match(/\b([1-9][.,]\d)\s*(?:л|l|tdi|tsi|tfsi|cdi|dci|hdi)(?![\p{L}\p{N}])/iu)?.[1]?.replace(',','.'));
 const engineRanges=Array.from(title.matchAll(/\b([1-9][.,]\d)\s*[-–]\s*([1-9][.,]\d)(?!\d)/g));
 if(litres&&engineRanges.length&&!engineRanges.some(r=>litres>=Number(r[1].replace(',','.'))&&litres<=Number(r[2].replace(',','.'))))return false;
 const titleDiesel=/\b(?:diesel|tdi|cdi|dci|hdi|td)\b|дизел/i.test(title),titlePetrol=/gasoline|petrol|бензин/i.test(title);
 if(/gasoline|petrol|бензин/i.test(vehicle)&&titleDiesel&&!titlePetrol)return false;
 if(/diesel|дизел/i.test(vehicle)&&titlePetrol&&!titleDiesel)return false;
 const ranges=Array.from(title.matchAll(/\b((?:19|20)\d{2})\s*[-–]\s*((?:19|20)\d{2})\b/g));
 if(year&&ranges.length&&!ranges.some(r=>year>=Number(r[1])&&year<=Number(r[2])))return false;
 const shortRanges=Array.from(title.matchAll(/\b(\d{2})\s*[-–]\s*(\d{2})(?:\b|г|р)/g));
 const full=(n:string)=>Number(n)>30?1900+Number(n):2000+Number(n);
 const openYears=Array.from(title.matchAll(/\b((?:19|20)\d{2}|\d{2})\s*[-–](?=\s*(?:[,)]|$))/g));
 // A standalone model year is also a hard fitment constraint, not a hint.
 const openYearValues=new Set(openYears.map(r=>r[1].length===4?Number(r[1]):full(r[1])));
 const yearMentions=Array.from(title.matchAll(/\b((?:19|20)\d{2})\b/g),m=>Number(m[1])).filter(y=>!openYearValues.has(y));
 if(year&&ranges.length===0&&yearMentions.length&&!yearMentions.includes(year))return false;
 if(year&&openYears.length&&!openYears.some(r=>year>=(r[1].length===4?Number(r[1]):full(r[1]))))return false;
 if(year&&!ranges.length&&shortRanges.length&&!shortRanges.some(r=>year>=full(r[1])&&year<=full(r[2])))return false;
 // Explicit engine displacement / fuel family in the listing must agree with the car.
 const vehicleLitres=vehicle.match(/\b([1-9][.,]\d)\s*(?:л|l|tdi|tsi|tfsi|cdi|dci|hdi)(?![\p{L}\p{N}])/iu)?.[1]?.replace(',','.');
 const listingLitres=Array.from(title.matchAll(/\b([1-9][.,]\d)\s*(?:л|l|tdi|tsi|tfsi|cdi|dci|hdi)\b/gi),m=>m[1].replace(',','.'));
 if(vehicleLitres&&listingLitres.length&&!listingLitres.includes(vehicleLitres))return false;
 return true;
}

export function matchesCatalogNumber(offer:Pick<ProductOffer,'title'|'catalogNumbers'|'brand'>,number:string){
 const clean=(v:string)=>v.toUpperCase().replace(/[^A-Z0-9]/g,'');
 const parsed=parseCatalogInput(number);
 if(parsed.brand&&!new RegExp('(?:^|[^A-Z0-9])'+parsed.brand+'(?:$|[^A-Z0-9])','i').test([offer.title,offer.brand].filter(Boolean).join(' ')))return false;
 const wanted=clean(parsed.number);if(wanted.length<4)return false;
 if(offer.catalogNumbers?.some(n=>clean(n)===wanted))return true;
 // Exact token boundaries, optional printed separators; never match a prefix.
 const pattern=wanted.split('').join('[ .-]*');
 return new RegExp('(?:^|[^A-Z0-9])'+pattern+'(?![A-Z0-9]|[ .-]+[A-Z0-9]{1,3}(?![A-Z0-9]))','i').test(offer.title.replace(/\b(?:TRW|BOSCH|BREMBO|ATE|TEXTAR|FERODO|MANN|MAHLE|DENSO|NGK|SKF|SACHS|MONROE|KYB|FEBI|INA|LUK)\b/gi,' '));
}


export function parseCatalogInput(input:string){
 const brands=/\b(TRW|BOSCH|BREMBO|ATE|TEXTAR|FERODO|MANN|MAHLE|DENSO|NGK|SKF|SACHS|MONROE|KYB|FEBI|INA|LUK)\b/i;
 const brand=input.match(brands)?.[1].toUpperCase()||'';
 return {number:input.replace(brands,'').trim(),brand};
}
