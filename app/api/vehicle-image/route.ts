import {verifiedModelPhoto} from '@/app/verified-model-photos';
import {findWebModelPhotos} from '@/app/web-model-photos';
import {photoMatches,photoYearMatches,photoQuery,plain,type PhotoRequest} from '@/app/vehicle-photo-search';
export const dynamic='force-dynamic';
const cache=new Map<string,{at:number;photos:unknown[]}>();
export async function GET(request:Request){
 const url=new URL(request.url),p=Object.fromEntries(['make','model','year','body','color'].map(k=>[k,(url.searchParams.get(k)||'').trim()])) as PhotoRequest;
 if(!/^[\p{L}\p{N} .-]{1,50}$/u.test(p.make)||!/^[\p{L}\p{N} .-]{1,70}$/u.test(p.model)||!/^\d{4}$/.test(p.year)||!/^#[a-f0-9]{6}$/i.test(p.color)||!/^$|^(sedan|suv|wagon|hatch|coupe|convertible|pickup|van)$/.test(p.body))return Response.json({error:'Недостатньо даних авто',photos:[]},{status:400});
 const reviewed=verifiedModelPhoto(p);
 const key=JSON.stringify(p),hit=cache.get(key);if(hit&&Date.now()-hit.at<(hit.photos.length?86400000:60000))return Response.json({photos:hit.photos});
 const webPromise=findWebModelPhotos(p);
 try{
 const query=new URLSearchParams({action:'query',format:'json',generator:'search',gsrsearch:`${p.make} (${p.model} OR "${p.model.replace(/([A-Za-z])(\d)/g,'$1 $2')}") ${p.year}`,gsrnamespace:'6',gsrlimit:'24',prop:'imageinfo',iiprop:'url|extmetadata|mime',iiurlwidth:'960'});
 const response=await fetch('https://commons.wikimedia.org/w/api.php?'+query,{headers:{'User-Agent':'Motorna/1.0 (vehicle illustration lookup; local development)'},signal:AbortSignal.timeout(12000)});
 if(!response.ok)throw new Error('source');const data:any=await response.json();
 let photos:any[]=Object.values(data.query?.pages||{}).flatMap((page:any)=>{
 const info=page.imageinfo?.[0],meta=info?.extmetadata||{};
 if(!info||!/^image\/(jpeg|png|webp)$/.test(info.mime||''))return [];
 const description=plain(meta.ImageDescription?.value),text=[page.title,description,plain(meta.Categories?.value)].join(' ');
 if(!photoYearMatches(page.title+' '+description,p)||!photoMatches(text,p)||!photoMatches(page.title+' '+description,{...p,body:'',color:'#000000'}))return [];
 const license=plain(meta.LicenseShortName?.value),author=plain(meta.Artist?.value);
 if(!/CC BY|CC0|Public domain/i.test(license)||!author)return [];
 try{const image=new URL(info.thumburl||info.url),source=new URL(info.descriptionurl);if(image.protocol!=='https:'||!['upload.wikimedia.org','thumb.wikimedia.org'].includes(image.hostname)||source.protocol!=='https:'||source.hostname!=='commons.wikimedia.org')return [];
 return [{url:image.href,source:source.href,author,license,title:plain(page.title).replace(/^File:/,''),description,yearMentioned:text.includes(p.year)}];}catch{return [];}
 }).sort((a:any,b:any)=>Number(b.yearMentioned)-Number(a.yearMentioned)).slice(0,3);
 const web=await webPromise;photos=[...web.photos,...photos,...(reviewed?[reviewed]:[])].slice(0,3);
 if(cache.size>=200)cache.delete(cache.keys().next().value!);cache.set(key,{at:Date.now(),photos});return Response.json({photos},{headers:{'Cache-Control':'private, max-age=3600'}});
 }catch{const web=await webPromise;if(web.photos.length||reviewed)return Response.json({photos:web.photos.length?web.photos:[reviewed]});return Response.json({error:'Фото тимчасово недоступне',photos:[]},{status:503});}
}
