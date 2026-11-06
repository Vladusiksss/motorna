import {toMinor,isCurrency} from '../../app/money.ts';
export const moneyKinds=new Set(['expense','plan','cart','purchaseRequest','webFavorite','searchHistory']);
function object(value,path){if(!value||typeof value!=='object'||Array.isArray(value))throw Error(path+': expected object');return value;}
function array(value,path){if(!Array.isArray(value))throw Error(path+': expected array');return value;}
function field(row,major,minor,{version,required=false,positive=false,max=10000000,legacyCurrency},path){
 if(row.currency!==undefined&&!isCurrency(row.currency))throw Error(path+': unsupported currency');
 const hasMajor=Object.hasOwn(row,major),hasMinor=Object.hasOwn(row,minor);
 if(hasMajor&&hasMinor)throw Error(path+': mixed money formats');
 if(version===2){
  if(hasMajor)throw Error(path+': legacy field in v2');
  if(!hasMinor){if(required)throw Error(path+': missing amount');return;}
  if(!isCurrency(row.currency)||!Number.isSafeInteger(row[minor])||row[minor]<(positive?1:0)||row[minor]>max*100)throw Error(path+': invalid v2 amount/currency');
  return;
 }
 if(hasMinor)throw Error(path+': minor field without v2 marker');
 if(!hasMajor){if(required)throw Error(path+': missing amount');return;}
 if(typeof row[major]!=='number'||!Number.isFinite(row[major])||row[major]<(positive?Number.MIN_VALUE:0)||row[major]>max)throw Error(path+': invalid legacy amount');
 const currency=row.currency===undefined?legacyCurrency:row.currency;
 if(!isCurrency(currency))throw Error(path+': currency must be specified');
 let value;try{value=toMinor(row[major],currency);}catch{throw Error(path+': ambiguous precision or unsafe amount');}
 if(positive&&value===0)throw Error(path+': price must be positive');
 row[minor]=value;row.currency=currency;delete row[major];
}
export function migratePayload(kind,input,{legacyCurrency,shared=false}={}){
 const value=object(structuredClone(input),'payload');
 if(!shared&&!moneyKinds.has(kind))return {changed:false,value};
 if(value.moneyVersion!==undefined&&value.moneyVersion!==1&&value.moneyVersion!==2)throw Error('payload: unsupported money version');
 const version=value.moneyVersion||1,base={version};
 if(shared){for(const [i,row] of array(value.history,'history').entries())field(object(row,'history'),'amount','amountMinor',{...base,required:true,legacyCurrency},'history['+i+']');}
 else if(kind==='expense'||kind==='plan')field(value,'amount','amountMinor',{...base,required:true,legacyCurrency},kind);
 else if(kind==='cart'){
  field(value,'price','priceMinor',{...base,required:true,max:1000000,legacyCurrency},'cart.price');
  field(value,'delivery','deliveryMinor',{...base,required:true,max:100000,legacyCurrency},'cart.delivery');
 }else if(kind==='purchaseRequest'||kind==='searchHistory'){
  const key=kind==='purchaseRequest'?'lines':'results';
  for(const [i,row] of array(value[key],key).entries())field(object(row,key),'price','priceMinor',{...base,positive:true},key+'['+i+']');
 }else field(value,'price','priceMinor',{...base,positive:true},kind);
 value.moneyVersion=2;return {changed:version!==2,value};
}
export function quote(value){return "'"+String(value).replaceAll("'","''")+"'";}
export function updateSql(table,keyColumn,row,before,after){
 if(!['records','car_shares'].includes(table)||!['id','token'].includes(keyColumn))throw Error('Unsupported migration table');
 const where=keyColumn+'='+quote(row[keyColumn])+' AND owner='+quote(row.owner)+' AND payload='+quote(before)+(table==='records'?' AND kind='+quote(row.kind):'');
 return 'INSERT OR ROLLBACK INTO _money_guard(ok) SELECT CASE WHEN (SELECT COUNT(*) FROM '+table+' WHERE '+where+')=1 THEN 1 ELSE 0 END;\nUPDATE '+table+' SET payload='+quote(after)+' WHERE '+where+';\n';
}
export const sqlStart='-- Prepared money-v2 migration. Run only with matching v2 application and a verified backup.\nBEGIN IMMEDIATE;\nCREATE TEMP TABLE _money_guard(ok INTEGER NOT NULL CHECK(ok=1));\n';
export const sqlEnd='DROP TABLE _money_guard;\nCOMMIT;\n';

export function d1MoneyChange(table,keyColumn,row,before,after,guard){
 if(({records:'id',car_shares:'token'})[table]!==keyColumn||!/^_motorna_money_guard_[a-f0-9]{32}$/.test(guard))throw Error('Unsupported migration target');
 const where=keyColumn+'=? AND owner=? AND payload=?'+(table==='records'?' AND kind=?':'');
 const params=[row[keyColumn],row.owner,before,...(table==='records'?[row.kind]:[])];
 return [{sql:'INSERT INTO '+guard+'(ok) SELECT CASE WHEN (SELECT COUNT(*) FROM '+table+' WHERE '+where+')=1 THEN 1 ELSE 0 END',params},{sql:'UPDATE '+table+' SET payload=? WHERE '+where,params:[after,...params]}];
}
