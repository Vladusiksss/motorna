export type Appearance={body:string;bodyLabel:string;color:string;colorLabel:string;knownBody:boolean;knownColor:boolean};
export function vehicleAppearance(fields:{label:string;value:string}[]=[]):Appearance{
 const body=fields.find(f=>/^(кузов|body|bodyclass)$/i.test(f.label))?.value||'';
 const raw=fields.find(f=>/^(колір|color)$/i.test(f.label))?.value||'';
 const types:[RegExp,string,string][]=[[/пікап|pickup/i,'pickup','Пікап'],[/позашлях|джип|suv|sport utility|кросовер/i,'suv','Позашляховик'],[/мінівен|minivan|фургон|van/i,'van','Мінівен / фургон'],[/хетч|хеч|hatch/i,'hatch','Хетчбек'],[/універсал|wagon|estate/i,'wagon','Універсал'],[/купе|coupe/i,'coupe','Купе'],[/кабріолет|convertible/i,'convertible','Кабріолет'],[/седан|sedan|saloon/i,'sedan','Седан']];
 const colors:[RegExp,string][]=[[/чорн|black/i,'#20232a'],[/біл|white/i,'#e8e9e7'],[/син|blue/i,'#195cb2'],[/блакит|голуб/i,'#74b9da'],[/сір|grey|gray/i,'#737b85'],[/сріб|silver/i,'#b8c2cd'],[/черв|red/i,'#b52230'],[/зелен|green/i,'#287052'],[/жовт|yellow/i,'#e8ba25'],[/корич|brown/i,'#725240'],[/беж|beige/i,'#cfb999'],[/оранж|помаранч|orange/i,'#de782f'],[/фіолет|purple/i,'#75508c']];
 const t=types.find(([r])=>r.test(body)),c=colors.find(([r])=>r.test(raw));
 return {body:t?.[1]||'sedan',bodyLabel:t?.[2]||'Кузов не визначено',color:c?.[1]||'#8b96a5',colorLabel:c?raw.toLocaleLowerCase('uk-UA'):'Колір не визначено',knownBody:!!t,knownColor:!!c};
}
