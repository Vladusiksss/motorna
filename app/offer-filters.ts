export type FilterableOffer={title:string;host:string;price?:number;currency?:string};
export type OfferFilters={text:string;seller:string;currency:string;min:string;max:string;sort:string};
export const emptyOfferFilters:OfferFilters={text:'',seller:'',currency:'',min:'',max:'',sort:'relevance'};
export function filterOffers<T extends FilterableOffer>(offers:T[],filters:OfferFilters):T[]{
 const q=filters.text.trim().toLocaleLowerCase('uk-UA');
 const hasRange=!!filters.currency&&(filters.min!==''||filters.max!=='');
 const min=filters.min===''?0:Number(filters.min),max=filters.max===''?Infinity:Number(filters.max);
 return offers.filter(o=>(!q||`${o.title} ${o.host}`.toLocaleLowerCase('uk-UA').includes(q))&&(!filters.seller||o.host===filters.seller)&&(!filters.currency||o.currency===filters.currency)&&(!hasRange||(typeof o.price==='number'&&o.price>=min&&o.price<=max))).sort((a,b)=>{
  // Different currencies are never compared as though their amounts were equivalent.
  if(!filters.currency||filters.sort==='relevance')return 0;
  if(a.price==null)return b.price==null?0:1;
  if(b.price==null)return -1;
  return filters.sort==='descending'?b.price-a.price:a.price-b.price;
 });
}
