// Runtime configuration remains server-only. Production secrets are Sites environment variables.
export async function runtimeConfig():Promise<Record<string,string>>{
 try { const {env}=await import('cloudflare:workers'); return env as unknown as Record<string,string>; }
 catch { return process.env as Record<string,string>; }
}
