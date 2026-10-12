import type {VehicleInfo} from './vehicle-search';
export function restoreVehicle(decoded:VehicleInfo,saved:VehicleInfo):VehicleInfo{
 if(!decoded.vin||decoded.vin!==saved.vin)return decoded;
 const fields=new Map(decoded.fields.map(f=>[f.label,f]));
 for(const field of saved.fields)if(field.value)fields.set(field.label,field);
 const result={...decoded,make:saved.make||decoded.make,model:saved.model||decoded.model,year:saved.year||decoded.year,engine:saved.engine||decoded.engine,fields:[...fields.values()],source:saved.source||decoded.source};
 if(result.make&&result.model&&result.year)return {...result,needsConfirmation:false,warning:''};
 return result;
}
export function registeredVehicle(input:unknown,vin:string):VehicleInfo|null{
 if(!input||typeof input!=='object')return null;
 const v=input as VehicleInfo;
 if(v.vin!==vin||typeof v.make!=='string'||!v.make.trim()||typeof v.model!=='string'||!v.model.trim()||!/^\d{4}$/.test(String(v.year))||Number(v.year)<1950||Number(v.year)>new Date().getFullYear()+1)return null;
 return {vin,make:v.make.slice(0,50),model:v.model.slice(0,50),year:String(v.year),engine:typeof v.engine==='string'?v.engine.slice(0,80):'',fields:Array.isArray(v.fields)?v.fields.filter(f=>typeof f?.label==='string'&&typeof f.value==='string').slice(0,40).map(f=>({label:f.label.slice(0,100),value:f.value.slice(0,200)})):[],source:'Відкриті дані МВС',warning:'',checkedAt:typeof v.checkedAt==='string'?v.checkedAt:new Date().toISOString()};
}
