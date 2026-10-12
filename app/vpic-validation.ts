export class VpicError extends Error {status:number;constructor(message:string,status=422){super(message);this.status=status;}}

export function validateVpicResult(raw:unknown):Record<string,string>{

 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new VpicError('Сервіс VIN повернув некоректну відповідь.',503);

 const value=raw as Record<string,unknown>;

 const codes=String(value.ErrorCode??'').split(/[;,]/).map(s=>s.trim()).filter(Boolean);

 if(!codes.length)throw new VpicError('Сервіс VIN повернув некоректну відповідь.',503);

 return Object.fromEntries(Object.entries(value).filter(([,v])=>v==null||['string','number','boolean'].includes(typeof v)).map(([k,v])=>[k,v==null?'':String(v)]));

}

// Incomplete vPIC results can contain a guessed model year. Only retain it for

// a complete decode; European manufacturers do not share one year convention.

export function internationalResult(raw:Record<string,string>,vin:string):Record<string,string>{

 const complete=raw.ErrorCode.split(/[;,]/).every(c=>c.trim()==='0')&&!!raw.Make&&!!raw.Model&&/^\d{4}$/.test(raw.ModelYear);

 if(complete)return raw;

 const makers:Record<string,string>={WAU:'AUDI',WUA:'AUDI',TRU:'AUDI',WVW:'VOLKSWAGEN',WVG:'VOLKSWAGEN',TMB:'SKODA',VSS:'SEAT',WBA:'BMW',WBS:'BMW',WBY:'BMW',WDB:'MERCEDES-BENZ',WDD:'MERCEDES-BENZ',W1K:'MERCEDES-BENZ',W1N:'MERCEDES-BENZ',VF1:'RENAULT',VF3:'PEUGEOT',VF7:'CITROEN',W0L:'OPEL',WF0:'FORD',SAL:'LAND ROVER',YS3:'SAAB',WP0:'PORSCHE',WP1:'PORSCHE',KMH:'HYUNDAI',JHM:'HONDA',JTD:'TOYOTA'};

 // Ambiguous model/platform codes are deliberately not converted to a model.

 return {...raw,ErrorCode:raw.ErrorCode,Make:makers[vin.slice(0,3)]||raw.Make||'',Model:raw.Model||'',ModelYear:'',Manufacturer:raw.Manufacturer||''};

}

