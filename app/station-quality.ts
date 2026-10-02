import {approximateDistance} from './station-geography';
export function usableStation(e:any){
 const t=e.tags||{},name=String(t['name:uk']||t.name||t.brand||'').trim();
 // Disputed listing reported by the user: Petliury 17 is not the Google Maps destination.
 // Quarantine only this name/location; do not relocate a same-name business or transfer its reviews.
 const disputedName=name.toLocaleLowerCase('uk-UA').replace(/[^\p{L}\p{N}]/gu,'');
 const point={lat:e.lat??e.center?.lat,lon:e.lon??e.center?.lon};
 if(['увалери','стоувалери'].includes(disputedName)&&Number.isFinite(point.lat)&&Number.isFinite(point.lon)&&approximateDistance(point,{lat:50.5233981,lon:30.7999975})<0.15)return false;
 if(t.shop!=='car_repair'||!name||!['node','way','relation'].includes(e.type))return false;
 if(['disused','abandoned','demolished','removed','construction'].some(k=>t[k]&&t[k]!=='no'||t[k+':shop']))return false;
 if(t.access==='private'||t.opening_hours==='closed'||t.opening_hours==='off')return false;
 const lat=e.lat??e.center?.lat,lon=e.lon??e.center?.lon;
 return typeof lat==='number'&&typeof lon==='number'&&Number.isFinite(lat)&&Number.isFinite(lon)&&lat>=44&&lat<=52.5&&lon>=22&&lon<=40.3;
}
export function uniqueStations<T extends {id:string;name:string;lat:number;lon:number;address:string;locationPrecision?:string}>(stations:T[]):T[]{
 const clean=(s:string)=>s.toLocaleLowerCase('uk-UA').replace(/[^\p{L}\p{N}]/gu,'');const result:T[]=[];
 for(const s of stations){const index=result.findIndex(other=>other.id===s.id||(clean(other.name)===clean(s.name)&&approximateDistance(other,s)<0.08&&(!other.address||!s.address||clean(other.address)===clean(s.address))));if(index<0)result.push(s);else if(s.locationPrecision==='point'&&result[index].locationPrecision!=='point')result[index]=s;}
 return result;
}
