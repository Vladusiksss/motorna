import {ESLint} from 'eslint';
import {readFileSync} from 'node:fs';
import {relative} from 'node:path';
const baseline=JSON.parse(readFileSync(new URL('../eslint-baseline.json',import.meta.url),'utf8'));
const engine=new ESLint();
const results=await engine.lintFiles(['.']);
const counts=new Map();
for(const result of results)for(const message of result.messages){
 if(message.severity!==2)continue;
 const key=[relative(process.cwd(),result.filePath).replaceAll('\\','/'),message.ruleId||'parse',message.message.split(/\r?\n/)[0]].join('|');
 counts.set(key,(counts.get(key)||0)+1);
}
let added=0;
for(const [key,count] of counts)if(count>(baseline[key]||0)){console.error(`${key}: ${count-(baseline[key]||0)} new error(s)`);added+=count-(baseline[key]||0);}
const total=[...counts.values()].reduce((sum,n)=>sum+n,0);
console.log(`ESLint: ${total} existing errors; ${added} new. Run npm run lint:strict for all findings.`);
if(added)process.exitCode=1;
