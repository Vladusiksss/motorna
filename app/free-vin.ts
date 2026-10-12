import type {VehicleInfo} from './vehicle-search';

function brand(value:string){return value.normalize('NFKD').replace(/\p{M}/gu,'').toUpperCase().replace(/[^A-Z0-9]/g,'');}
function text(value:unknown){return typeof value==='string'?value.trim().slice(0,120):'';}
export function mergeFreeVin(base:VehicleInfo,input:unknown):VehicleInfo{
 if(!input||typeof input!=='object'||Array.isArray(input))return base;
 const raw=input as Record<string,unknown>;
 const make=text(raw.brand),model=text(raw.model);
 if(text(raw.vin).toUpperCase()!==base.vin||!base.make||brand(make)!==brand(base.make)||!model)return base;
 const year=String(raw.year??'');
 if(!/^\d{4}$/.test(year)||Number(year)<1950||Number(year)>new Date().getFullYear()+1)return base;
 if(base.model&&brand(base.model)!==brand(model)||base.year&&base.year!==year)return base;
 // Listing-derived records are candidates, never factory/OEM verification.
 if(base.model&&base.year)return base;
 const extra=[['Модель',model],['Рік',year],['Паливо',text(raw.fuelType)],['Колір',text(raw.color)],['Кузов',text(raw.bodyType)],['Комплектація',text(raw.version)]];
 return {...base,model:base.model||model,year:base.year||year,fields:[...base.fields,...extra.filter(([label,value])=>value&&!base.fields.some(f=>f.label===label)).map(([label,value])=>({label,value}))],source:base.source+' + DB.VIN',needsConfirmation:true,warning:'Знайдено додаткові дані авто. Звірте модель, рік і комплектацію зі свідоцтвом про реєстрацію.'};
}
export async function enrichFreeVin(base:VehicleInfo):Promise<VehicleInfo>{
 if(base.model&&base.year)return base;
 try{
  const response=await fetch('https://db.vin/api/v1/vin/'+encodeURIComponent(base.vin),{headers:{Accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(6000)});
  if(!response.ok||!response.headers.get('content-type')?.includes('json'))return base;
  const body=await response.text();if(body.length>32000)return base;
  return mergeFreeVin(base,JSON.parse(body));
 }catch{return base;}
}
