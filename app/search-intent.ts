export const partSuggestions=['Гальмівні колодки','Гальмівний диск','Стійка стабілізатора','Амортизатор','Повітряний фільтр','Масляний фільтр','Фільтр салону','Термостат','Акумулятор','Стартер','Моторна олива'];
export function searchIntent(raw:string){const text=raw.trim(),compact=text.replace(/\s/g,'').toUpperCase();if(/^[A-HJ-NPR-Z0-9]{17}$/.test(compact))return {kind:'vin',text:compact};if(/^(сто|автосервіс|шиномонтаж)(\s|$)/i.test(text))return {kind:'service',text};if(/стук|стуч|скрип|не завод|незавод|трої|дим|перегр|повільно|смика|чому|через що|вібрац|не працю/i.test(text))return {kind:'problem',text};if(/^[A-Z0-9 .-]{5,40}$/i.test(text)&&/\d/.test(text))return {kind:'oem',text:text.toUpperCase()};const fixed=text.replace(/косточк[аиу]?/gi,'стійка стабілізатора').replace(/стойка стабилизатора/gi,'стійка стабілізатора').replace(/колодкі/gi,'колодки');return {kind:'part',text:fixed};}

export type SearchMode='vin'|'part'|'problem';
export type SearchCommand={text:string;id:number;kind?:SearchMode};
export function routedSearchIntent(raw:string,mode?:SearchMode){
 const detected=searchIntent(raw);
 if(!mode)return detected;
 if(mode==='vin')return {kind:'vin',text:raw.replace(/\s/g,'').toUpperCase()};
 if(mode==='problem')return {kind:'problem',text:raw.trim()};
 return detected.kind==='oem'||detected.kind==='part'?detected:{kind:'part',text:raw.trim()};
}
