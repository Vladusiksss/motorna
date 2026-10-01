export type PhotoRequest={make:string;model:string;year:string;body:string;color:string};
export const colorNames:Record<string,string>={'#20232a':'black','#e8e9e7':'white','#195cb2':'blue','#74b9da':'light blue','#737b85':'grey','#b8c2cd':'silver','#b52230':'red','#287052':'green','#e8ba25':'yellow','#725240':'brown','#cfb999':'beige','#de782f':'orange','#75508c':'purple'};
const bodies:Record<string,string>={sedan:'sedan',suv:'SUV',wagon:'wagon',hatch:'sportback OR hatchback OR liftback',coupe:'coupe',convertible:'convertible',pickup:'pickup',van:'van'};
export const plain=(value:unknown)=>String(value||'').replace(/<[^>]*>/g,'').replace(/&amp;/g,'&').replace(/&quot;/g,'"').trim().slice(0,1200);
const words=(s:string)=>s.toLowerCase().replace(/\bmercedes[ -]?benz\b/g,'mercedes benz').replace(/\bvw\b/g,'volkswagen').replace(/([a-z])\s+(\d)/g,'$1$2').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
function contains(text:string,term:string){return (' '+words(text)+' ').includes(' '+words(term)+' ');}
// Require a model-year label, not an upload/photography date or a broad category.
export function photoYearMatches(text:string,p:PhotoRequest){
 if(!/^(19|20)\d{2}$/.test(p.year))return false;
 const cleaned=text.replace(/\b(?:19|20)\d{2}[-/.]\d{1,2}[-/.]\d{1,2}\b/g,'').replace(/(?:photographed|taken|uploaded|copyright|photo|撮影)\s*(?:in|on|©)?\s*(?:19|20)\d{2}/gi,'');
 const normalized=words(cleaned),model=words(p.model).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 const year=p.year;
 return new RegExp('(?:^| )'+year+' '+words(p.make)+' '+model+'(?: |$)').test(normalized)
  ||new RegExp('(?:^| )'+model+' (?:sportback |hatchback |sedan |coupe |avant )?(?:model year |my )?'+year+'(?: |$)').test(normalized);
}
export function photoMatches(text:string,p:PhotoRequest){
 if(!contains(text,p.make)||!contains(text,p.model))return false;
 if(/interior|engine bay|dashboard|steering wheel|logo|badge|scale model|toy car/i.test(text))return false;
 const color=colorNames[p.color];if(color&&!contains(text,color)&&!(color==='grey'&&contains(text,'gray')))return false;
 const re:Record<string,RegExp>={sedan:/sedan|saloon/i,suv:/suv|sport utility|crossover|off.road/i,wagon:/wagon|estate|avant|touring/i,hatch:/hatchback|liftback|sportback/i,coupe:/coupe|coupé/i,convertible:/convertible|cabriolet|roadster/i,pickup:/pickup|pick.up/i,van:/\bvan\b|minivan/i};
 return !p.body||!!re[p.body]?.test(text);
}
export function photoQuery(p:PhotoRequest){return `${p.make} ${p.model.replace(/([A-Za-z])\s+(\d)/g,'$1$2')} ${colorNames[p.color]||''} ${p.body==='hatch'?'(sportback OR hatchback OR liftback)':bodies[p.body]||''} ${p.year}`;}
