import {lookupPublicVin} from '@/app/vehicle-intelligence/public-search';
import {apiBoundary} from '@/app/api-response';
import {readJsonObject,jsonBodyFailure} from '@/app/json-body';
import {mutationGuard} from '@/app/mutation-security';

export const dynamic='force-dynamic';

export async function POST(request:Request){
 return apiBoundary(async()=>{

 const denied=mutationGuard(request);if(denied)return denied;
 let vin:string;try{const bodyJson=await readJsonObject(request,200);if(typeof bodyJson.vin!=='string')throw new Error();vin=bodyJson.vin.trim().toUpperCase();if(!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin))throw new Error();}catch(error){const rejected=jsonBodyFailure(error);if(rejected)return rejected;return Response.json({error:'Введіть повний VIN із 17 символів.'},{status:400});}
 const result=await lookupPublicVin({vin,make:'',model:'',year:'',body:'',color:''});
 return Response.json({vin,photos:result.photos.map(p=>({...p,vin:p.sourceVin,host:p.provider})),status:result.state.status});

 },"/api/vin-photos",request);
}
