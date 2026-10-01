export async function storage(){const {env}=await import('cloudflare:workers');if(!env.DB)throw new Error('DB unavailable');return {db:env.DB,bucket:env.BUCKET};}
