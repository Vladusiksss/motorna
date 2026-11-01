"use client";
import {createContext,useContext,useState} from 'react';
import {toast} from 'sonner';
import {addPurchaseLine,type PurchaseDraft,type PurchaseLine} from './purchase-model';
type PurchaseContextValue={drafts:PurchaseDraft[];add:(vehicle:Omit<PurchaseDraft,'lines'|'note'>,line:PurchaseLine)=>void;update:(draft:PurchaseDraft)=>void;clear:(carId:string)=>void;open:boolean;setOpen:(value:boolean)=>void};
const Context=createContext<PurchaseContextValue|null>(null);
export function PurchaseProvider({children}:{children:React.ReactNode}){
 const [drafts,setDrafts]=useState<PurchaseDraft[]>([]),[open,setOpen]=useState(false);
 function add(vehicle:Omit<PurchaseDraft,'lines'|'note'>,line:PurchaseLine){
  if(line.dataMode==='demo'){toast.error('Це демонстраційні дані.');return;}
  setDrafts(old=>{try{const next=addPurchaseLine(old.find(d=>d.carId===vehicle.carId),vehicle,line);return [...old.filter(d=>d.carId!==vehicle.carId),next];}catch{return old;}});
  setOpen(true);
 }
 return <Context.Provider value={{drafts,add,update:draft=>setDrafts(old=>old.map(d=>d.carId===draft.carId?draft:d)),clear:carId=>setDrafts(old=>old.filter(d=>d.carId!==carId)),open,setOpen}}>{children}</Context.Provider>;
}
export function usePurchase(){const value=useContext(Context);if(!value)throw Error('PurchaseProvider missing');return value;}
