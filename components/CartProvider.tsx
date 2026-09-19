'use client'
import {createContext,useCallback,useContext,useEffect,useMemo,useRef,useState} from 'react'
import {cartAmounts,mergeCart,mergeCartMany,readCart,rounded} from '../lib/buyer-commerce'
import type {BuyerCartItem} from '../lib/buyer-commerce'
export type VisualSelection={value_id:string;quantity:number;option_key?:string}
export type CartItem=BuyerCartItem
export type AddResult={ok:true}|{ok:false;error:string}
type Ctx={items:CartItem[];ready:boolean;storageWarning:string;add:(i:CartItem)=>void;addChecked:(i:CartItem,maxQty?:number)=>AddResult;addAllChecked:(additions:{item:CartItem;maxQty?:number}[])=>AddResult;remove:(id:string)=>void;updateQty:(id:string,q:number)=>void;clear:()=>void;count:number;total:number;tax:number|null;grandTotal:number|null}
const C=createContext<Ctx|null>(null)
const KEY='nis-cart'
export function CartProvider({children}:{children:React.ReactNode}){
  const [items,setItems]=useState<CartItem[]>([]),[ready,setReady]=useState(false),[storageWarning,setStorageWarning]=useState('')
  const current=useRef<CartItem[]>([]),hydrated=useRef(false)
  useEffect(()=>{
    try{current.current=readCart(localStorage.getItem(KEY));setItems(current.current)}catch{setStorageWarning('Browser storage is unavailable; this cart will last for this visit only.')}
    hydrated.current=true;setReady(true)
    const onStorage=(event:StorageEvent)=>{if(event.key===KEY){current.current=readCart(event.newValue);setItems(current.current)}}
    window.addEventListener('storage',onStorage);return()=>window.removeEventListener('storage',onStorage)
  },[])
  const commit=useCallback((next:CartItem[])=>{
    current.current=next;setItems(next)
    if(hydrated.current)try{localStorage.setItem(KEY,JSON.stringify(next))}catch{setStorageWarning('The cart could not be saved in this browser. Keep this tab open.')}
  },[])
  // Another tab may have written to storage since this tab's last render; re-reading
  // immediately before merging narrows the window in which two concurrent additions
  // (this tab and another) could otherwise cause one of them to be lost.
  const latest=useCallback(():CartItem[]=>{
    if(!hydrated.current)return current.current
    try{const fresh=readCart(localStorage.getItem(KEY));current.current=fresh;return fresh}catch{return current.current}
  },[])
  const addChecked=useCallback((item:CartItem,maxQty?:number):AddResult=>{
    if(!hydrated.current)return{ok:false,error:'Please wait for your cart to finish loading.'}
    const result=mergeCart(latest(),item,maxQty)
    if(!result.ok)return result
    commit(result.items);return{ok:true}
  },[commit,latest])
  const addAllChecked=useCallback((additions:{item:CartItem;maxQty?:number}[]):AddResult=>{
    if(!hydrated.current)return{ok:false,error:'Please wait for your cart to finish loading.'}
    const result=mergeCartMany(latest(),additions)
    if(!result.ok)return result
    commit(result.items);return{ok:true}
  },[commit,latest])
  const api=useMemo(()=>{
    const amounts=cartAmounts(items)
    return{items,ready,storageWarning,addChecked,addAllChecked,add:(i:CartItem)=>{const result=addChecked(i);if(!result.ok)throw new Error(result.error)},remove:(id:string)=>commit(current.current.filter(i=>i.id!==id)),updateQty:(id:string,q:number)=>{if(!Number.isFinite(q))return;commit(q<=0?current.current.filter(i=>i.id!==id):current.current.map(i=>i.id===id?{...i,qty:rounded(q,6)}:i))},clear:()=>commit([]),count:rounded(items.reduce((a,b)=>a+b.qty,0),6),total:amounts.subtotal,tax:amounts.tax,grandTotal:amounts.total}
  },[items,ready,storageWarning,addChecked,addAllChecked,commit])
  return <C.Provider value={api}>{children}</C.Provider>
}
export function useCart(){const ctx=useContext(C);if(!ctx)throw new Error('CartProvider missing');return ctx}
