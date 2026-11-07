import {z} from 'zod';
import {httpsUrlSchema,currencySchema} from '../shared/contracts';
const https=httpsUrlSchema.refine(v=>v.length<=2000);
export const purchaseLineSchema=z.object({title:z.string().trim().min(2).max(500),part:z.string().trim().min(2).max(140),oem:z.string().trim().max(50).default(''),url:https.optional(),host:z.string().max(200).optional(),price:z.number().positive().max(10000000).optional(),currency:currencySchema.optional(),quantity:z.number().int().min(1).max(99),checkedAt:z.string().max(50).optional(),availability:z.string().max(100).optional(),dataMode:z.enum(['live','inquiry']),fitment:z.literal('unverified')}).refine(v=>v.price==null||!!v.currency,'Вкажіть валюту ціни').refine(v=>v.dataMode!=='live'||!!v.url,'Потрібне посилання на пропозицію');
export const purchaseRequestSchema=z.object({carId:z.string().uuid(),lines:z.array(purchaseLineSchema).min(1).max(20),note:z.string().trim().max(1000).default(''),status:z.literal('draft')});
