export type ProductImage = {
  id?: string;
  image_url: string;
  alt_text: string;
  sort_order: number;
};

// Preserve row identity. Never delete/reinsert a gallery just to save a product.
// The caller keeps draft objects across retries so new UUIDs remain stable.
export async function saveProductImages(
  client: any,
  productId: string,
  original: ProductImage[],
  draft: ProductImage[],
) {
  const images = draft.filter(image => image.image_url.trim());
  const before = new Map(original.map(image => [image.id, image]));
  const urls = new Set<string>();
  for (const image of images) {
    const url = image.image_url.trim();
    // Existing legacy duplicates are preserved; reject newly introduced copies.
    if (urls.has(url) && !before.has(image.id))
      throw new Error("This image URL is already in the gallery. Remove the extra image before saving.");
    urls.add(url);
  }
  for (const [index, image] of images.entries()) {
    const old = before.get(image.id);
    const payload = {
      image_url: image.image_url.trim(),
      alt_text: image.alt_text || "",
      sort_order: index,
    };
    if (old && old.image_url === payload.image_url &&
        (old.alt_text || "") === payload.alt_text && old.sort_order === index) continue;
    let query;
    if (old) {
      query = client.from("product_images").update(payload)
        .eq("product_id", productId).eq("id", image.id);
    } else {
      // Reuse the ID if a response is lost after the database commits.
      image.id ||= crypto.randomUUID();
      query = client.from("product_images").upsert(
        { ...payload, id: image.id, product_id: productId }, { onConflict: "id" },
      );
    }
    const result = await query.select("id").single();
    if (result.error) throw new Error(result.error.message);
    if (!result.data?.id) throw new Error("Image was not saved. Check your product edit permission.");
  }
  const keep = new Set(images.map(image => image.id));
  for (const old of original) {
    if (!old.id || keep.has(old.id)) continue;
    const result = await client.from("product_images").delete()
      .eq("product_id", productId).eq("id", old.id).select("id");
    if (result.error) throw new Error(result.error.message);
    // A missing row can mean RLS denied deletion or another editor removed it.
    if (!result.data?.some((row: { id: string }) => row.id === old.id))
      throw new Error("Image removal was not confirmed. Refresh and check your product delete permission.");
  }
}
