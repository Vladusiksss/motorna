export type CatalogVehicle={type:string;mark:string;model:string;modification:string;criteria?:string;criteriaURI?:string;modelName?:string;title?:string;parameters?:{name:string;value:string}[]};
export function catalogPath(v:CatalogVehicle,segments:string[]=[]){
 const path=[v.type,v.mark,v.model,v.modification,...segments];
 if(path.some(x=>!x||x==='.'||x==='..'||x.length>500))throw Error('INVALID_CATALOG');
 const criteria=v.criteriaURI?decodeURIComponent(v.criteriaURI):v.criteria;
 return '/api/catalogs/'+path.map(encodeURIComponent).join('/')+(criteria?'?'+new URLSearchParams({criteria}):'');
}
export async function acatRequest(path:string,token=process.env.AUTODEALER_TOKEN,fetcher:typeof fetch=fetch){
 if(!token)throw Error('CATALOG_NOT_CONFIGURED');
 if(!path.startsWith('/api/catalogs/')||path.includes('#'))throw Error('INVALID_CATALOG');
 const r=await fetcher('https://acat.online'+path,{headers:{Authorization:token,Accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(15000),cache:'no-store'});
 if(!r.ok)throw Error(r.status===401||r.status===403?'CATALOG_ACCESS_DENIED':'CATALOG_UNAVAILABLE');
 return r.json();
}
export function catalogParts(data:any){return (Array.isArray(data.numbers)?data.numbers:[]).flatMap((row:any)=>(Array.isArray(row.parts)?row.parts:[]).filter((p:any)=>typeof p.number==='string'&&/^[A-Za-z0-9 .-]{2,40}$/.test(p.number)).map((p:any)=>({number:p.number,name:String(p.name||row.name||p.number).slice(0,140),description:String(p.description||''),notice:String(p.notice||'')})));}
