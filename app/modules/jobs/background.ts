// Lifecycle extension, not a durable queue or an unattended scheduler.
const pending=new Set<Promise<void>>();
export async function background(task:Promise<void>){
 const safe=task.catch(()=>{console.warn('background_task_failed');});
 try{const {waitUntil}=await import('cloudflare:workers');waitUntil(safe);}catch{
  pending.add(safe);void safe.finally(()=>pending.delete(safe));
 }
}
