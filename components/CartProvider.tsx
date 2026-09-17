'use client'
import {createContext,useContext,useEffect,useMemo,useState} from 'react'

export type VisualSelection={value_id:string;quantity:number;option_key?:string}
export type CartItem={
  id:string
  kind:'standard'|'custom'
  name:string
  variant:string
  price:number
  qty:number
  minQty?:number
  productVariantId?:string
  productSlug?:string
  imageUrl?:string
  imageAlt?:string
  customType?:'acdb'|'dcdb'
  templateId?:string
  selectedValueIds?:string[]
  selectedOptions?:Record<string,any>
  visualSelections?:VisualSelection[]
  visualPreview?:Record<string,any>
}
type Ctx={items:CartItem[];add:(i:CartItem)=>void;remove:(id:string)=>void;updateQty:(id:string,q:number)=>void;clear:()=>void;count:number;total:number}
const C=createContext<Ctx|null>(null)
export function CartProvider({children}:{children:React.ReactNode}){
  const [items,setItems]=useState<CartItem[]>([])
  useEffect(()=>{try{setItems(JSON.parse(localStorage.getItem('nis-cart')||'[]'))}catch{}},[])
  useEffect(()=>{localStorage.setItem('nis-cart',JSON.stringify(items))},[items])
  const api=useMemo(()=>({
    items,
    add:(i:CartItem)=>setItems(x=>{const f=x.find(a=>a.id===i.id);return f?x.map(a=>a.id===i.id?{...a,...i,qty:a.qty+i.qty}:a):[...x,i]}),
    remove:(id:string)=>setItems(x=>x.filter(i=>i.id!==id)),
    updateQty:(id:string,q:number)=>setItems(x=>q<=0?x.filter(i=>i.id!==id):x.map(i=>i.id===id?{...i,qty:q}:i)),
    clear:()=>setItems([]),
    count:items.reduce((a,b)=>a+b.qty,0),
    total:items.reduce((a,b)=>a+b.price*b.qty,0)
  }),[items])
  return <C.Provider value={api}>{children}</C.Provider>
}
export function useCart(){const x=useContext(C);if(!x)throw new Error('CartProvider missing');return x}
