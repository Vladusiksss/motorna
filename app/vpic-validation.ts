export class VpicError extends Error {status:number;constructor(message:string,status=422){super(message);this.status=status;}}
export function validateVpicResult(raw:unknown):Record<string,string>{
 if(!raw||typeof raw!=='object')throw new VpicError('Сервіс VIN повернув некоректну відповідь.',503);
 const value=raw as Record<string,unknown>;
 const codes=String(value.ErrorCode??'').split(';').map(s=>s.trim()).filter(Boolean);
 if(!codes.length||codes.some(c=>c!=='0'))throw new VpicError('VIN не вдалося повністю перевірити. Перевірте 17 символів: зараз підтримуються авто американського ринку, які розпізнає NHTSA.');
 if(typeof value.Make!=='string'||!value.Make.trim()||typeof value.Model!=='string'||!value.Model.trim()||!/^\d{4}$/.test(String(value.ModelYear||'')))throw new VpicError('Недостатньо даних про модель або рік для підбору деталей. Перевірте VIN автомобіля американського ринку.');
 return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,v==null?'':String(v)]));
}
