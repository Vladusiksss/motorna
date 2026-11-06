import {readApi} from './api-contracts';
import {z} from 'zod';
import {parseRecord,type RecordItem,type RecordKind} from './record-types';
export const pageSchema=z.object({limit:z.number().int().positive(),total:z.number().int().nonnegative(),hasMore:z.boolean(),nextCursor:z.string().nullable()});
export type RecordsPage=z.infer<typeof pageSchema>;
export function parseRecordsPage(value:unknown){const data=z.object({user:z.object({name:z.string(),email:z.string().nullish().transform(v=>v||'')}),records:z.array(z.unknown()),page:pageSchema}).parse(value);return {...data,records:data.records.map(parseRecord)};}
export function mergeRecords(...groups:RecordItem[][]){return [...new Map(groups.flat().map(r=>[r.id,r])).values()].sort((a,b)=>b.created-a.created||(a.id<b.id?1:a.id>b.id?-1:0));}

// Full traversal is reserved for an explicit export, never the initial page load.
export async function fetchAllRecords(filter:{kind:RecordKind;carId?:string},fetcher:typeof fetch=fetch){
 const query=new URLSearchParams({kind:filter.kind,limit:'100'});if(filter.carId)query.set('carId',filter.carId);
 let result:RecordItem[]=[];const visited=new Set<string>();
 while(true){const response=await fetcher('/api/records?'+query);const data=parseRecordsPage(await readApi(response));result=mergeRecords(result,data.records);if(!data.page.hasMore)return result;if(!data.page.nextCursor||visited.has(data.page.nextCursor))throw new Error('Некоректна сторінка звіту.');visited.add(data.page.nextCursor);query.set('cursor',data.page.nextCursor);}
}
