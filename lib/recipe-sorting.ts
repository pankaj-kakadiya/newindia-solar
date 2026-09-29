export type RecipeSortKey = 'updated' | 'name' | 'sku' | 'type' | 'cost' | 'selling' | 'margin' | 'buildable' | 'shortages' | 'status'
export type SortDirection = 'asc' | 'desc'
export const recipeSortOptions: {key: RecipeSortKey; label: string; numeric?: boolean}[] = [
  {key:'updated',label:'Last updated'}, {key:'name',label:'Recipe name'},
  {key:'sku',label:'Output SKU'}, {key:'type',label:'Box type'},
  {key:'cost',label:'Total cost (ex GST)',numeric:true},
  {key:'selling',label:'Selling price (ex GST)',numeric:true},
  {key:'margin',label:'Current margin %',numeric:true},
  {key:'buildable',label:'Buildable quantity',numeric:true},
  {key:'shortages',label:'Material shortages',numeric:true}, {key:'status',label:'Status'},
]
export function sortRecipes<T extends {id:string;variant_id?:string;name?:string;box_type?:string;status?:string;updated_at?:string}>(recipes:T[], summaries:Record<string,any>, variants:{id:string;sku?:string}[], key:RecipeSortKey, direction:SortDirection):T[]{
  const variantById=new Map(variants.map(v=>[v.id,v]))
  const collator=new Intl.Collator('en',{numeric:true,sensitivity:'base'})
  const number=(value:unknown)=>value==null||value===''||!Number.isFinite(Number(value))?null:Number(value)
  const value=(recipe:T):string|number|null=>{
    const summary=summaries[recipe.id]
    switch(key){
      case 'name':return recipe.name||null
      case 'sku':return variantById.get(recipe.variant_id||'')?.sku||summary?.sku||null
      case 'type':return recipe.box_type||null
      case 'status':return recipe.status||null
      case 'updated':return recipe.updated_at?number(Date.parse(recipe.updated_at)):null
      case 'cost':return number(summary?.total_cost)
      case 'selling':return number(summary?.current_selling_price)
      case 'margin':return number(summary?.gross_margin_percent)
      case 'buildable':return number(summary?.buildable_qty)
      case 'shortages':return number(summary?.shortage_count)
    }
  }
  return recipes.map((recipe,index)=>({recipe,index,value:value(recipe)})).sort((a,b)=>{
    if(a.value===null||b.value===null)return a.value===b.value?a.index-b.index:a.value===null?1:-1
    const comparison=typeof a.value==='number'&&typeof b.value==='number'?a.value-b.value:collator.compare(String(a.value),String(b.value))
    return comparison*(direction==='asc'?1:-1)||a.index-b.index
  }).map(row=>row.recipe)
}
