import test from "node:test";
import assert from "node:assert/strict";
import { saveProductImages } from "../lib/product-images.ts";

const image = (id = "a", url = "/a.png", order = 0) => ({
  id, image_url: url, alt_text: "Box", sort_order: order,
});
function database(initial = [], failure) {
  const rows = new Map(initial.map(row => [row.id, { ...row, product_id: "p" }]));
  const calls = [];
  return { rows, calls, from(table) {
    assert.equal(table, "product_images");
    let action, payload;
    const filters = {};
    const q = {
      update(value) { action = "update"; payload = value; return q; },
      upsert(value) { action = "upsert"; payload = value; return q; },
      delete() { action = "delete"; return q; },
      eq(key, value) { filters[key] = value; return q; },
      select() { return q; },
      single() { return q.then(result => ({ ...result, data: result.data?.[0] })); },
      then(resolve, reject) {
        return Promise.resolve().then(() => {
          calls.push(action);
          const problem = failure?.(action);
          if (problem) return problem;
          const found = [...rows.values()].filter(row =>
            Object.entries(filters).every(([key, value]) => row[key] === value));
          if (action === "upsert") { rows.set(payload.id, { ...payload }); return { data: [payload] }; }
          if (action === "update") found.forEach(row => rows.set(row.id, { ...row, ...payload }));
          if (action === "delete") found.forEach(row => rows.delete(row.id));
          return { data: found };
        }).then(resolve, reject);
      },
    };
    return q;
  }};
}
test("saving unchanged images repeatedly performs no image writes", async () => {
  const original = [image()];
  const db = database(original);
  for (let i = 0; i < 3; i++) await saveProductImages(db, "p", original, original.map(x => ({ ...x })));
  assert.deepEqual(db.calls, []);
  assert.equal(db.rows.size, 1);
});
test("editing alt text preserves image identity", async () => {
  const original = [image()];
  const db = database(original);
  await saveProductImages(db, "p", original, [{ ...image(), alt_text: "Front view" }]);
  assert.deepEqual(db.calls, ["update"]);
  assert.equal(db.rows.get("a").alt_text, "Front view");
});
test("adding an image and retrying keeps exactly one new row", async () => {
  const original = [image()];
  const db = database(original);
  const draft = [image(), image(undefined, "/b.png", 1)];
  delete draft[1].id;
  await saveProductImages(db, "p", original, draft);
  await saveProductImages(db, "p", original, draft);
  assert.equal(db.rows.size, 2);
  assert.ok(draft[1].id);
});
test("removal only deletes explicitly removed rows from the original gallery", async () => {
  const original = [image(), image("b", "/b.png", 1)];
  const db = database([...original, image("concurrent", "/c.png", 2)]);
  await saveProductImages(db, "p", original, [image()]);
  assert.equal(db.rows.has("b"), false);
  assert.equal(db.rows.has("a"), true);
  assert.equal(db.rows.has("concurrent"), true);
});
test("denied deletion is reported without reinserting the gallery", async () => {
  const original = [image()];
  const db = database(original, () => ({ data: [], error: null }));
  await assert.rejects(saveProductImages(db, "p", original, []), /removal was not confirmed/);
  assert.deepEqual(db.calls, ["delete"]);
  assert.equal(db.rows.size, 1);
});
test("write errors stop saving and retain original images", async () => {
  const original = [image()];
  const db = database(original, () => ({ error: { message: "permission denied" } }));
  await assert.rejects(saveProductImages(db, "p", original, [{ ...image(), alt_text: "Edit" }]), /permission denied/);
  assert.equal(db.rows.size, 1);
});
test("new duplicate URLs are rejected before writes; blank slots are ignored", async () => {
  const original = [image()];
  const db = database(original);
  await assert.rejects(saveProductImages(db, "p", original, [image(), { ...image(), id: undefined }]), /already in the gallery/);
  await saveProductImages(db, "p", original, [image(), { ...image(), id: undefined, image_url: " " }]);
  assert.deepEqual(db.calls, []);
});
test("intentional product copy gets new image IDs", async () => {
  const db = database([image()]);
  await saveProductImages(db, "copy", [], [{ ...image(), id: undefined }]);
  assert.equal(db.rows.size, 2);
  assert.equal([...db.rows.values()].filter(row => row.product_id === "copy").length, 1);
});
