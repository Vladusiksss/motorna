export type Point={lat:number;lon:number};
export function directions(origin:Point,destination:Point){const url=new URL('https://www.google.com/maps/dir/');url.search=new URLSearchParams({api:'1',origin:`${origin.lat},${origin.lon}`,destination:`${destination.lat},${destination.lon}`,travelmode:'driving'}).toString();return url.href;}
export async function routeStations(origin:Point,stations:any[],base='https://routing.openstreetmap.de/routed-car'):Promise<any[]>{
 if(!stations.length)return [];
 if(stations.length>40){const result=[];for(let i=0;i<stations.length;i+=40)result.push(...await routeStations(origin,stations.slice(i,i+40),base));return result.sort((a,b)=>(a.roadDistance??a.distance)-(b.roadDistance??b.distance));}
 try{
 const coords=[origin,...stations].map(p=>`${p.lon},${p.lat}`).join(';');
 const url=`${base.replace(/\/$/,'')}/table/v1/driving/${coords}?sources=0&annotations=distance,duration`;
 const r=await fetch(url,{signal:AbortSignal.timeout(15000)});if(!r.ok)throw new Error('routing');const body:any=await r.json();if(body.code!=='Ok')throw new Error('routing');
 return stations.map((s,i)=>{const meters=body.distances?.[0]?.[i+1],seconds=body.durations?.[0]?.[i+1];const ok=typeof meters==='number'&&Number.isFinite(meters)&&typeof seconds==='number'&&Number.isFinite(seconds);return {...s,roadDistance:ok?Math.round(meters/100)/10:null,minutes:ok?Math.max(1,Math.round(seconds/60)):null,routeStatus:ok?'available':'unavailable'};}).sort((a,b)=>(a.roadDistance??Infinity)-(b.roadDistance??Infinity)||a.distance-b.distance);
 }catch{return stations.map(s=>({...s,roadDistance:null,minutes:null,routeStatus:'unavailable'}));}
}
