import {decodeVpic,VpicError} from '@/app/vpic';
export const dynamic='force-dynamic';
export async function POST(request:Request){
 if(request.headers.get('sec-fetch-site')==='cross-site')return Response.json({error:'Недозволений запит'},{status:403});
 let identifier:string;try{const text=await request.text();if(text.length>1000)throw new Error();const body=JSON.parse(text);if(typeof body.identifier!=='string')throw new Error();identifier=body.identifier;}catch{return Response.json({error:'Введіть VIN автомобіля.'},{status:400});}
 try{return Response.json({vehicle:await decodeVpic(identifier)},{headers:{'Cache-Control':'no-store'}});}catch(e){return Response.json({error:e instanceof VpicError?e.message:'Пошук авто тимчасово недоступний.'},{status:e instanceof VpicError?e.status:503});}
}
