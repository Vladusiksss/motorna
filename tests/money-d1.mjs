import assert from 'node:assert/strict';
import {Miniflare} from 'miniflare';
import {d1MoneyChange} from '../scripts/lib/money-migration.mjs';
const mf=new Miniflare({host:'127.0.0.1',port:0,cf:false,modules:true,script:'export default {fetch(){return new Response("money migration test")}}',compatibilityDate:'2026-05-01',d1Databases:{DB:crypto.randomUUID()}});
try{
 const db=await mf.getD1Database('DB');await db.exec('CREATE TABLE records(id TEXT PRIMARY KEY,owner TEXT,kind TEXT,payload TEXT)');
 const rows=[{id:'one',owner:'a',kind:'expense',payload:'{"amount":1.23}'},{id:'two',owner:'b',kind:'expense',payload:'{"amount":2.34}'}];for(const row of rows)await db.prepare('INSERT INTO records VALUES(?,?,?,?)').bind(row.id,row.owner,row.kind,row.payload).run();
 const guard='_motorna_money_guard_'+crypto.randomUUID().replaceAll('-','');
 const changed=row=>JSON.stringify({amountMinor:row.id==='one'?123:234,currency:'UAH',moneyVersion:2});
 const operations=direction=>[{sql:'CREATE TABLE '+guard+'(ok INTEGER NOT NULL CHECK(ok=1))',params:[]},...rows.flatMap(row=>d1MoneyChange('records','id',row,direction==='apply'?row.payload:changed(row),direction==='apply'?changed(row):row.payload,guard)),{sql:'DROP TABLE '+guard,params:[]}];
 const run=ops=>db.batch(ops.map(op=>db.prepare(op.sql).bind(...op.params)));
 await run(operations('apply'));assert.equal(JSON.parse((await db.prepare('SELECT payload FROM records WHERE id=?').bind('one').first()).payload).amountMinor,123);
 await run(operations('rollback'));assert.equal((await db.prepare('SELECT payload FROM records WHERE id=?').bind('one').first()).payload,rows[0].payload);
 await db.prepare('UPDATE records SET payload=? WHERE id=?').bind('{"amount":9}','two').run();await assert.rejects(()=>run(operations('apply')));assert.equal((await db.prepare('SELECT payload FROM records WHERE id=?').bind('one').first()).payload,rows[0].payload,'D1 batch must roll back earlier writes');
 assert.equal(await db.prepare("SELECT name FROM sqlite_master WHERE name=?").bind(guard).first(),null,'Guard table rolls back too');
 console.log('PASS: native local D1 batch apply, exact rollback and full rollback on a later payload conflict');
}finally{await mf.dispose();}
