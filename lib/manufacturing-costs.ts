export type ManufacturingItemType = 'component' | 'enclosure' | 'variant'

type DraftItem = {
  item_type: ManufacturingItemType
  item_id: string
  quantity: number | string
  wastage_percent: number | string
}

type CatalogueItem = {
  id: string
  name?: string
  title?: string
  sku?: string | null
  stock_qty?: number | string | null
  cost_price?: number | string | null
  unit?: string | null
  products?: {name?: string} | null
}

export type LiveManufacturingCostLine = {
  item_type: ManufacturingItemType
  item_id: string
  name: string
  sku: string
  unit: string
  quantity: number
  wastage_percent: number
  required_qty: number
  stock_qty: number
  unit_cost: number | null
  line_cost: number
  missing_cost: boolean
}

const number = (value: unknown) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export function calculateGstBreakdown(value: unknown, gstRate: unknown) {
  const exclusive = Math.max(number(value), 0)
  const rate = Math.max(number(gstRate), 0)
  const gstAmount = exclusive * rate / 100
  return {
    exclusive,
    gst_rate: rate,
    gst_amount: gstAmount,
    inclusive: exclusive + gstAmount,
  }
}

export function calculateLiveManufacturingCost(
  items: DraftItem[],
  catalogues: Record<ManufacturingItemType, CatalogueItem[]>,
  extras: {labour_cost: unknown; overhead_cost: unknown; packaging_cost: unknown; target_margin_percent: unknown},
) {
  const maps = {
    component: new Map(catalogues.component.map(item => [item.id, item])),
    enclosure: new Map(catalogues.enclosure.map(item => [item.id, item])),
    variant: new Map(catalogues.variant.map(item => [item.id, item])),
  }
  const lines: LiveManufacturingCostLine[] = items.filter(item => item.item_id).map(item => {
    const selected = maps[item.item_type].get(item.item_id)
    const quantity = Math.max(number(item.quantity), 0)
    const wastage = Math.min(Math.max(number(item.wastage_percent), 0), 100)
    const required = quantity * (1 + wastage / 100)
    const rawCost = selected?.cost_price
    const missingCost = rawCost === null || rawCost === undefined || rawCost === ''
    const cost = missingCost ? null : number(rawCost)
    const name = item.item_type === 'variant'
      ? `${selected?.products?.name || 'Finished product'}${selected?.title ? ` · ${selected.title}` : ''}`
      : selected?.name || 'Catalogue item'
    return {
      item_type: item.item_type,
      item_id: item.item_id,
      name,
      sku: selected?.sku || '',
      unit: selected?.unit || 'pcs',
      quantity,
      wastage_percent: wastage,
      required_qty: required,
      stock_qty: number(selected?.stock_qty),
      unit_cost: cost,
      line_cost: required * (cost || 0),
      missing_cost: missingCost,
    }
  })
  const materialCost = lines.reduce((total, line) => total + line.line_cost, 0)
  const labourCost = Math.max(number(extras.labour_cost), 0)
  const overheadCost = Math.max(number(extras.overhead_cost), 0)
  const packagingCost = Math.max(number(extras.packaging_cost), 0)
  const totalCost = materialCost + labourCost + overheadCost + packagingCost
  const margin = Math.min(Math.max(number(extras.target_margin_percent), 0), 99)
  return {
    lines,
    material_cost: materialCost,
    labour_cost: labourCost,
    overhead_cost: overheadCost,
    packaging_cost: packagingCost,
    total_cost: totalCost,
    recommended_selling_price: totalCost / (1 - margin / 100),
    missing_cost_count: lines.filter(line => line.missing_cost).length,
  }
}
