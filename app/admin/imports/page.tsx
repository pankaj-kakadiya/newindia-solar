"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  History,
  RotateCcw,
  ShieldCheck,
  Upload,
  Users,
  Package,
  Boxes,
  Building2,
  IndianRupee,
  Warehouse,
  RefreshCw,
} from "lucide-react";
import * as XLSX from "xlsx";
import { supabase } from "../../../lib/supabase";
import "./imports-v2.css";

type ImportType =
  | "products"
  | "components"
  | "customers"
  | "suppliers"
  | "pricing"
  | "opening_stock";
type Mode = "insert" | "update" | "upsert";
type Tab = "new" | "history" | "templates";

type TypeConfig = {
  label: string;
  description: string;
  icon: any;
  columns: string[];
  sample: Record<string, any>;
};
const typeConfig: Record<ImportType, TypeConfig> = {
  products: {
    label: "Products & Variants",
    description: "Create or update products and finished-good variants by SKU.",
    icon: Package,
    columns: [
      "product_name",
      "slug",
      "product_type",
      "status",
      "hsn_code",
      "gst_rate",
      "warranty_months",
      "lead_time_days",
      "min_order_qty",
      "featured",
      "variant_sku",
      "variant_title",
      "mrp",
      "selling_price",
      "cost_price",
      "stock_qty",
      "low_stock_threshold",
      "unit",
      "weight_kg",
      "is_active",
    ],
    sample: {
      product_name: "3kW ACDB",
      slug: "3kw-acdb",
      product_type: "standard",
      status: "draft",
      hsn_code: "8537",
      gst_rate: 18,
      warranty_months: 12,
      lead_time_days: 3,
      min_order_qty: 1,
      featured: false,
      variant_sku: "NIS-ACDB-3KW",
      variant_title: "Standard",
      mrp: 3500,
      selling_price: 2800,
      cost_price: 2100,
      stock_qty: 0,
      low_stock_threshold: 5,
      unit: "pcs",
      weight_kg: 1.5,
      is_active: true,
    },
  },
  components: {
    label: "Components",
    description:
      "Bulk create/update MCB, MCCB, SPD, fuse, terminal and other component masters.",
    icon: Boxes,
    columns: [
      "name",
      "category",
      "sku",
      "model",
      "cost_price",
      "selling_price",
      "gst_rate",
      "stock_qty",
      "unit",
      "low_stock_threshold",
      "is_active",
    ],
    sample: {
      name: "DC MCB 32A 2P",
      category: "MCB",
      sku: "MCB-DC-32A-2P",
      model: "32A 2P",
      cost_price: 425,
      selling_price: 550,
      gst_rate: 18,
      stock_qty: 0,
      unit: "pcs",
      low_stock_threshold: 10,
      is_active: true,
    },
  },
  customers: {
    label: "Customers",
    description:
      "Import EPC, dealer, distributor, installer, industrial and retail CRM accounts.",
    icon: Users,
    columns: [
      "full_name",
      "company_name",
      "email",
      "phone",
      "gstin",
      "customer_type",
      "tags",
      "account_status",
      "credit_limit",
      "credit_days",
      "payment_terms",
      "internal_notes",
    ],
    sample: {
      full_name: "Amit Patel",
      company_name: "ABC Solar EPC",
      email: "amit@example.com",
      phone: "9876543210",
      gstin: "24ABCDE1234F1Z5",
      customer_type: "EPC",
      tags: "Gujarat EPC,High Value",
      account_status: "active",
      credit_limit: 500000,
      credit_days: 30,
      payment_terms: "30 Days",
      internal_notes: "Imported customer",
    },
  },
  suppliers: {
    label: "Suppliers",
    description: "Create/update supplier master records and commercial terms.",
    icon: Building2,
    columns: [
      "company_name",
      "contact_name",
      "phone",
      "alternate_phone",
      "email",
      "gstin",
      "pan",
      "city",
      "state",
      "supplier_type",
      "payment_terms",
      "credit_days",
      "default_lead_time_days",
      "categories",
      "brands",
      "status",
      "notes",
    ],
    sample: {
      company_name: "Solar Components India",
      contact_name: "Rakesh",
      phone: "9876543210",
      alternate_phone: "",
      email: "sales@example.com",
      gstin: "24ABCDE1234F1Z5",
      pan: "ABCDE1234F",
      city: "Surat",
      state: "Gujarat",
      supplier_type: "manufacturer",
      payment_terms: "30 Days",
      credit_days: 30,
      default_lead_time_days: 7,
      categories: "MCB,SPD",
      brands: "Siemens,FONIX",
      status: "active",
      notes: "Approved vendor",
    },
  },
  pricing: {
    label: "Pricing Update",
    description:
      "Update cost, selling price, MRP and GST by item SKU under margin controls.",
    icon: IndianRupee,
    columns: [
      "item_type",
      "identifier",
      "cost_price",
      "selling_price",
      "mrp",
      "gst_rate",
      "reason",
      "override",
    ],
    sample: {
      item_type: "component",
      identifier: "MCB-DC-32A-2P",
      cost_price: 410,
      selling_price: 550,
      mrp: "",
      gst_rate: 18,
      reason: "September supplier revision",
      override: false,
    },
  },
  opening_stock: {
    label: "Opening / Stock Adjustment",
    description:
      "Post controlled inventory adjustments by SKU with movement history.",
    icon: Warehouse,
    columns: ["item_type", "identifier", "quantity", "note"],
    sample: {
      item_type: "component",
      identifier: "MCB-DC-32A-2P",
      quantity: 100,
      note: "Opening stock count",
    },
  },
};

function normalizeHeader(v: any) {
  return String(v ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}
function csvEscape(v: any) {
  return `"${String(v ?? "").replaceAll('"', '""')}"`;
}
function downloadBlob(
  content: string,
  name: string,
  type = "text/csv;charset=utf-8",
) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([content], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 500);
}
function fmt(v: any) {
  return v
    ? new Date(v).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";
}

export default function ImportCenter() {
  const [tab, setTab] = useState<Tab>("new"),
    [importType, setImportType] = useState<ImportType>("products"),
    [mode, setMode] = useState<Mode>("upsert");
  const [rows, setRows] = useState<Record<string, any>[]>([]),
    [fileName, setFileName] = useState(""),
    [fileFormat, setFileFormat] = useState("csv"),
    [busy, setBusy] = useState(false),
    [msg, setMsg] = useState("");
  const [jobs, setJobs] = useState<any[]>([]),
    [job, setJob] = useState<any>(null),
    [jobRows, setJobRows] = useState<any[]>([]),
    [historyLoading, setHistoryLoading] = useState(false);
  const cfg = typeConfig[importType];

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get(
      "type",
    ) as ImportType | null;
    if (requested && typeConfig[requested]) {
      setImportType(requested);
      setTab("new");
      setMode("update");
    }
  }, []);

  async function loadHistory() {
    setHistoryLoading(true);
    const { data, error } = await supabase
      .from("bulk_import_jobs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) setMsg(error.message);
    else setJobs(data || []);
    setHistoryLoading(false);
  }
  useEffect(() => {
    loadHistory();
  }, []);
  async function loadJob(id: string) {
    const [{ data: j, error: e1 }, { data: r, error: e2 }] = await Promise.all([
      supabase.from("bulk_import_jobs").select("*").eq("id", id).single(),
      supabase
        .from("bulk_import_rows")
        .select("*")
        .eq("job_id", id)
        .order("row_number")
        .limit(2000),
    ]);
    if (e1 || e2) {
      setMsg(e1?.message || e2?.message || "Unable to load import.");
      return;
    }
    setJob(j);
    setJobRows(r || []);
  }

  async function parseFile(file: File) {
    setBusy(true);
    setMsg("");
    try {
      const ext = (file.name.split(".").pop() || "").toLowerCase();
      let parsed: any[] = [];
      if (ext === "csv") {
        const text = await file.text();
        const wb = XLSX.read(text, { type: "string" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        parsed = XLSX.utils.sheet_to_json(ws, {
          defval: "",
          raw: false,
        }) as any[];
      } else if (["xlsx", "xls"].includes(ext)) {
        const ab = await file.arrayBuffer();
        const wb = XLSX.read(ab, { type: "array", cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        parsed = XLSX.utils.sheet_to_json(ws, {
          defval: "",
          raw: false,
        }) as any[];
      } else throw new Error("Use CSV, XLSX or XLS files only.");
      if (parsed.length > 2000)
        throw new Error(
          "Maximum 2,000 rows per import. Split larger files into separate batches.",
        );
      const cleaned: Record<string, any>[] = parsed.map(
        (row) =>
          Object.fromEntries(
            Object.entries(row).map(([k, v]) => [
              normalizeHeader(k),
              typeof v === "string" ? v.trim() : v,
            ]),
          ) as Record<string, any>,
      );
      setRows(cleaned);
      setFileName(file.name);
      setFileFormat(ext);
      setJob(null);
      setJobRows([]);
      setMsg(
        `${cleaned.length} rows loaded. Review the preview, then validate.`,
      );
    } catch (e: any) {
      setRows([]);
      setFileName("");
      setMsg(e.message || "Could not read file.");
    } finally {
      setBusy(false);
    }
  }

  async function validateImport() {
    if (!rows.length) return setMsg("Choose a CSV or Excel file first.");
    setBusy(true);
    setMsg("");
    const { data, error } = await supabase.rpc("prepare_bulk_import", {
      p_import_type: importType,
      p_file_name: fileName,
      p_file_format: fileFormat,
      p_mode: mode,
      p_rows: rows,
    });
    if (error) {
      setBusy(false);
      setMsg(error.message);
      return;
    }
    await loadJob(data as string);
    await loadHistory();
    setBusy(false);
    setMsg(
      "Validation complete. Fix errors in your file or commit the valid rows.",
    );
  }
  async function commitImport() {
    if (!job?.id) return;
    if (!job.valid_rows) return setMsg("There are no valid rows to import.");
    if (
      !confirm(`Commit ${job.valid_rows} valid rows to the live ERP database?`)
    )
      return;
    setBusy(true);
    const { data, error } = await supabase.rpc("commit_bulk_import", {
      p_job_id: job.id,
    });
    if (error) setMsg(error.message);
    else
      setMsg(
        `Import completed: ${(data as any)?.inserted || 0} inserted, ${(data as any)?.updated || 0} updated, ${(data as any)?.failed || 0} failed.`,
      );
    await loadJob(job.id);
    await loadHistory();
    setBusy(false);
  }
  async function rollbackImport(j: any) {
    if (!j.rollback_available) return;
    if (
      !confirm(
        `Rollback import ${j.file_name || j.id}? This restores captured values and reverses inserted records where safe.`,
      )
    )
      return;
    setBusy(true);
    const { data, error } = await supabase.rpc("rollback_bulk_import", {
      p_job_id: j.id,
    });
    if (error) setMsg(error.message);
    else
      setMsg(
        `Rollback completed for ${(data as any)?.rolled_back_rows || 0} rows.`,
      );
    await loadHistory();
    if (job?.id === j.id) await loadJob(j.id);
    setBusy(false);
  }

  function templateRows(type: ImportType): Record<string, any>[] {
    const c = typeConfig[type];
    const row: Record<string, any> = {};
    c.columns.forEach((k) => {
      row[k] = c.sample[k] ?? "";
    });
    return [row];
  }
  function downloadTemplate(type: ImportType, format: "csv" | "xlsx") {
    const c = typeConfig[type],
      data = templateRows(type);
    if (format === "csv") {
      const csv = [
        c.columns.join(","),
        ...data.map((r: Record<string, any>) =>
          c.columns.map((k) => csvEscape(r[k])).join(","),
        ),
      ].join("\n");
      downloadBlob(csv, `new-india-solar-${type}-template.csv`);
      return;
    }
    const ws = XLSX.utils.json_to_sheet(data, { header: c.columns });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Import Template");
    XLSX.writeFile(wb, `new-india-solar-${type}-template.xlsx`);
  }
  function downloadErrors() {
    if (!jobRows.length) return;
    const errors = jobRows.filter((r) => r.validation_status === "error");
    const allKeys: string[] = Array.from(
      new Set<string>(errors.flatMap((r) => Object.keys(r.raw_data || {}))),
    );
    const head = ["row_number", ...allKeys, "errors"];
    const csv = [
      head.map(csvEscape).join(","),
      ...errors.map((r) =>
        [
          r.row_number,
          ...allKeys.map((k) => r.raw_data?.[k] ?? ""),
          (r.errors || []).join(" | "),
        ]
          .map(csvEscape)
          .join(","),
      ),
    ].join("\n");
    downloadBlob(csv, `import-errors-${job?.id?.slice(0, 8) || "report"}.csv`);
  }

  const preview = rows.slice(0, 8),
    previewCols = useMemo(
      () =>
        Array.from(
          new Set<string>(preview.flatMap((r) => Object.keys(r))),
        ).slice(0, 12),
      [rows],
    );
  const validCount = jobRows.filter(
      (r) => r.validation_status === "valid",
    ).length,
    errorCount = jobRows.filter((r) => r.validation_status === "error").length;
  const totals = useMemo(
    () => ({
      jobs: jobs.length,
      imported: jobs.filter((j) =>
        ["imported", "imported_with_errors"].includes(j.status),
      ).length,
      rows: jobs.reduce(
        (a, j) =>
          a + Number(j.inserted_rows || 0) + Number(j.updated_rows || 0),
        0,
      ),
      rollbacks: jobs.filter((j) => j.status === "rolled_back").length,
    }),
    [jobs],
  );

  return (
    <div className="importsV2">
      <div className="importsHero">
        <div>
          <span className="adminEyebrow">DATA OPERATIONS</span>
          <h1>Bulk Operations & Import Center</h1>
          <p>
            Validate CSV/XLSX data before it touches the ERP, commit clean rows,
            export error reports and preserve rollback history.
          </p>
        </div>
        <button className="adminBtn ghost" onClick={loadHistory}>
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>
      {msg && (
        <div
          className={`importsMessage ${/error|failed|cannot|required|blocked/i.test(msg) ? "danger" : ""}`}
        >
          {/error|failed|cannot|required|blocked/i.test(msg) ? (
            <AlertTriangle size={17} />
          ) : (
            <CheckCircle2 size={17} />
          )}
          <span>{msg}</span>
        </div>
      )}
      <div className="importsStats">
        <div>
          <span>Import Jobs</span>
          <b>{totals.jobs}</b>
          <small>Tracked batches</small>
        </div>
        <div>
          <span>Committed Jobs</span>
          <b>{totals.imported}</b>
          <small>Imported or imported with errors</small>
        </div>
        <div>
          <span>Rows Applied</span>
          <b>{totals.rows}</b>
          <small>Inserted + updated</small>
        </div>
        <div>
          <span>Rollbacks</span>
          <b>{totals.rollbacks}</b>
          <small>Admin-approved reversals</small>
        </div>
      </div>
      <div className="importsTabs">
        <button
          className={tab === "new" ? "active" : ""}
          onClick={() => setTab("new")}
        >
          <Upload size={16} />
          New Import
        </button>
        <button
          className={tab === "history" ? "active" : ""}
          onClick={() => setTab("history")}
        >
          <History size={16} />
          Import History
        </button>
        <button
          className={tab === "templates" ? "active" : ""}
          onClick={() => setTab("templates")}
        >
          <FileSpreadsheet size={16} />
          Templates
        </button>
      </div>

      {tab === "new" && (
        <div className="importsNewLayout">
          <section className="adminPanel importsSetup">
            <div className="importsSectionHead">
              <div>
                <Upload size={19} />
                <div>
                  <h2>1. Choose import type</h2>
                  <p>
                    Each template has a fixed schema so validation is
                    predictable.
                  </p>
                </div>
              </div>
            </div>
            <div className="importTypeGrid">
              {(Object.keys(typeConfig) as ImportType[]).map((t) => {
                const C = typeConfig[t],
                  Icon = C.icon;
                return (
                  <button
                    key={t}
                    className={importType === t ? "active" : ""}
                    onClick={() => {
                      setImportType(t);
                      setRows([]);
                      setFileName("");
                      setJob(null);
                      setJobRows([]);
                    }}
                  >
                    <Icon size={19} />
                    <span>
                      <b>{C.label}</b>
                      <small>{C.description}</small>
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="importsMode">
              <label>
                <span>Import mode</span>
                <select
                  value={mode}
                  onChange={(e) => setMode(e.target.value as Mode)}
                >
                  <option value="upsert">
                    Upsert — create new + update matches
                  </option>
                  <option value="insert">
                    Insert only — reject existing matches
                  </option>
                  <option value="update">
                    Update only — reject new records
                  </option>
                </select>
              </label>
              <div>
                <b>Matching rule</b>
                <span>
                  {importType === "products" || importType === "components"
                    ? "SKU"
                    : importType === "customers"
                      ? "GSTIN → Email → Phone"
                      : importType === "suppliers"
                        ? "GSTIN → Email → Company"
                        : importType === "pricing" ||
                            importType === "opening_stock"
                          ? "Item type + SKU"
                          : "Safe key matching"}
                </span>
              </div>
            </div>
            <div className="importsSectionHead topGap">
              <div>
                <FileSpreadsheet size={19} />
                <div>
                  <h2>2. Upload & preview</h2>
                  <p>
                    CSV, XLSX and XLS supported. Maximum 2,000 rows per batch.
                  </p>
                </div>
              </div>
              <div className="templateBtns">
                <button onClick={() => downloadTemplate(importType, "csv")}>
                  CSV template
                </button>
                <button onClick={() => downloadTemplate(importType, "xlsx")}>
                  Excel template
                </button>
              </div>
            </div>
            <label className="importsDrop">
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={(e) =>
                  e.target.files?.[0] && parseFile(e.target.files[0])
                }
              />
              <Upload size={28} />
              <b>{fileName || "Drop or choose your import file"}</b>
              <span>
                {rows.length
                  ? `${rows.length} rows ready for validation`
                  : "Use the template to avoid column-name errors"}
              </span>
            </label>
            {preview.length > 0 && (
              <div className="importsPreview">
                <div>
                  <b>Local file preview</b>
                  <span>
                    First {preview.length} rows — no database changes yet
                  </span>
                </div>
                <div className="importsTableWrap">
                  <table>
                    <thead>
                      <tr>
                        <th>#</th>
                        {previewCols.map((c) => (
                          <th key={c}>{c}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.map((r, i) => (
                        <tr key={i}>
                          <td>{i + 1}</td>
                          {previewCols.map((c) => (
                            <td key={c}>{String(r[c] ?? "")}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            <div className="importsActions">
              <button
                className="adminBtn"
                disabled={busy || !rows.length}
                onClick={validateImport}
              >
                <ShieldCheck size={16} />
                {busy ? "Working…" : "Validate Import"}
              </button>
              <small>
                Validation creates a history job but does not change master
                data.
              </small>
            </div>
          </section>

          <section className="adminPanel importsValidation">
            <div className="importsSectionHead">
              <div>
                <ShieldCheck size={19} />
                <div>
                  <h2>3. Validation & commit</h2>
                  <p>Only valid rows are eligible to be applied.</p>
                </div>
              </div>
              {job && (
                <span className={`importStatus ${job.status}`}>
                  {String(job.status).replaceAll("_", " ")}
                </span>
              )}
            </div>
            {!job ? (
              <div className="importsEmpty">
                <ShieldCheck size={34} />
                <b>No validation job yet</b>
                <span>Upload a file and click Validate Import.</span>
              </div>
            ) : (
              <>
                <div className="validationStats">
                  <div>
                    <span>Total</span>
                    <b>{job.total_rows}</b>
                  </div>
                  <div className="ok">
                    <span>Valid</span>
                    <b>{validCount}</b>
                  </div>
                  <div className="bad">
                    <span>Errors</span>
                    <b>{errorCount}</b>
                  </div>
                  <div>
                    <span>Planned</span>
                    <b>
                      {jobRows.filter((r) => r.action === "insert").length}{" "}
                      insert /{" "}
                      {jobRows.filter((r) => r.action === "update").length}{" "}
                      update
                    </b>
                  </div>
                </div>
                <div className="validationList">
                  {jobRows.slice(0, 100).map((r) => (
                    <div
                      key={r.id}
                      className={
                        r.validation_status === "valid" ? "valid" : "error"
                      }
                    >
                      <span>Row {r.row_number}</span>
                      <b>{r.action.toUpperCase()}</b>
                      <small>
                        {r.validation_status === "valid"
                          ? "Ready to apply"
                          : (r.errors || []).join(" · ")}
                      </small>
                    </div>
                  ))}
                </div>
                {jobRows.length > 100 && (
                  <small className="importsNote">
                    Showing first 100 validation rows. The full batch is still
                    tracked.
                  </small>
                )}
                <div className="importsCommitBar">
                  <button
                    className="adminBtn ghost"
                    disabled={!errorCount}
                    onClick={downloadErrors}
                  >
                    <Download size={16} />
                    Error Report
                  </button>
                  <button
                    className="adminBtn"
                    disabled={
                      busy ||
                      !validCount ||
                      [
                        "imported",
                        "imported_with_errors",
                        "rolled_back",
                      ].includes(job.status)
                    }
                    onClick={commitImport}
                  >
                    <CheckCircle2 size={16} />
                    Commit {validCount} Valid Rows
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      )}

      {tab === "history" && (
        <div className="importsHistoryLayout">
          <section className="adminPanel">
            <div className="importsSectionHead">
              <div>
                <History size={19} />
                <div>
                  <h2>Import History</h2>
                  <p>Every validation and commit is traceable.</p>
                </div>
              </div>
            </div>
            <div className="importsHistoryList">
              {historyLoading ? (
                <div className="importsEmpty">Loading history…</div>
              ) : jobs.length ? (
                jobs.map((j) => (
                  <button
                    key={j.id}
                    className={job?.id === j.id ? "active" : ""}
                    onClick={() => loadJob(j.id)}
                  >
                    <span className={`historyIcon ${j.status}`}>
                      {j.import_type === "products" ? (
                        <Package size={17} />
                      ) : (
                        <FileSpreadsheet size={17} />
                      )}
                    </span>
                    <span>
                      <b>{j.file_name || j.import_type}</b>
                      <small>
                        {j.import_type.replaceAll("_", " ")} · {j.mode} ·{" "}
                        {fmt(j.created_at)}
                      </small>
                    </span>
                    <em>{String(j.status).replaceAll("_", " ")}</em>
                  </button>
                ))
              ) : (
                <div className="importsEmpty">No import jobs yet.</div>
              )}
            </div>
          </section>
          <section className="adminPanel importsHistoryDetail">
            {!job ? (
              <div className="importsEmpty">
                <History size={34} />
                <b>Select an import job</b>
                <span>
                  View validation, applied rows and rollback availability.
                </span>
              </div>
            ) : (
              <>
                <div className="importsSectionHead">
                  <div>
                    <FileSpreadsheet size={19} />
                    <div>
                      <h2>{job.file_name || "Import job"}</h2>
                      <p>
                        {job.import_type.replaceAll("_", " ")} · {job.mode} ·{" "}
                        {fmt(job.created_at)}
                      </p>
                    </div>
                  </div>
                  <span className={`importStatus ${job.status}`}>
                    {String(job.status).replaceAll("_", " ")}
                  </span>
                </div>
                <div className="historyMeta">
                  <div>
                    <span>Total Rows</span>
                    <b>{job.total_rows}</b>
                  </div>
                  <div>
                    <span>Inserted</span>
                    <b>{job.inserted_rows}</b>
                  </div>
                  <div>
                    <span>Updated</span>
                    <b>{job.updated_rows}</b>
                  </div>
                  <div>
                    <span>Errors</span>
                    <b>{job.error_rows}</b>
                  </div>
                </div>
                <div className="importsTableWrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Row</th>
                        <th>Validation</th>
                        <th>Action</th>
                        <th>Target</th>
                        <th>Applied</th>
                        <th>Error</th>
                      </tr>
                    </thead>
                    <tbody>
                      {jobRows.slice(0, 250).map((r) => (
                        <tr key={r.id}>
                          <td>{r.row_number}</td>
                          <td>
                            <span className={`rowPill ${r.validation_status}`}>
                              {r.validation_status}
                            </span>
                          </td>
                          <td>{r.action}</td>
                          <td>{r.target_table || "—"}</td>
                          <td>{fmt(r.applied_at)}</td>
                          <td>{(r.errors || []).join(" · ") || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="importsCommitBar">
                  <button
                    className="adminBtn ghost"
                    disabled={!job.error_rows}
                    onClick={downloadErrors}
                  >
                    <Download size={16} />
                    Error Report
                  </button>
                  {job.rollback_available && (
                    <button
                      className="adminBtn danger"
                      disabled={busy}
                      onClick={() => rollbackImport(job)}
                    >
                      <RotateCcw size={16} />
                      Rollback Import
                    </button>
                  )}
                </div>
                {job.rollback_available && (
                  <p className="rollbackNotice">
                    <AlertTriangle size={16} />
                    Rollback is an administrator approval action. It restores
                    captured values and reverses stock deltas; dependent records
                    created after the import can still prevent destructive
                    deletion.
                  </p>
                )}
              </>
            )}
          </section>
        </div>
      )}

      {tab === "templates" && (
        <section className="adminPanel importsTemplates">
          <div className="importsSectionHead">
            <div>
              <FileSpreadsheet size={19} />
              <div>
                <h2>Approved Import Templates</h2>
                <p>
                  Download a CSV or native Excel workbook with the exact
                  supported column names.
                </p>
              </div>
            </div>
          </div>
          <div className="templateGrid">
            {(Object.keys(typeConfig) as ImportType[]).map((t) => {
              const C = typeConfig[t],
                Icon = C.icon;
              return (
                <article key={t}>
                  <Icon size={22} />
                  <div>
                    <h3>{C.label}</h3>
                    <p>{C.description}</p>
                    <code>{C.columns.join(" · ")}</code>
                  </div>
                  <div>
                    <button onClick={() => downloadTemplate(t, "csv")}>
                      <Download size={15} />
                      CSV
                    </button>
                    <button onClick={() => downloadTemplate(t, "xlsx")}>
                      <Download size={15} />
                      Excel
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
