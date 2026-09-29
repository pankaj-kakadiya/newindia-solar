export type ProductSortKey='catalogue'|'name'|'sku'|'category'|'brand'|'selling'|'cost'|'margin'|'stock'|'status'|'updated'
export type ProductSortDirection='asc'|'desc'
export const productSortOptions: {key:ProductSortKey;label:string;numeric?:boolean}[]=[
 {key:'catalogue',label:'Catalogue order',numeric:true},{key:'name',label:'Product name'},
 {key:'sku',label:'SKU'},{key:'category',label:'Category'},{key:'brand',label:'Brand'},
 {key:'selling',label:'Selling price (ex GST)',numeric:true},{key:'cost',label:'Cost price',numeric:true},
 {key:'margin',label:'Margin %',numeric:true},{key:'stock',label:'Stock quantity',numeric:true},
 {key:'status',label:'Status'},{key:'updated',label:'Last updated'},
]
export const productFirstVariant=(product:any)=>(product.product_variants||[]).find((v:any)=>v.is_active)||(product.product_variants||[])[0]||{}
export function sortProducts<T extends Record<string,any>>(products:T[],brands:{id:string;name:string}[],key:ProductSortKey,direction:ProductSortDirection):T[]{
 const brandById=new Map(brands.map(b=>[b.id,b.name]))
 const collator=new Intl.Collator('en',{numeric:true,sensitivity:'base'})
 const number=(v:unknown)=>v==null||v===''||!Number.isFinite(Number(v))?null:Number(v)
 const value=(p:T):string|number|null=>{
  const v=productFirstVariant(p)
  switch(key){
   case 'catalogue':return number(p.sort_order??0)
   case 'name':return p.name||null
   case 'sku':return v.sku||p.slug||null
   case 'category':return p.categories?.name||'Uncategorised'
   case 'brand':return brandById.get(p.brand_id)||'New India Solar'
   case 'selling':return number(v.selling_price)
   case 'cost':return number(v.cost_price)
   case 'stock':return number(v.stock_qty)
   case 'margin':{const sell=number(v.selling_price),cost=number(v.cost_price);return sell===null||cost===null?null:sell>0?(sell-cost)/sell*100:0}
   case 'status':return p.status||null
   case 'updated':return p.updated_at?number(Date.parse(p.updated_at)):null
  }
 }
 return products.map((product,index)=>({product,index,value:value(product)})).sort((a,b)=>{
  if(a.value===null||b.value===null)return a.value===b.value?a.index-b.index:a.value===null?1:-1
  const comparison=typeof a.value==='number'&&typeof b.value==='number'?a.value-b.value:collator.compare(String(a.value),String(b.value))
  return comparison*(direction==='asc'?1:-1)||a.index-b.index
 }).map(row=>row.product)
}
