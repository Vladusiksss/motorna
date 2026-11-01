export type PurchaseLine={title:string;part:string;oem:string;url?:string;host?:string;price?:number;currency?:string;quantity:number;checkedAt?:string;availability?:string;dataMode:'live'|'inquiry'|'demo';fitment:'unverified'};
export type PurchaseDraft={carId:string;vehicle:string;vin:string;lines:PurchaseLine[];note:string};
export function lineKey(line:PurchaseLine){return line.url||[line.part,line.oem].join('|');}
export function addPurchaseLine(draft:PurchaseDraft|undefined,vehicle:Omit<PurchaseDraft,'lines'|'note'>,line:PurchaseLine):PurchaseDraft{
 if(line.dataMode==='demo')throw Error('Демонстраційні пропозиції не можна додавати до запиту.');
 const current=draft||{...vehicle,lines:[],note:''};
 if(current.carId!==vehicle.carId)throw Error('Оберіть один автомобіль для запиту.');
 const existing=current.lines.some(l=>lineKey(l)===lineKey(line));
 if(!existing&&current.lines.length>=20)throw Error('У запиті може бути до 20 позицій.');
 return {...current,lines:existing?current.lines.map(l=>lineKey(l)===lineKey(line)?{...l,quantity:Math.min(99,l.quantity+1)}:l):[...current.lines,{...line,quantity:Math.max(1,Math.min(99,Math.trunc(line.quantity)))}]};
}
export function purchaseTotals(lines:PurchaseLine[]){
 const totals:Record<string,number>={};
 for(const line of lines)if(line.price!=null&&Number.isFinite(line.price)&&line.currency)totals[line.currency]=(totals[line.currency]||0)+Math.round(line.price*100)*line.quantity;
 return Object.entries(totals).map(([currency,cents])=>({currency,amount:cents/100}));
}
export function purchaseText(draft:PurchaseDraft){
 return ['ЗАПИТ НА ПІДБІР І КУПІВЛЮ — MOTORNA','Автомобіль: '+draft.vehicle,'VIN: '+draft.vin,'',...draft.lines.flatMap((line,i)=>[
 `${i+1}. ${line.part||line.title} — ${line.quantity} шт.`,
 line.title!==line.part?'Пропозиція: '+line.title:'',line.oem?'Артикул із запиту або пропозиції: '+line.oem:'Артикул потрібно визначити за VIN.',
 line.url?'Сторінка продавця: '+line.url:'Потрібні пропозиції продавця.',
 line.price!=null?`Ціна під час пошуку: ${line.price} ${line.currency||''} за одиницю.`:'Ціну потрібно уточнити.',
 line.checkedAt?'Дата перевірки сторінки: '+line.checkedAt:'',
 'Сумісність за VIN не підтверджена.',''
 ]),draft.note?'Примітка: '+draft.note:'',
 'Прошу перевірити застосовність кожної деталі саме до цього VIN у заводському каталозі, повідомити OEM-номер, обмеження за комплектацією, актуальну ціну, наявність і доставку.',
 'Це запит, а не оплачене чи підтверджене замовлення.'].filter(Boolean).join('\n');
}
