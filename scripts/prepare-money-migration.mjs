import {DatabaseSync} from 'node:sqlite';
import {mkdirSync,openSync,writeSync,closeSync,renameSync,unlinkSync,writeFileSync} from 'node:fs';
import {resolve,relative,isAbsolute,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {isCurrency} from '../app/money.ts';
import {moneyKinds,migratePayload,updateSql,d1MoneyChange,sqlStart,sqlEnd} from './lib/money-migration.mjs';
const options={};const args=process.argv.slice(2);
for(let i=0;i<args.length;i+=2){if(!['--database','--out-dir','--legacy-currency'].includes(args[i])||!args[i+1]||options[args[i]])throw Error('Usage: --database snapshot.sqlite [--out-dir private-directory] [--legacy-currency UAH|EUR|USD|GBP]');options[args[i]]=args[i+1];}
if(!options['--database'])throw Error('A consistent offline SQLite snapshot is required');
if(options['--legacy-currency']&&!isCurrency(options['--legacy-currency']))throw Error('Unsupported legacy currency');
const root=fileURLToPath(new URL('../',import.meta.url));const privateRoot=resolve(root,'.money-migration');
const output=resolve(options['--out-dir']||join(privateRoot,crypto.randomUUID()));
const within=(base,path)=>{const rel=relative(base,path);return rel===''||(!rel.startsWith('..')&&!isAbsolute(rel));};
if(within(root,output)&&(!within(privateRoot,output)||output===privateRoot))throw Error('Use a fresh child of .money-migration or an external private directory');
mkdirSync(resolve(output,'..'),{recursive:true});mkdirSync(output,{mode:0o700});
const files=['apply.sql','rollback.sql','d1-apply.json','d1-rollback.json'].map(name=>join(output,name+'.pending'));
const guard='_motorna_money_guard_'+crypto.randomUUID().replaceAll('-','');const handles=files.map(file=>openSync(file,'wx',0o600));
const report={moneyVersion:2,mode:'prepare-only',legacyCurrency:options['--legacy-currency']||null,scanned:0,changed:0,alreadyV2:0,skipped:0,issueCount:0,issues:[]};let db,complete=false;
try{
 db=new DatabaseSync(resolve(options['--database']),{readOnly:true});db.exec('BEGIN');
 for(const fd of handles.slice(0,2))writeSync(fd,sqlStart);
 for(const fd of handles.slice(2))writeSync(fd,'[\n'+JSON.stringify({sql:'CREATE TABLE '+guard+'(ok INTEGER NOT NULL CHECK(ok=1))',params:[]}));
 for(const [table,key] of [['records','id'],['car_shares','token']]){
  if(!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(table)){if(table==='records')throw Error('Missing records table');continue;}
  for(const row of db.prepare('SELECT '+key+',owner,payload'+(table==='records'?',kind':'')+' FROM '+table+' ORDER BY '+key).iterate()){
   report.scanned++;
   if(table==='records'&&!moneyKinds.has(row.kind)){report.skipped++;continue;}
   try{
    const result=migratePayload(row.kind,JSON.parse(row.payload),{shared:table==='car_shares',legacyCurrency:options['--legacy-currency']});
    if(!result.changed){report.alreadyV2++;continue;}
    const next=JSON.stringify(result.value);writeSync(handles[0],updateSql(table,key,row,row.payload,next));writeSync(handles[1],updateSql(table,key,row,next,row.payload));for(const op of d1MoneyChange(table,key,row,row.payload,next,guard))writeSync(handles[2],',\n'+JSON.stringify(op));for(const op of d1MoneyChange(table,key,row,next,row.payload,guard))writeSync(handles[3],',\n'+JSON.stringify(op));report.changed++;
   }catch{report.issueCount++;if(report.issues.length<1000)report.issues.push({table,key:row[key],reason:'Invalid money format, precision, currency or payload; inspect this row privately.'});}
  }
 }
 db.exec('ROLLBACK');
 for(const fd of handles.slice(0,2))writeSync(fd,sqlEnd);
 for(const fd of handles.slice(2))writeSync(fd,',\n'+JSON.stringify({sql:'DROP TABLE '+guard,params:[]})+'\n]\n');complete=true;
}finally{
 for(const fd of handles)closeSync(fd);db?.close();
 if(!complete||report.issueCount){for(const file of files)unlinkSync(file);}
}
writeFileSync(join(output,'report.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx',mode:0o600});
if(report.issueCount===0)for(const file of files)renameSync(file,file.slice(0,-8));
// Do not print owners, VIN, QR tokens, money values or payloads.
console.log(JSON.stringify({status:report.issueCount?'blocked':'prepared',scanned:report.scanned,changed:report.changed,alreadyV2:report.alreadyV2,skipped:report.skipped,issues:report.issueCount}));
if(report.issueCount)process.exitCode=2;
