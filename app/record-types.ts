import {z} from 'zod';
import {schemas} from './validation';
export type RecordKind=keyof typeof schemas;
type Data<K extends RecordKind>=z.infer<(typeof schemas)[K]> & (K extends 'purchaseRequest'?{vehicle:string;vin:string}:object);
export type RecordOf<K extends RecordKind>={id:string;kind:K;data:Data<K>;created:number};
export type RecordItem={[K in RecordKind]:RecordOf<K>}[RecordKind];
export type SaveRecord=(kind:RecordKind,data:unknown,id?:string)=>Promise<RecordItem|null>;
export const documentSchema=z.object({id:z.string().uuid(),name:z.string(),size:z.number(),mime:z.string(),created:z.number(),carId:z.string().nullish().transform(value=>value??undefined)});
export type DocumentInfo=z.infer<typeof documentSchema>;
export type RemovableRecord=RecordItem|{id:string;kind:'document';data:DocumentInfo;created:number};
const envelope=z.object({id:z.string().uuid(),kind:z.string(),data:z.unknown(),created:z.number()});
export function parseRecord(value:unknown):RecordItem{
 const row=envelope.parse(value);
 if(!Object.hasOwn(schemas,row.kind))throw new Error('Невідомий тип запису.');
 const kind=row.kind as RecordKind;
 const data=schemas[kind].parse(row.data);
 const snapshot=kind==='purchaseRequest'?z.object({vehicle:z.string(),vin:z.string()}).parse(row.data):{};
 // Both the discriminator and its corresponding schema were checked above.
 return {...row,kind,data:{...data,...snapshot}} as RecordItem;
}
export function errorMessage(value:unknown,fallback='Спробуйте ще раз.'){return value instanceof Error?value.message:fallback;}
