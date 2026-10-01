import {z} from 'zod';
const label=z.string().trim().min(1).max(120);
const validDate=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>{const d=new Date(v+'T12:00:00Z');return Number.isFinite(d.getTime()) && d.toISOString().slice(0,10)===v;},'Невірна дата');
const https=z.string().url().max(2000).refine(v=>v.startsWith('https://'));
export const schemas={
 searchHistory:z.object({oem:z.string().max(40).optional(),vehicle:z.string().min(1).max(200),carId:z.string().uuid(),problem:z.string().max(1000),parts:z.array(z.string().min(2).max(140)).min(1).max(20),results:z.array(z.object({title:z.string().max(500),url:https,host:z.string().max(200),price:z.number().positive().max(10000000).optional(),currency:z.enum(['UAH','EUR','USD','GBP']).optional(),availability:z.string().max(100).optional(),checkedAt:z.string().max(50).optional(),part:z.string().max(140).optional(),fitment:z.object({status:z.literal('unverified'),reason:z.string().max(300)}).optional()})).max(20),videos:z.array(z.object({title:z.string().max(200),url:https})).max(10)}),
 webFavorite:z.object({title:z.string().min(1).max(200),url:z.string().url().max(2000).refine(v=>v.startsWith('https://')),vehicle:z.string().max(200)}),
 car:z.object({name:label,make:z.string().max(100).optional(),model:z.string().max(100).optional(),year:z.number().int().min(1950).max(2030),engine:z.string().max(80),vin:z.string().regex(/^$|^[A-HJ-NPR-Z0-9]{17}$/),mileage:z.number().int().min(0).max(3000000),nextService:z.number().int().min(0).max(3000000),source:z.string().max(80).optional(),specifications:z.array(z.object({label:z.string().max(100),value:z.string().max(500)})).max(40).optional()}),
 favorite:z.object({partId:z.string().regex(/^p(?:[1-9]|1[0-2])$/)}),
 cart:z.object({partId:z.string().regex(/^p(?:[1-9]|1[0-2])$/),quantity:z.number().int().min(1).max(20),shop:label,price:z.number().min(0).max(1000000),delivery:z.number().min(0).max(100000)}),
 expense:z.object({carId:z.string().uuid(),title:label,date:validDate,amount:z.number().positive().max(10000000),mileage:z.number().int().min(0).max(3000000)}),
 plan:z.object({title:label,date:validDate,service:label,note:z.string().max(1000),amount:z.number().min(0).max(10000000)}),
};


