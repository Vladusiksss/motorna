export function stationContacts(tags:Record<string,string>){
 const raw=[tags.phone,tags['contact:phone'],tags.mobile,tags['contact:mobile']].filter(Boolean).join(';');
 const phones=Array.from(new Set(raw.split(/[;,]/).map(p=>p.replace(/[^+0-9]/g,'')).map(p=>/^0\d{9}$/.test(p)?'+38'+p:/^380\d{9}$/.test(p)?'+'+p:p).filter(p=>/^\+\d{10,15}$/.test(p))));
 const hours=tags['opening_hours:workshop']||tags.opening_hours||'';
 const days:Record<string,string>={Mo:'Пн',Tu:'Вт',We:'Ср',Th:'Чт',Fr:'Пт',Sa:'Сб',Su:'Нд',PH:'Святкові дні'};
 const formatted=hours==='24/7'?'Цілодобово, щодня':hours.replace(/\b(Mo|Tu|We|Th|Fr|Sa|Su|PH)\b/g,x=>days[x]).replace(/\boff\b/g,'зачинено').replace(/\bopen\b/g,'відчинено').replace(/;/g,'; ');
 return {phones,hours:formatted};
}
