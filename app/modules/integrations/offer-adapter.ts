import {findOffers,type ProductOffer} from '@/app/product-offers';
import {isCurrency,toMinor,type Money} from '@/app/money';
export type OfferSearch={vehicle:string;part:string;model:string;oem:string};
export interface OfferAdapter{readonly id:string;readonly capabilities:{exactArticle:boolean;vinFitment:boolean};search(query:OfferSearch):Promise<{query:string;results:ProductOffer[]}>}
export const webOfferAdapter:OfferAdapter={id:'public-product-pages',capabilities:{exactArticle:true,vinFitment:false},search:q=>findOffers(q.vehicle,q.part,q.model,q.oem)};
export function offerMoney(offer:ProductOffer):Money|null{
 if(!isCurrency(offer.currency))return null;
 try{return {amountMinor:toMinor(offer.price,offer.currency),currency:offer.currency};}catch{return null;}
}
