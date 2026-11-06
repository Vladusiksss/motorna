import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync,readFileSync,existsSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,isAbsolute} from 'node:path';
import {spawnSync} from 'node:child_process';
import {toMinor,addMoney} from '../app/money.ts';
import {migratePayload,updateSql,sqlStart,sqlEnd} from '../scripts/lib/money-migration.mjs';
assert.equal(toMinor('0.10','UAH'),10);assert.equal(toMinor(1.23,'EUR'),123);assert.deepEqual(addMoney({amountMinor:10,currency:'UAH'},{amountMinor:20,currency:'UAH'}),{amountMinor:30,currency:'UAH'});
for(const value of [-1,NaN,Infinity,1.005,0.1+0.2,'1e3','1.230','90071992547409.92'])assert.throws(()=>toMinor(value,'UAH'));
assert.throws(()=>addMoney({amountMinor:1,currency:'UAH'},{amountMinor:1,currency:'USD'}));assert.throws(()=>addMoney({amountMinor:Number.MAX_SAFE_INTEGER,currency:'UAH'},{amountMinor:1,currency:'UAH'}));
const convert=(kind,value,options={})=>migratePayload(kind,value,{legacyCurrency:'UAH',...options}).value;
assert.deepEqual(convert('expense',{amount:12.34}),{amountMinor:1234,currency:'UAH',moneyVersion:2});
assert.equal(convert('plan',{amount:0}).amountMinor,0);assert.deepEqual(convert('cart',{price:1.23,delivery:0}),{priceMinor:123,deliveryMinor:0,currency:'UAH',moneyVersion:2});
const draft=convert('purchaseRequest',{lines:[{price:0.1,currency:'USD'},{part:'Quote only'}]});assert.equal(draft.lines[0].priceMinor,10);assert.equal(Object.hasOwn(draft.lines[1],'priceMinor'),false);assert.equal(draft.lines[0].currency,'USD');
assert.equal(convert('webFavorite',{price:2,currency:'GBP'}).priceMinor,200);assert.equal(convert('searchHistory',{results:[{price:1.2,currency:'EUR'}]}).results[0].priceMinor,120);
assert.equal(convert('',{history:[{amount:5}]},{shared:true}).history[0].amountMinor,500);
for(const [kind,value,options] of [['expense',{amount:1},{}],['purchaseRequest',{lines:[{price:1}]},{legacyCurrency:'UAH'}],['webFavorite',{price:1,currency:'XYZ'},{}],['expense',{amount:1,amountMinor:100,currency:'UAH'},{}],['expense',{moneyVersion:2,amountMinor:1.5,currency:'UAH'},{}],['expense',{moneyVersion:3,amount:1},{}]])assert.throws(()=>migratePayload(kind,value,options));
assert.equal(migratePayload('expense',convert('expense',{amount:1})).changed,false);
const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE records(id TEXT PRIMARY KEY,owner TEXT,kind TEXT,payload TEXT,created INTEGER);');
const rows=[{id:'one',owner:"owner'quoted",kind:'expense',payload:JSON.stringify({amount:1.23,title:"Repair's"})},{id:'two',owner:'other',kind:'plan',payload:JSON.stringify({amount:0})}];for(const row of rows)db.prepare('INSERT INTO records VALUES (?,?,?,?,1)').run(row.id,row.owner,row.kind,row.payload);
const changes=rows.map(row=>({...row,next:JSON.stringify(convert(row.kind,JSON.parse(row.payload)))}));
const sql=direction=>sqlStart+changes.map(row=>updateSql('records','id',row,direction==='apply'?row.payload:row.next,direction==='apply'?row.next:row.payload)).join('')+sqlEnd;
db.exec(sql('apply'));assert.equal(JSON.parse(db.prepare('SELECT payload FROM records WHERE id=?').get('one').payload).amountMinor,123);db.exec(sql('rollback'));assert.equal(db.prepare('SELECT payload FROM records WHERE id=?').get('one').payload,rows[0].payload);
// A later mismatch must roll back earlier updates, not leave a partial migration.
db.prepare('UPDATE records SET payload=? WHERE id=?').run('{"amount":9}','two');assert.throws(()=>db.exec(sql('apply')));assert.equal(db.prepare('SELECT payload FROM records WHERE id=?').get('one').payload,rows[0].payload);db.close();
const temp=mkdtempSync(join(tmpdir(),'motorna-money-'));
try{
 const source=join(temp,'snapshot.sqlite'),file=new DatabaseSync(source);file.exec('CREATE TABLE records(id TEXT PRIMARY KEY,owner TEXT,kind TEXT,payload TEXT,created INTEGER);CREATE TABLE car_shares(token TEXT PRIMARY KEY,owner TEXT,payload TEXT);');file.prepare('INSERT INTO records VALUES (?,?,?,?,1)').run('expense','owner','expense','{"amount":1.23}');file.prepare('INSERT INTO car_shares VALUES (?,?,?)').run('private-token','owner','{"history":[{"amount":2.34}]}');file.close();const original=readFileSync(source);
 const run=(output,extra=[])=>spawnSync(process.execPath,['scripts/prepare-money-migration.mjs','--database',source,'--out-dir',output,...extra],{encoding:'utf8'});
 let result=run(join(temp,'blocked'));assert.equal(result.status,2);assert.equal(existsSync(join(temp,'blocked','apply.sql')),false);assert.equal(existsSync(join(temp,'blocked','rollback.sql')),false);assert.ok(!result.stdout.includes('private-token'));
 const out=join(temp,'ready');result=run(out,['--legacy-currency','UAH']);assert.equal(result.status,0,result.stderr);assert.equal(JSON.parse(result.stdout).changed,2);assert.deepEqual(readFileSync(source),original,'Preparation never writes source database');
 const target=new DatabaseSync(source);const d1=JSON.parse(readFileSync(join(out,'d1-apply.json'),'utf8'));assert.ok(d1.every(op=>!/^BEGIN|^COMMIT/.test(op.sql)));target.exec('BEGIN');try{for(const op of d1)target.prepare(op.sql).run(...op.params);target.exec('COMMIT');}catch(error){target.exec('ROLLBACK');throw error;}assert.equal(JSON.parse(target.prepare('SELECT payload FROM car_shares').get().payload).history[0].amountMinor,234);target.close();
 const again=join(temp,'again');result=run(again,['--legacy-currency','UAH']);assert.equal(JSON.parse(result.stdout).changed,0);assert.equal(JSON.parse(result.stdout).alreadyV2,2);
 const restore=new DatabaseSync(source);const undo=JSON.parse(readFileSync(join(out,'d1-rollback.json'),'utf8'));restore.exec('BEGIN');for(const op of undo)restore.prepare(op.sql).run(...op.params);restore.exec('COMMIT');assert.equal(restore.prepare('SELECT payload FROM records').get().payload,'{"amount":1.23}');restore.close();assert.notEqual(run(out,['--legacy-currency','UAH']).status,0,'No overwriting audit outputs');
}finally{assert.ok(isAbsolute(temp)&&temp.startsWith(join(tmpdir(),'motorna-money-')));rmSync(temp,{recursive:true,force:true});}
console.log('PASS: exact decimal minor units, currency isolation, all money record kinds and QR history, ambiguous values blocked, read-only CLI, atomic SQL conflict rollback, exact rollback and idempotent rerun');
