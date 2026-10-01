export const categories=[{id:'brakes',name:'Гальмівна система',description:'Колодки, диски'},{id:'oil',name:'Мастила та рідини',description:'Для надійної роботи'},{id:'filters',name:'Фільтри',description:'Чистота має значення'},{id:'electric',name:'Електрика',description:'Акумулятори, свічки'},{id:'suspension',name:'Підвіска',description:'Комфорт на дорозі'},{id:'engine',name:'Двигун',description:'Серце автомобіля'}];
export type Part={id:string;name:string;brand:string;sku:string;category:string;price:number;spec:string;keywords:string;offers:{shop:string;price:number;delivery:number;days:string}[]};
const raw=[
['p1','Гальмівні колодки, передні','Brembo','P 85 020','brakes',1240,'Комплект · передня вісь','тормозні тормоза колодки'],
['p2','Гальмівний диск','Bosch','0 986 479 153','brakes',1690,'1 шт. · вентильований · 288 мм','диски тормозні'],
['p3','Моторна олива 5W-30','Castrol','EDGE 5W-30 LL','oil',2180,'Каністра 4 л · синтетична','масло мастило олія'],
['p4','Масляний фільтр','MANN-FILTER','W 712/95','filters',340,'Різьбовий · ущільнювач у комплекті','фільтр масла масляний'],
['p5','Повітряний фільтр','Bosch','F 026 400 342','filters',520,'Панельний · двигун','воздушний воздух'],
['p6','Акумулятор 60 Ah','Varta','D24 560 408 054','electric',3790,'12 V · 540 A · 242 × 175 × 190 мм','батарея акум аккумулятор'],
['p7','Амортизатор передній','Sachs','312 267','suspension',2490,'1 шт. · газовий · передня вісь','стойка стійка підвіска'],
['p8','Свічка запалювання','NGK','PZFR6R','engine',480,'1 шт. · платиновий електрод','свічки зажигання'],
['p9','Фільтр салону','MANN-FILTER','CUK 2939','filters',690,'Вугільний · для салону','кондиціонер салонний'],
['p10','Гальмівна рідина DOT 4','Bosch','1 987 479 107','oil',390,'Флакон 1 л · DOT 4','тормозна рідина'],
['p11','Ремінь приводу','Gates','6PK1053','engine',560,'Поліклиновий · 6 ребер','ремень генератор'],
['p12','Стійка стабілізатора','Lemförder','26774 02','suspension',780,'1 шт. · передня вісь','стук ходова стабілізатор']
] as const;
export const parts:Part[]=raw.map(([id,name,brand,sku,category,price,spec,keywords])=>({id,name,brand,sku,category,price,spec,keywords,offers:[{shop:'Демо · Автосклад',price,delivery:90,days:'1–2 дні'},{shop:'Демо · Деталь+',price:Math.round(price*1.06),delivery:0,days:'2–3 дні'},{shop:'Демо · МоторМаркет',price:Math.round(price*.97),delivery:150,days:'3–4 дні'}]}));
export const services=[{id:'s1',name:'Майстерня на Подолі',city:'Київ',area:'Поділ',jobs:'Гальма, підвіска, ТО',rate:700},{id:'s2',name:'Мотор Сервіс',city:'Київ',area:'Оболонь',jobs:'Діагностика, двигун, електрика',rate:850},{id:'s3',name:'Захід Авто',city:'Львів',area:'Франківський район',jobs:'ТО, підвіска, гальма',rate:650},{id:'s4',name:'Південь Гараж',city:'Одеса',area:'Київський район',jobs:'Діагностика, електрика, ТО',rate:600}];
export const money=(n:number)=>new Intl.NumberFormat('uk-UA',{style:'currency',currency:'UAH',maximumFractionDigits:0}).format(n);
export const normalize=(s:string)=>s.toLocaleLowerCase('uk-UA').replace(/[^\p{L}\p{N}]/gu,'');
export function searchParts(query:string,category='all'){const q=normalize(query);return parts.filter(p=>(category==='all'||p.category===category)&&(!q||normalize(`${p.name} ${p.brand} ${p.sku} ${p.keywords}`).includes(q)));}
export type RecordItem={id:string;kind:string;data:any;created:number};
