export function productSlug(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function isProductSlugConflict(error: any) {
  return error?.code === "23505" &&
    String(error.message || "").includes("products_slug_key");
}

export function productSaveError(error: any) {
  if (isProductSlugConflict(error))
    return "Another product already uses this URL slug. Change the Slug in Overview, or open the existing product to edit it.";
  return error?.message || "Unable to save product.";
}

// Retry only confirmed slug collisions. Never retry ambiguous network failures,
// permission failures, or unrelated unique constraints.
export async function insertProductWithSlug(client: any, payload: Record<string, any>) {
  const base = productSlug(payload.slug || payload.name || "");
  if (!base) return { data: null, error: { message: "Enter a URL slug using letters or numbers in Overview." } };
  for (let attempt = 0; attempt < 20; attempt++) {
    const slug = attempt === 0 ? base : `${base}-${attempt + 1}`;
    const result = await client.from("products").insert({ ...payload, slug })
      .select("id,slug").single();
    if (!isProductSlugConflict(result.error)) return result;
  }
  return { data: null, error: { message: "This URL slug has many existing copies. Enter a more specific Slug in Overview and save again." } };
}
