import test from "node:test";
import assert from "node:assert/strict";
import { insertProductWithSlug, productSlug, productSaveError } from "../lib/product-slug.ts";
const conflict = { code: "23505", message: 'duplicate key value violates unique constraint "products_slug_key"' };
function client(respond) {
  const calls = [];
  return { calls, from(table) {
    assert.equal(table, "products");
    return { insert(payload) {
      calls.push(payload);
      return { select() { return { single: async () => respond(payload, calls.length) }; } };
    }};
  }};
}
test("normalizes product URLs", () => {
  assert.equal(productSlug("  DCDB Box 21 / 32A "), "dcdb-box-21-32a");
});
test("uses requested slug when available", async () => {
  const db = client(p => ({ data: { id: "new", slug: p.slug }, error: null }));
  const result = await insertProductWithSlug(db, { name: "Box", slug: "Box 21" });
  assert.equal(result.data.slug, "box-21");
  assert.equal(db.calls.length, 1);
});
test("confirmed collisions get available suffix without overwriting products", async () => {
  const db = client((p, n) => n < 3 ? { error: conflict } : { data: { id: "new", slug: p.slug } });
  const result = await insertProductWithSlug(db, { name: "DCDB", slug: "dcdb" });
  assert.equal(result.data.slug, "dcdb-3");
  assert.deepEqual(db.calls.map(p => p.slug), ["dcdb", "dcdb-2", "dcdb-3"]);
});
test("permission and network failures are not retried", async () => {
  for (const error of [{ code: "42501", message: "permission denied" }, { message: "Failed to fetch" }]) {
    const db = client(() => ({ error }));
    assert.equal((await insertProductWithSlug(db, { slug: "box" })).error, error);
    assert.equal(db.calls.length, 1);
  }
});
test("unrelated unique constraint is not retried", async () => {
  const error = { code: "23505", message: "products_pkey" };
  const db = client(() => ({ error }));
  await insertProductWithSlug(db, { slug: "box" });
  assert.equal(db.calls.length, 1);
});
test("empty slug is rejected before any request", async () => {
  const db = client(() => { throw new Error("unexpected request"); });
  assert.match((await insertProductWithSlug(db, { name: "!!!" })).error.message, /Enter a URL slug/);
  assert.equal(db.calls.length, 0);
});
test("retry limit returns actionable message", async () => {
  const db = client(() => ({ error: conflict }));
  assert.match((await insertProductWithSlug(db, { slug: "box" })).error.message, /more specific/);
  assert.equal(db.calls.length, 20);
});
test("existing-product conflict explains the correction", () => {
  assert.match(productSaveError(conflict), /Change the Slug in Overview/);
});

import { readFileSync } from 'node:fs';
import vm from 'node:vm';
function editField(initial, key, value) {
  const source = readFileSync(new URL('../app/admin/products/page.tsx', import.meta.url), 'utf8');
  const body = source.slice(source.indexOf('  function set(k:'), source.indexOf('  function setV('))
    .replaceAll(': string', '').replaceAll(': any', '');
  let state = initial;
  vm.runInNewContext(body + '\nset(key, value);', {
    key, value, slugify: productSlug, setForm: update => { state = update(state); },
  });
  return state;
}
test('manual slug edits are retained', () => {
  assert.equal(editField({ name: 'Box', slug: 'box' }, 'slug', 'dcdb-21').slug, 'dcdb-21');
});
test('automatic slug follows name typing but preserves a custom URL', () => {
  assert.equal(editField({ name: 'D', slug: 'd' }, 'name', 'DCDB').slug, 'dcdb');
  assert.equal(editField({ name: 'D', slug: 'custom-box' }, 'name', 'DCDB').slug, 'custom-box');
});
