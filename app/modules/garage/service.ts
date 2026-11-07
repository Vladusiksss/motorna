import {storage} from '@/db/storage';
export async function findOwnedCar(owner:string,carId:string):Promise<Record<string,unknown>|null>{
 const {db}=await storage();const row=await db.prepare("SELECT payload FROM records WHERE id=? AND owner=? AND kind='car'").bind(carId,owner).first();
 if(!row)return null;return JSON.parse(String(row.payload)) as Record<string,unknown>;
}
export function vehicleSearchLabel(car:Record<string,unknown>):string{
 const engine=String(car.engine||'').replace(/(\d{3,4})\s*см[³3]/g,(_,cc)=>(Number(cc)/1000).toFixed(1)+' л').replace(/ДИЗЕЛЬНЕ ПАЛИВО/gi,'дизель').replace(/БЕНЗИН/gi,'бензин').replace(/[·]/g,' ').replace(/\s+/g,' ').trim();
 return [car.name,car.year,engine].filter(Boolean).join(' ').slice(0,160);
}
