/** Country filter covers Ukraine; the local radius remains centered on the chosen address. */
export function geocoderParameters(address:string){return new URLSearchParams({q:address,format:'jsonv2',addressdetails:'1',countrycodes:'ua',limit:'8','accept-language':'uk'});}
export function stationQuery(lat:number,lon:number){return `[out:json][timeout:20];area["ISO3166-1"="UA"]["admin_level"="2"]->.scope;nwr["shop"="car_repair"](area.scope)(around:8000,${lat},${lon});out center tags;`;}
export function approximateDistance(a:{lat:number;lon:number},b:{lat:number;lon:number}){
 const rad=Math.PI/180,dLat=(b.lat-a.lat)*rad,dLon=(b.lon-a.lon)*rad;
 const h=Math.sin(dLat/2)**2+Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin(dLon/2)**2;
 return 6371*2*Math.asin(Math.sqrt(Math.min(1,h)));
}

export type AddressLocation={lat:number;lon:number;precision:string;label:string};
export function uniqueAddresses(locations:AddressLocation[]){
 const key=(s:string)=>s.toLocaleLowerCase('uk-UA').replace(/[aа]/g,'а').replace(/[bв]/g,'в').replace(/[cс]/g,'с').replace(/[eе]/g,'е').replace(/[’'ʼ`\s.,-]/g,'');
 const result:AddressLocation[]=[];
 for(const p of locations){if(!Number.isFinite(p.lat)||!Number.isFinite(p.lon))continue;
 if(!result.some(other=>key(other.label)===key(p.label)&&approximateDistance(other,p)<0.25))result.push(p);}
 return result;
}
export async function loadStationData(url:string,query:string,headers:Record<string,string>){
 for(let attempt=0;attempt<2;attempt++){
 try{const response=await fetch(url,{method:'POST',headers:{...headers,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({data:query}),signal:AbortSignal.timeout(25000)});
 if(!response.ok)throw new Error('STATIONS_HTTP_'+response.status);
 const body=await response.json() as {elements?:unknown[];remark?:string};
 if(body.remark||!Array.isArray(body.elements))throw new Error('STATIONS_INCOMPLETE');
 return body;
 }catch(error){if(attempt===1)throw error;}
 }
 throw new Error('STATIONS_UNAVAILABLE');
}
