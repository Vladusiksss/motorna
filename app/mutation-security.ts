// This is the deployed Site identity, not a value inferred from Host/Forwarded headers.
export const MOTORNA_ORIGIN='https://motorna-auto-space.bilogrivijvladislav.chatgpt.site';
const localOrigins=new Set(['http://localhost:5173','http://127.0.0.1:5173']);
type Policy={format?:'json'|'multipart'|'gzip';allowMachine?:boolean};
function targetOrigin(request:Request){try{const origin=new URL(request.url).origin;return origin===MOTORNA_ORIGIN||(process.env.NODE_ENV!=='production'&&localOrigins.has(origin))?origin:null;}catch{return null;}}
function serializedOrigin(value:string){try{const url=new URL(value);return url.origin===value&&!url.username&&!url.password&&['https:','http:'].includes(url.protocol)?url.origin:null;}catch{return null;}}
function refererOrigin(value:string){try{const url=new URL(value);return !url.username&&!url.password&&!url.hash&&['https:','http:'].includes(url.protocol)?url.origin:null;}catch{return null;}}
const deny=(status=403)=>Response.json({error:status===415?'Непідтримуваний формат запиту.':'Недозволене джерело запиту. Оновіть сторінку та спробуйте ще раз.',code:status===415?'UNSUPPORTED_MEDIA_TYPE':'CSRF_REJECTED'},{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Vary':'Origin, Sec-Fetch-Site, Sec-Fetch-Mode, Sec-Fetch-Dest'}});
export function mutationGuard(request:Request,{format='json',allowMachine=false}:Policy={}){
 if(!['POST','PUT','PATCH','DELETE'].includes(request.method))return null;
 const expected=targetOrigin(request);if(!expected)return deny();
 const origin=request.headers.get('origin'),referer=request.headers.get('referer');
 const site=request.headers.get('sec-fetch-site'),mode=request.headers.get('sec-fetch-mode'),dest=request.headers.get('sec-fetch-dest');
 // This exception is only used AFTER authenticating the registry import secret. It never applies to session-based APIs.
 const machine=allowMachine&&[origin,referer,site,mode,dest].every(value=>value===null);
 if(!machine){
  if(origin===null||serializedOrigin(origin)!==expected)return deny();
  if(referer!==null&&refererOrigin(referer)!==expected)return deny();
  if(site!==null&&site!=='same-origin')return deny();
  if(mode!==null&&!['cors','same-origin'].includes(mode))return deny();
  if(dest!==null&&dest!=='empty')return deny();
 }
 const raw=request.headers.get('content-type'),type=(raw||'').split(';')[0].trim().toLowerCase();
 if(request.method==='DELETE'&&raw===null)return null;
 const required={json:'application/json',multipart:'multipart/form-data',gzip:'application/gzip'}[format];
 if(type!==required)return deny(415);
 if(format==='multipart'&&!/;\s*boundary=(?:"[^"\r\n]+"|[^;\s]+)(?:;|$)/i.test(raw||''))return deny(415);
 return null;
}
