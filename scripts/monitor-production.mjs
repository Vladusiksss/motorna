import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
export const site='https://motorna-auto-space.bilogrivijvladislav.chatgpt.site';
export async function probe(fetcher=fetch){
 const checks=[];
 for(const [path,status] of [['/api/health',200],['/api/records',401],['/api/documents',401]]){
  let ok=false;
  for(let attempt=0;attempt<2&&!ok;attempt++)try{
   const response=await fetcher(site+path,{redirect:'error',signal:AbortSignal.timeout(15000)});
   const body=await response.json();
   ok=response.status===status&&(path==='/api/health'?body.checks?.database==='ok'&&body.checks?.files==='ok':body.code==='AUTH_REQUIRED'&&typeof body.requestId==='string');
  }catch{/* Report only the fixed route, never upstream bodies or exception URLs. */}
  checks.push({path,ok});
 }
 return {status:checks.every(c=>c.ok)?'healthy':'failed',checkedAt:new Date().toISOString(),checks};
}
export async function notify(report,previous,{token,chatId},fetcher=fetch){
 if(!token||!chatId)return 'not_configured';
 if(!/^\d+$/.test(chatId)||!/^\d+:[A-Za-z0-9_-]+$/.test(token))return 'invalid_configuration';
 if(report.status===previous||(previous===undefined&&report.status==='healthy'))return 'unchanged';
 const text=report.status==='healthy'?'MOTORNA: роботу сервісу відновлено.':'MOTORNA: збій перевірки '+report.checks.filter(c=>!c.ok).map(c=>c.path).join(', ')+'.';
 try{const response=await fetcher('https://api.telegram.org/bot'+token+'/sendMessage',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:chatId,text:text+' '+site,disable_web_page_preview:true}),redirect:'error',signal:AbortSignal.timeout(15000)});return response.ok&&(await response.json()).ok===true?'sent':'delivery_failed';}catch{return 'delivery_failed';}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 mkdirSync('.monitor-state',{recursive:true});let previous;
 try{previous=JSON.parse(readFileSync('.monitor-state/state.json','utf8')).status;}catch{}
 const report=await probe();report.notification=process.env.MOTORNA_TELEGRAM_ALERTS_ENABLED==='true'?await notify(report,previous,{token:process.env.TELEGRAM_BOT_TOKEN,chatId:process.env.TELEGRAM_CHAT_ID}):'disabled';
 // Keep the old state on delivery failure, so the next run retries the alert.
 if(!['delivery_failed','invalid_configuration','not_configured','disabled'].includes(report.notification))writeFileSync('.monitor-state/state.json',JSON.stringify({status:report.status}));
 writeFileSync('.monitor-state/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 if(process.env.GITHUB_STEP_SUMMARY)writeFileSync(process.env.GITHUB_STEP_SUMMARY,'Motorna: '+report.status+'\n\nTelegram: '+report.notification+'\n',{flag:'a'});
 if(report.status==='failed'||['delivery_failed','invalid_configuration'].includes(report.notification))process.exitCode=1;
}
