export class VpicError extends Error {status:number;constructor(message:string,status=422){super(message);this.status=status;}}
export function validateVpicResult(raw:unknown):Record<string,string>{
 if(!raw||typeof raw!=='object')throw new VpicError('РЎРµСЂРІС–СЃ VIN РїРѕРІРµСЂРЅСѓРІ РЅРµРєРѕСЂРµРєС‚РЅСѓ РІС–РґРїРѕРІС–РґСЊ.',503);
 const value=raw as Record<string,unknown>;
 const codes=String(value.ErrorCode??'').split(';').map(s=>s.trim()).filter(Boolean);
 if(!codes.length||codes.some(c=>c!=='0'))throw new VpicError('VIN РЅРµ РІРґР°Р»РѕСЃСЏ РїРѕРІРЅС–СЃС‚СЋ РїРµСЂРµРІС–СЂРёС‚Рё. РџРµСЂРµРІС–СЂС‚Рµ 17 СЃРёРјРІРѕР»С–РІ: Р·Р°СЂР°Р· РїС–РґС‚СЂРёРјСѓСЋС‚СЊСЃСЏ Р°РІС‚Рѕ Р°РјРµСЂРёРєР°РЅСЃСЊРєРѕРіРѕ СЂРёРЅРєСѓ, СЏРєС– СЂРѕР·РїС–Р·РЅР°С” NHTSA.');
 if(typeof value.Make!=='string'||!value.Make.trim()||typeof value.Model!=='string'||!value.Model.trim()||!/^\d{4}$/.test(String(value.ModelYear||'')))throw new VpicError('РќРµРґРѕСЃС‚Р°С‚РЅСЊРѕ РґР°РЅРёС… РїСЂРѕ РјРѕРґРµР»СЊ Р°Р±Рѕ СЂС–Рє РґР»СЏ РїС–РґР±РѕСЂСѓ РґРµС‚Р°Р»РµР№. РџРµСЂРµРІС–СЂС‚Рµ VIN Р°РІС‚РѕРјРѕР±С–Р»СЏ Р°РјРµСЂРёРєР°РЅСЃСЊРєРѕРіРѕ СЂРёРЅРєСѓ.');
 return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,v==null?'':String(v)]));
}
