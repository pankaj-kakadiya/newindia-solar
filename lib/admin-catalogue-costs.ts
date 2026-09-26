import type {SupabaseClient} from '@supabase/supabase-js'

type ItemType = 'variant' | 'component' | 'enclosure'
type CostModule = 'products' | 'components' | 'configurator' | 'pricing' | 'inventory' | 'purchasing' | 'workflows' | 'production'
type Row = {id: string; [key: string]: any}
type Result = {data: Row[] | null; error: {message: string} | null}

// Keep costs out of ordinary catalogue queries. Failure must not turn unknown
// costs into zeroes or editable blank fields that could overwrite real costs.
export async function loadAdminCosts(
  client: Pick<SupabaseClient, 'rpc'>,
  query: PromiseLike<{data: any; error: {message: string} | null}>,
  itemType: ItemType,
  module: CostModule,
  nestedKey?: 'product_variants',
): Promise<Result> {
  try {
    const result = await query
    if (result.error) return {data: null, error: result.error}
    const rows: Row[] = result.data || []
    const items: Row[] = nestedKey ? rows.flatMap(row => row[nestedKey] || []) : rows
    const ids = [...new Set(items.map(item => item.id))]
    if (!ids.length) return {data: rows, error: null}
    const costs = new Map<string, number | null>()
    // Stay below the endpoint's limit even for products with many variants.
    for (let offset = 0; offset < ids.length; offset += 1000) {
      const {data, error} = await client.rpc('admin_catalogue_costs', {
        p_item_type: itemType, p_item_ids: ids.slice(offset, offset + 1000), p_module: module,
      })
      if (error) return {data: null, error}
      for (const cost of data || []) costs.set(cost.item_id, cost.cost_price)
    }
    if (ids.some(id => !costs.has(id))) {
      return {data: null, error: {message: 'Some item costs could not be loaded. Refresh before editing.'}}
    }
    const attach = (item: Row): Row => ({...item, cost_price: costs.get(item.id)})
    return {
      data: nestedKey ? rows.map(row => ({...row, [nestedKey]: (row[nestedKey] || []).map(attach)})) : rows.map(attach),
      error: null,
    }
  } catch (error) {
    return {data: null, error: {message: error instanceof Error ? error.message : 'Could not load protected costs.'}}
  }
}
