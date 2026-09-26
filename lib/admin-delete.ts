type DeleteClient = { from: (table: string) => any };

export function productIdsForRows(rows: { id: string; product_id: string }[], selected: string[]) {
  const selectedIds = new Set(selected);
  return [...new Set(rows.filter(row => selectedIds.has(row.id)).map(row => row.product_id))];
}

export async function deleteAdminRecords(client: DeleteClient, table: 'products' | 'manufacturing_recipes', ids: string[]) {
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  if (!uniqueIds.length) throw new Error('Select at least one record to delete.');
  const { data, error } = await client.from(table).delete().in('id', uniqueIds).select('id');
  if (error) {
    if (error.code === '23503') throw new Error(table === 'products'
      ? 'Cannot delete: a selected product is used in orders, inventory, purchasing or a box recipe. Set it to Inactive instead.'
      : 'Cannot delete: this recipe has production history. Set its status to Archived instead.');
    throw new Error(error.message || 'Deletion failed.');
  }
  const deleted = (data || []).map((row: { id: string }) => row.id) as string[];
  return { deleted, missing: uniqueIds.filter(id => !deleted.includes(id)) };
}
