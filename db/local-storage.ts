// Local-only adapter, selected by Vite only for Windows development.
// Production always uses Cloudflare D1/R2 through db/storage.ts.
import {DatabaseSync,type SQLInputValue} from 'node:sqlite';
import {mkdirSync,readFileSync,readdirSync,existsSync,writeFileSync,unlinkSync} from 'node:fs';
import {join,resolve} from 'node:path';
const runtimeRoot=resolve('.sites-runtime');
const root=resolve(process.env.MOTORNA_LOCAL_DATA_DIR||'.sites-runtime/local-data');
if(!root.startsWith(runtimeRoot+String.fromCharCode(92))&&!root.startsWith(runtimeRoot+'/'))throw new Error('Local storage must stay inside .sites-runtime');
mkdirSync(root,{recursive:true});
const db=new DatabaseSync(join(root,'motorna.sqlite'));
db.exec('CREATE TABLE IF NOT EXISTS local_migrations (name TEXT PRIMARY KEY)');
for(const name of readdirSync(resolve('drizzle')).filter(n=>n.endsWith('.sql')).sort()){
 if(!db.prepare('SELECT name FROM local_migrations WHERE name = ?').get(name)){
  db.exec('BEGIN');try{db.exec(readFileSync(join('drizzle',name),'utf8'));db.prepare('INSERT INTO local_migrations (name) VALUES (?)').run(name);db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}
 }
}
function prepare(sql:string){let values:SQLInputValue[]=[];return {bind(...args:SQLInputValue[]){values=args;return this;},async all(){return {results:db.prepare(sql).all(...values)};},async first(){return db.prepare(sql).get(...values)||null;},async run(){const result=db.prepare(sql).run(...values);return {success:true,meta:{changes:Number(result.changes),last_row_id:Number(result.lastInsertRowid)}};}};}
function objectPath(key:string){if(!/^[a-zA-Z0-9_-]+\/[a-f0-9-]{36}$/.test(key))throw new Error('Invalid object key');return join(root,key.replace('/','_'));}
const bucket={async put(key:string,value:ArrayBuffer){writeFileSync(objectPath(key),new Uint8Array(value));},async get(key:string){const file=objectPath(key);if(!existsSync(file))return null;return {body:readFileSync(file)};},async delete(key:string){const file=objectPath(key);if(existsSync(file))unlinkSync(file);}};
export async function storage(){return {db:{prepare} as unknown as D1Database,bucket:bucket as unknown as R2Bucket};}
