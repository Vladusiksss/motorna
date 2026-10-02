/** Country filter covers Ukraine; the local radius remains centered on the chosen address. */
export function geocoderParameters(address:string){return new URLSearchParams({q:address,format:'jsonv2',addressdetails:'1',countrycodes:'ua',limit:'8','accept-language':'uk'});}
export function stationQuery(lat:number,lon:number){return `[out:json][timeout:20];area["ISO3166-1"="UA"]["admin_level"="2"]->.scope;nwr["shop"="car_repair"](area.scope)(around:8000,${lat},${lon});out center tags;`;}
export function approximateDistance(a:{lat:number;lon:number},b:{lat:number;lon:number}){
 const rad=Math.PI/180,dLat=(b.lat-a.lat)*rad,dLon=(b.lon-a.lon)*rad;
 const h=Math.sin(dLat/2)**2+Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin(dLon/2)**2;
 return 6371*2*Math.asin(Math.sqrt(Math.min(1,h)));
}
