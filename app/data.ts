// Shared record types and currency formatting used by the garage UI.
// Legacy demo offers and fictional garages were unused and have been removed.
export const money=(n:number)=>new Intl.NumberFormat('uk-UA',{style:'currency',currency:'UAH',maximumFractionDigits:0}).format(n);
export type {RecordItem} from './record-types';
