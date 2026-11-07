const defaults:Record<number,{code:string;message:string}>={
 400:{code:'INVALID_REQUEST',message:'Перевірте дані запиту.'},401:{code:'AUTH_REQUIRED',message:'Потрібен вхід у застосунок.'},403:{code:'FORBIDDEN',message:'Доступ до цієї дії заборонено.'},404:{code:'NOT_FOUND',message:'Не знайдено.'},405:{code:'METHOD_NOT_ALLOWED',message:'Цей метод запиту не підтримується.'},409:{code:'CONFLICT',message:'Дані змінилися. Оновіть сторінку.'},410:{code:'GONE',message:'Ресурс більше недоступний.'},413:{code:'PAYLOAD_TOO_LARGE',message:'Завеликий запит.'},415:{code:'UNSUPPORTED_MEDIA_TYPE',message:'Непідтримуваний формат запиту.'},422:{code:'VALIDATION_FAILED',message:'Перевірте заповнення полів.'},429:{code:'RATE_LIMITED',message:'Забагато запитів. Спробуйте пізніше.'},500:{code:'INTERNAL_ERROR',message:'Не вдалося виконати запит. Спробуйте пізніше.'},502:{code:'UPSTREAM_ERROR',message:'Зовнішній сервіс тимчасово недоступний.'},503:{code:'SERVICE_UNAVAILABLE',message:'Сервіс тимчасово недоступний.'},504:{code:'UPSTREAM_TIMEOUT',message:'Час очікування сервісу вичерпано.'}
};
function object(value:unknown):Record<string,unknown>{return value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};}
// Every exported API handler runs inside this boundary. Never trust a caller-supplied request ID.
export async function apiBoundary(task:()=>Promise<Response>,route:string):Promise<Response>{
 const requestId=crypto.randomUUID();let response:Response;
 try{response=await task();if(!(response instanceof Response)||response.status<200)throw new Error('Invalid API response');}catch(error){response=dataConstraintFailure(error)||new Response(null,{status:500});}
 const headers=new Headers(response.headers);headers.set('X-Request-Id',requestId);
 if(response.status<400)return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
 let source:Record<string,unknown>={};
 if(response.headers.get('Content-Type')?.includes('application/json')){try{source=object(await response.json());}catch{/* An invalid error body gets the safe status default. */}}
 else{void response.body?.cancel().catch(()=>{});}
 const fallback=defaults[response.status]||defaults[500];
 const code=response.status===500?fallback.code:typeof source.code==='string'&&/^[A-Z][A-Z0-9_]{1,63}$/.test(source.code)?source.code:fallback.code;
 const original=source.message??source.error;
 const message=response.status===500?fallback.message:typeof original==='string'&&original.trim()&&original.length<=1000?original:fallback.message;
 // Only explicitly provided public details are exposed (currently the health probe summary).
 const details=response.status===500?undefined:source.details;
 headers.delete('Content-Length');headers.delete('Content-Encoding');headers.delete('Content-Disposition');headers.delete('ETag');
 headers.set('Content-Type','application/json; charset=utf-8');
 headers.set('Cache-Control','private, no-store');headers.set('X-Content-Type-Options','nosniff');
 console.warn(JSON.stringify({event:'api_error',requestId,route,status:response.status,code}));
 return Response.json({code,message,requestId,...(details===undefined?{}:{details})},{status:response.status,headers});
}

// Match only our explicit constraint tokens, never expose a raw SQL error.
export function dataConstraintFailure(error:unknown):Response|null{
 let current=error;
 for(let depth=0;depth<4&&current instanceof Error;depth++){
  const message=current.message;
  if(message.includes('MOTORNA_OWNER_ERASED'))return Response.json({code:'DATA_ERASED',message:'Дані цього профілю видалено. Нові записи заблоковано.'},{status:410});
  if(message.includes('MOTORNA_CAR_HAS_DOCUMENTS'))return Response.json({code:'CAR_HAS_DOCUMENTS',message:'Спочатку видаліть чеки цього автомобіля.'},{status:409});
  if(message.includes('MOTORNA_PARENT_MISSING'))return Response.json({code:'PARENT_NOT_FOUND',message:'Автомобіль або документ уже видалено.'},{status:409});
  current=current.cause;
 }
 return null;
}
