import type {PhotoRequest} from './vehicle-photo-search';
// Reviewed front view and black paint. Source identifies C8, not an exact model year.
// This is an illustration of the model, not an exact-VIN listing photo.
export function verifiedModelPhoto(p:PhotoRequest){
 if(p.make.toLowerCase()!=='audi'||p.model.replace(/[ -]/g,'').toLowerCase()!=='rs7'||p.year!=='2021'||p.body!=='hatch'||p.color!=='#20232a')return null;
 return {url:'/vehicle-photos/audi-rs7-c8-black-front.jpg',source:'https://commons.wikimedia.org/wiki/File:Audi_RS7_C8_IMG_4323.jpg',title:'Audi RS7 C8 — передній ракурс',note:'Ілюстрація покоління C8 у чорному кольорі. Рік випуску авто на фото не підтверджений.',author:'Alexander Migl',license:'CC BY-SA 4.0',licenseUrl:'https://creativecommons.org/licenses/by-sa/4.0/',reviewedAt:'2026-10-01'};
}
