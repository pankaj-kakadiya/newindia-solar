"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, Download, Save, Search } from "lucide-react";
import { supabase } from "../../../../lib/supabase";
import { loadAdminCosts } from "../../../../lib/admin-catalogue-costs";
import { VARIANT_FIELDS } from "../../../../lib/catalogue-projections";

type Row = {
  id: string;
  product_id: string;
  name: string;
  sku: string;
  title: string;
  status: string;
  gst: any;
  mrp: any;
  cost: any;
  selling: any;
  threshold: any;
  active: boolean;
  original: any;
};
const money = (v: any) =>
  `₹${Number(v || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const csv = (v: any) => `"${String(v ?? "").replaceAll('"', '""')}"`;
export default function BulkProductEditor() {
  const [rows, setRows] = useState<Row[]>([]),
    [selected, setSelected] = useState<string[]>([]),
    [q, setQ] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [msg, setMsg] = useState("");
  async function load() {
    setLoading(true);
    const r = await loadAdminCosts(
      supabase,
      supabase
        .from("products")
        .select(`id,name,status,gst_rate,product_variants(${VARIANT_FIELDS})`)
        .order("name")
        .limit(1000),
      "variant",
      "products",
      "product_variants",
    );
    if (r.error) {
      setMsg(r.error.message);
      setRows([]);
    } else
      setRows(
        (r.data || []).flatMap((p: any) =>
          (p.product_variants || []).map((v: any) => ({
            id: v.id,
            product_id: p.id,
            name: p.name,
            sku: v.sku,
            title: v.title,
            status: p.status,
            gst: p.gst_rate,
            mrp: v.mrp ?? "",
            cost: v.cost_price ?? "",
            selling: v.selling_price ?? "",
            threshold: v.low_stock_threshold ?? 5,
            active: !!v.is_active,
            original: {
              status: p.status,
              gst: p.gst_rate,
              mrp: v.mrp ?? "",
              cost: v.cost_price ?? "",
              selling: v.selling_price ?? "",
              threshold: v.low_stock_threshold ?? 5,
              active: !!v.is_active,
            },
          })),
        ),
      );
    setSelected([]);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);
  const filtered = useMemo(
    () =>
      rows.filter((r) =>
        `${r.name} ${r.sku} ${r.title}`.toLowerCase().includes(q.toLowerCase()),
      ),
    [rows, q],
  );
  const changed = (r: Row) =>
    ["status", "gst", "mrp", "cost", "selling", "threshold", "active"].some(
      (k) => (r as any)[k] !== r.original[k],
    );
  const dirty = rows.filter(changed);
  function set(id: string, key: keyof Row, value: any) {
    setRows((all) =>
      all.map((r) => (r.id === id ? { ...r, [key]: value } : r)),
    );
  }
  function toggleAll() {
    const ids = filtered.map((r) => r.id);
    setSelected((s) =>
      ids.every((id) => s.includes(id))
        ? s.filter((id) => !ids.includes(id))
        : Array.from(new Set([...s, ...ids])),
    );
  }
  function applySelected(key: keyof Row, value: any) {
    setRows((all) =>
      all.map((r) => (selected.includes(r.id) ? { ...r, [key]: value } : r)),
    );
  }
  async function save() {
    if (!dirty.length) return setMsg("No changed rows to save.");
    if (!confirm(`Apply ${dirty.length} product variant update(s)?`)) return;
    setBusy(true);
    setMsg("");
    let applied = 0;
    for (const r of dirty) {
      const pricingChanged = ["gst", "mrp", "cost", "selling"].some(
        (k) => (r as any)[k] !== r.original[k],
      );
      if (pricingChanged) {
        const x = await supabase.rpc("update_pricing_item", {
          p_item_type: "variant",
          p_item_id: r.id,
          p_cost: r.cost === "" ? null : Number(r.cost),
          p_selling: r.selling === "" ? null : Number(r.selling),
          p_mrp: r.mrp === "" ? null : Number(r.mrp),
          p_gst: r.gst === "" ? null : Number(r.gst),
          p_reason: "Bulk product editor",
          p_override: false,
        });
        if (x.error) {
          setMsg(`${r.sku}: ${x.error.message}`);
          setBusy(false);
          return;
        }
      }
      const variant = await supabase
        .from("product_variants")
        .update({
          low_stock_threshold: Number(r.threshold || 0),
          is_active: r.active,
        })
        .eq("id", r.id);
      if (variant.error) {
        setMsg(`${r.sku}: ${variant.error.message}`);
        setBusy(false);
        return;
      }
      if (r.status !== r.original.status) {
        const p = await supabase
          .from("products")
          .update({ status: r.status })
          .eq("id", r.product_id);
        if (p.error) {
          setMsg(`${r.sku}: ${p.error.message}`);
          setBusy(false);
          return;
        }
      }
      applied++;
    }
    setBusy(false);
    setMsg(`${applied} product variants updated successfully.`);
    load();
  }
  function exportSheet() {
    const out = [
      [
        "Product",
        "SKU",
        "Variant",
        "Status",
        "Cost Price",
        "Selling Price",
        "MRP",
        "GST %",
        "Low Stock Threshold",
        "Active",
      ],
      ...filtered.map((r) => [
        r.name,
        r.sku,
        r.title,
        r.status,
        r.cost,
        r.selling,
        r.mrp,
        r.gst,
        r.threshold,
        r.active,
      ]),
    ]
      .map((x) => x.map(csv).join(","))
      .join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([out], { type: "text/csv" }));
    a.download = "new-india-solar-bulk-product-editor.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }
  return (
    <div className="bulkProductPage">
      <div className="bulkProductHero">
        <div>
          <Link href="/admin/products">
            <ArrowLeft size={15} /> Products
          </Link>
          <span className="adminEyebrow">BULK PRODUCT OPERATIONS</span>
          <h1>Bulk Product Editor</h1>
          <p>
            Edit cost, selling price, MRP, GST, threshold, status and visibility
            across products in one controlled workspace.
          </p>
        </div>
        <div>
          <button className="adminBtn ghost" onClick={exportSheet}>
            <Download size={16} />
            Export View
          </button>
          <button
            className="adminBtn"
            disabled={busy || !dirty.length}
            onClick={save}
          >
            <Save size={16} />
            {busy ? "Updating…" : `Update ${dirty.length} Changed`}
          </button>
        </div>
      </div>
      {msg && (
        <div className="catalogueMessage">
          <Check size={16} />
          {msg}
        </div>
      )}
      <div className="bulkProductToolbar">
        <label>
          <Search size={16} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search product or SKU"
          />
        </label>
        <span>
          {filtered.length} variants · {dirty.length} changed
        </span>
        {selected.length > 0 && (
          <div>
            <b>{selected.length} selected</b>
            <select
              onChange={(e) =>
                e.target.value && applySelected("status", e.target.value)
              }
              defaultValue=""
            >
              <option value="">Bulk status…</option>
              <option value="active">Active</option>
              <option value="draft">Draft</option>
              <option value="inactive">Inactive</option>
            </select>
            <button onClick={() => applySelected("active", true)}>
              Enable variants
            </button>
            <button onClick={() => applySelected("active", false)}>
              Disable variants
            </button>
          </div>
        )}
      </div>
      <section className="bulkProductPanel">
        <div className="bulkProductTableWrap">
          <table>
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    checked={
                      filtered.length > 0 &&
                      filtered.every((r) => selected.includes(r.id))
                    }
                    onChange={toggleAll}
                  />
                </th>
                <th>Product / SKU</th>
                <th>Status</th>
                <th>Cost</th>
                <th>Selling</th>
                <th>MRP</th>
                <th>GST %</th>
                <th>Margin</th>
                <th>Threshold</th>
                <th>Variant</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} className="catalogueEmpty">
                    Loading products…
                  </td>
                </tr>
              ) : (
                filtered.map((r) => {
                  const margin =
                    Number(r.selling) > 0
                      ? ((Number(r.selling) - Number(r.cost || 0)) /
                          Number(r.selling)) *
                        100
                      : 0;
                  return (
                    <tr key={r.id} className={changed(r) ? "changed" : ""}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selected.includes(r.id)}
                          onChange={() =>
                            setSelected((s) =>
                              s.includes(r.id)
                                ? s.filter((x) => x !== r.id)
                                : [...s, r.id],
                            )
                          }
                        />
                      </td>
                      <td>
                        <b>{r.name}</b>
                        <span>
                          {r.sku} · {r.title}
                        </span>
                      </td>
                      <td>
                        <select
                          value={r.status}
                          onChange={(e) => set(r.id, "status", e.target.value)}
                        >
                          <option value="active">Active</option>
                          <option value="draft">Draft</option>
                          <option value="inactive">Inactive</option>
                        </select>
                      </td>
                      <td>
                        <input
                          type="number"
                          step="0.01"
                          value={r.cost}
                          onChange={(e) => set(r.id, "cost", e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          step="0.01"
                          value={r.selling}
                          onChange={(e) => set(r.id, "selling", e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          step="0.01"
                          value={r.mrp}
                          onChange={(e) => set(r.id, "mrp", e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          step="0.01"
                          value={r.gst}
                          onChange={(e) => set(r.id, "gst", e.target.value)}
                        />
                      </td>
                      <td>
                        <span
                          className={`marginChip ${margin < 15 ? "danger" : margin < 25 ? "warn" : "good"}`}
                        >
                          {margin.toFixed(1)}%
                        </span>
                        <small>
                          {money(
                            Number(r.selling) * (1 + Number(r.gst || 0) / 100),
                          )}{" "}
                          incl.
                        </small>
                      </td>
                      <td>
                        <input
                          type="number"
                          step="1"
                          value={r.threshold}
                          onChange={(e) =>
                            set(r.id, "threshold", e.target.value)
                          }
                        />
                      </td>
                      <td>
                        <label className="bulkSwitch">
                          <input
                            type="checkbox"
                            checked={r.active}
                            onChange={(e) =>
                              set(r.id, "active", e.target.checked)
                            }
                          />
                          <span>{r.active ? "Enabled" : "Disabled"}</span>
                        </label>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
