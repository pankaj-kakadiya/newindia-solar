"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  Download,
  FilePlus2,
  RefreshCw,
  Scale,
  Trash2,
  X,
} from "lucide-react";
import { supabase } from "../../../lib/supabase";

type Account = {
  id: string;
  code: string;
  name: string;
  account_group: "asset" | "liability" | "equity" | "income" | "expense";
  opening_balance: number;
  opening_side: string | null;
};
type Trial = {
  code: string;
  account_name: string;
  account_group: string;
  debit: number;
  credit: number;
  balance: number;
};
type VoucherLine = {
  account_code: string;
  debit: string;
  credit: string;
  line_note: string;
};
const money = (v: any) =>
  `₹${Number(v || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const cell = (v: any) => `"${String(v ?? "").replaceAll('"', '""')}"`;
const blankLine = (): VoucherLine => ({
  account_code: "",
  debit: "",
  credit: "",
  line_note: "",
});

export default function Accounting() {
  const [accounts, setAccounts] = useState<Account[]>([]),
    [entries, setEntries] = useState<any[]>([]),
    [trial, setTrial] = useState<Trial[]>([]),
    [overview, setOverview] = useState<any>({}),
    [tab, setTab] = useState("vouchers"),
    [loading, setLoading] = useState(true),
    [msg, setMsg] = useState(""),
    [show, setShow] = useState(false),
    [busy, setBusy] = useState(false);
  const [from, setFrom] = useState(`${new Date().getFullYear()}-04-01`),
    [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [form, setForm] = useState({
    voucher_type: "journal",
    voucher_date: new Date().toISOString().slice(0, 10),
    reference_number: "",
    narration: "",
    lines: [blankLine(), blankLine()],
  });
  async function load() {
    setLoading(true);
    setMsg("");
    const [a, e, t, o] = await Promise.all([
      supabase
        .from("accounting_accounts")
        .select("*")
        .eq("is_active", true)
        .order("code"),
      supabase
        .from("accounting_entries")
        .select(
          "*,accounting_lines(*,accounting_accounts(code,name,account_group))",
        )
        .order("voucher_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(250),
      supabase.rpc("accounting_trial_balance", {
        p_from: from || null,
        p_to: to || null,
      }),
      supabase.rpc("accounting_overview", {
        p_from: from || null,
        p_to: to || null,
      }),
    ]);
    const error = a.error || e.error || t.error || o.error;
    if (error) setMsg(error.message);
    setAccounts((a.data || []) as Account[]);
    setEntries(e.data || []);
    setTrial((t.data || []) as Trial[]);
    setOverview(o.data || {});
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);
  const debit = useMemo(
      () => form.lines.reduce((n, l) => n + Number(l.debit || 0), 0),
      [form.lines],
    ),
    credit = useMemo(
      () => form.lines.reduce((n, l) => n + Number(l.credit || 0), 0),
      [form.lines],
    ),
    balanced = debit > 0 && Math.abs(debit - credit) < 0.01;
  const grouped = useMemo(
    () =>
      Object.fromEntries(
        ["asset", "liability", "equity", "income", "expense"].map((g) => [
          g,
          trial.filter((x) => x.account_group === g),
        ]),
      ),
    [trial],
  ) as Record<string, Trial[]>;
  const totals = useMemo(
    () => ({
      assets: (grouped.asset || []).reduce((n, x) => n + Number(x.balance), 0),
      liabilities: (grouped.liability || []).reduce(
        (n, x) => n - Number(x.balance),
        0,
      ),
      equity: (grouped.equity || []).reduce((n, x) => n - Number(x.balance), 0),
      income: (grouped.income || []).reduce((n, x) => n - Number(x.balance), 0),
      expense: (grouped.expense || []).reduce(
        (n, x) => n + Number(x.balance),
        0,
      ),
    }),
    [grouped],
  );
  function updateLine(i: number, key: keyof VoucherLine, value: string) {
    setForm((f) => ({
      ...f,
      lines: f.lines.map((l, n) =>
        n === i
          ? {
              ...l,
              [key]: value,
              ...(key === "debit" && value ? { credit: "" } : {}),
              ...(key === "credit" && value ? { debit: "" } : {}),
            }
          : l,
      ),
    }));
  }
  async function postVoucher() {
    if (!form.narration.trim()) return setMsg("Narration is required.");
    if (!balanced)
      return setMsg(
        "Debit and credit totals must be equal and greater than zero.",
      );
    if (
      form.lines.some(
        (l) => !l.account_code || (!Number(l.debit) && !Number(l.credit)),
      )
    )
      return setMsg("Choose a ledger and amount for every line.");
    setBusy(true);
    const { error } = await supabase.rpc("post_accounting_entry", {
      p_voucher_type: form.voucher_type,
      p_voucher_date: form.voucher_date,
      p_reference_type: "manual",
      p_reference_id: null,
      p_reference_number: form.reference_number || null,
      p_narration: form.narration,
      p_lines: form.lines.map((l) => ({
        account_code: l.account_code,
        debit: Number(l.debit || 0),
        credit: Number(l.credit || 0),
        line_note: l.line_note || null,
      })),
    });
    setBusy(false);
    if (error) return setMsg(error.message);
    setShow(false);
    setForm({
      voucher_type: "journal",
      voucher_date: new Date().toISOString().slice(0, 10),
      reference_number: "",
      narration: "",
      lines: [blankLine(), blankLine()],
    });
    setMsg("Balanced voucher posted successfully.");
    load();
  }
  function exportCsv() {
    const out = [
      [
        "Date",
        "Voucher",
        "Number",
        "Narration",
        "Ledger Code",
        "Ledger",
        "Debit",
        "Credit",
      ],
      ...entries.flatMap((e) =>
        (e.accounting_lines || []).map((l: any) => [
          e.voucher_date,
          e.voucher_type,
          e.entry_number,
          e.narration,
          l.accounting_accounts?.code,
          l.accounting_accounts?.name,
          l.debit,
          l.credit,
        ]),
      ),
    ]
      .map((r) => r.map(cell).join(","))
      .join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([out], { type: "text/csv" }));
    a.download = `new-india-solar-accounting-${to}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }
  return (
    <div className="accountingV2">
      <div className="acctHero">
        <div>
          <span className="adminEyebrow">DOUBLE-ENTRY ACCOUNTS</span>
          <h1>Accounting & Ledgers</h1>
          <p>
            Tally-style voucher posting, chart of accounts, ledgers, trial
            balance, profit & loss and balance-sheet control inside the admin.
          </p>
        </div>
        <div className="acctHeroActions">
          <button className="adminBtn ghost" onClick={exportCsv}>
            <Download size={16} />
            Export Books
          </button>
          <button className="adminBtn ghost" onClick={load}>
            <RefreshCw size={16} />
            Refresh
          </button>
          <button className="adminBtn" onClick={() => setShow(true)}>
            <FilePlus2 size={16} />
            Post Voucher
          </button>
        </div>
      </div>
      {msg && (
        <div
          className={`acctMessage ${/required|equal|error|not found/i.test(msg) ? "danger" : ""}`}
        >
          {msg}
        </div>
      )}
      <div className="acctStats">
        <div>
          <span>Total Assets</span>
          <b>{money(overview.assets)}</b>
          <small>Debit less credit</small>
        </div>
        <div>
          <span>Total Liabilities</span>
          <b>{money(overview.liabilities)}</b>
          <small>Credit less debit</small>
        </div>
        <div>
          <span>Income</span>
          <b>{money(overview.income)}</b>
          <small>Selected period</small>
        </div>
        <div>
          <span>Expenses</span>
          <b>{money(overview.expenses)}</b>
          <small>Selected period</small>
        </div>
        <div
          className={
            Number(overview.income) - Number(overview.expenses) >= 0
              ? "profit"
              : "loss"
          }
        >
          <span>Net Profit / Loss</span>
          <b>{money(Number(overview.income) - Number(overview.expenses))}</b>
          <small>{overview.entries || 0} posted vouchers</small>
        </div>
      </div>
      <div className="acctTabs">
        {[
          ["vouchers", "Vouchers"],
          ["ledgers", "Chart of Accounts"],
          ["trial", "Trial Balance"],
          ["profit", "Profit & Loss"],
          ["balance", "Balance Sheet"],
        ].map(([k, l]) => (
          <button
            key={k}
            className={tab === k ? "active" : ""}
            onClick={() => setTab(k)}
          >
            {l}
          </button>
        ))}
      </div>
      <div className="acctToolbar">
        <label>
          From{" "}
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label>
          To{" "}
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
        <button className="adminBtn ghost" onClick={load}>
          Apply Period
        </button>
      </div>
      {tab === "vouchers" && (
        <section className="acctPanel">
          <div className="acctPanelHead">
            <div>
              <h2>Voucher Register</h2>
              <p>
                Posted journal, receipt, payment, sales and adjustment vouchers.
              </p>
            </div>
            <BookOpen size={20} />
          </div>
          <div className="acctTableWrap">
            <table className="acctTable">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Voucher</th>
                  <th>Reference</th>
                  <th>Narration</th>
                  <th className="acctMoney">Debit</th>
                  <th className="acctMoney">Credit</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="acctEmpty">
                      Loading books…
                    </td>
                  </tr>
                ) : entries.length ? (
                  entries.map((e) => (
                    <tr key={e.id}>
                      <td>
                        {new Date(e.voucher_date).toLocaleDateString("en-IN")}
                      </td>
                      <td>
                        <b>{e.entry_number}</b>
                        <span>
                          {String(e.voucher_type).replaceAll("_", " ")}
                        </span>
                      </td>
                      <td>{e.reference_number || e.reference_type || "—"}</td>
                      <td>{e.narration || "—"}</td>
                      <td className="acctMoney">{money(e.total_debit)}</td>
                      <td className="acctMoney">{money(e.total_credit)}</td>
                      <td>
                        <span className="acctGroup">{e.status}</span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="acctEmpty">
                      No accounting vouchers in this period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {tab === "ledgers" && (
        <section className="acctPanel">
          <div className="acctPanelHead">
            <div>
              <h2>Chart of Accounts</h2>
              <p>
                System ledgers for assets, liabilities, equity, income and
                expenses.
              </p>
            </div>
          </div>
          <div className="acctTableWrap">
            <table className="acctTable">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Ledger</th>
                  <th>Group</th>
                  <th>Opening</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <b>{a.code}</b>
                    </td>
                    <td>{a.name}</td>
                    <td>
                      <span className="acctGroup">{a.account_group}</span>
                    </td>
                    <td>
                      {money(a.opening_balance)} {a.opening_side || ""}
                    </td>
                    <td>Active</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {tab === "trial" && (
        <section className="acctPanel">
          <div className="acctPanelHead">
            <div>
              <h2>Trial Balance</h2>
              <p>Every posted debit must equal every posted credit.</p>
            </div>
            <Scale size={20} />
          </div>
          <div className="acctTableWrap">
            <table className="acctTable">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Ledger</th>
                  <th>Group</th>
                  <th className="acctMoney">Debit</th>
                  <th className="acctMoney">Credit</th>
                  <th className="acctMoney">Balance</th>
                </tr>
              </thead>
              <tbody>
                {trial.map((r) => (
                  <tr key={r.code}>
                    <td>{r.code}</td>
                    <td>
                      <b>{r.account_name}</b>
                    </td>
                    <td>
                      <span className="acctGroup">{r.account_group}</span>
                    </td>
                    <td className="acctMoney">{money(r.debit)}</td>
                    <td className="acctMoney">{money(r.credit)}</td>
                    <td className="acctMoney">{money(r.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {tab === "profit" && (
        <div className="acctReportGrid">
          <Report title="Income" rows={grouped.income || []} credit />
          <Report title="Expenses" rows={grouped.expense || []} />
          <section className="acctReportBlock">
            <h3>Net Result</h3>
            <div className="acctReportLine total">
              <span>Net Profit / (Loss)</span>
              <b>{money(totals.income - totals.expense)}</b>
            </div>
          </section>
        </div>
      )}
      {tab === "balance" && (
        <div className="acctReportGrid">
          <Report title="Assets" rows={grouped.asset || []} />
          <Report title="Liabilities" rows={grouped.liability || []} credit />
          <Report title="Equity" rows={grouped.equity || []} credit />
          <section className="acctReportBlock">
            <h3>Balance Check</h3>
            <div className="acctReportLine">
              <span>Assets</span>
              <b>{money(totals.assets)}</b>
            </div>
            <div className="acctReportLine">
              <span>Liabilities + Equity + Current Profit</span>
              <b>
                {money(
                  totals.liabilities +
                    totals.equity +
                    (totals.income - totals.expense),
                )}
              </b>
            </div>
          </section>
        </div>
      )}
      {show && (
        <div className="acctModalBackdrop" onMouseDown={() => setShow(false)}>
          <div className="acctModal" onMouseDown={(e) => e.stopPropagation()}>
            <button className="close" onClick={() => setShow(false)}>
              <X size={18} />
            </button>
            <h2>Post Accounting Voucher</h2>
            <p>
              Journal entry is accepted only when total debit equals total
              credit.
            </p>
            <div className="acctFormGrid">
              <label>
                Voucher Type
                <select
                  value={form.voucher_type}
                  onChange={(e) =>
                    setForm({ ...form, voucher_type: e.target.value })
                  }
                >
                  <option value="journal">Journal</option>
                  <option value="receipt">Receipt</option>
                  <option value="payment">Payment</option>
                  <option value="contra">Contra</option>
                  <option value="purchase">Purchase</option>
                  <option value="sales">Sales</option>
                </select>
              </label>
              <label>
                Date
                <input
                  type="date"
                  value={form.voucher_date}
                  onChange={(e) =>
                    setForm({ ...form, voucher_date: e.target.value })
                  }
                />
              </label>
              <label>
                Reference
                <input
                  value={form.reference_number}
                  onChange={(e) =>
                    setForm({ ...form, reference_number: e.target.value })
                  }
                />
              </label>
              <label className="wide">
                Narration
                <input
                  value={form.narration}
                  onChange={(e) =>
                    setForm({ ...form, narration: e.target.value })
                  }
                  placeholder="Purpose of this voucher"
                />
              </label>
            </div>
            <div className="acctLines">
              <div className="acctLine acctLineHead">
                <span>Ledger</span>
                <span>Debit</span>
                <span>Credit</span>
                <span />
              </div>
              {form.lines.map((l, i) => (
                <div className="acctLine" key={i}>
                  <select
                    value={l.account_code}
                    onChange={(e) =>
                      updateLine(i, "account_code", e.target.value)
                    }
                  >
                    <option value="">Select ledger</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.code}>
                        {a.code} — {a.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Debit"
                    value={l.debit}
                    onChange={(e) => updateLine(i, "debit", e.target.value)}
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Credit"
                    value={l.credit}
                    onChange={(e) => updateLine(i, "credit", e.target.value)}
                  />
                  <button
                    disabled={form.lines.length <= 2}
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        lines: f.lines.filter((_, n) => n !== i),
                      }))
                    }
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
            <div className={`acctBalance ${balanced ? "" : "bad"}`}>
              <span>
                Debit <b>{money(debit)}</b>
              </span>
              <span>
                Credit <b>{money(credit)}</b>
              </span>
              <span>{balanced ? "Balanced" : "Not balanced"}</span>
            </div>
            <div className="acctModalActions">
              <button
                className="adminBtn ghost"
                onClick={() =>
                  setForm((f) => ({ ...f, lines: [...f.lines, blankLine()] }))
                }
              >
                + Add Ledger Line
              </button>
              <button
                className="adminBtn"
                disabled={busy || !balanced}
                onClick={postVoucher}
              >
                {busy ? "Posting…" : "Post Balanced Voucher"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Report({
  title,
  rows,
  credit = false,
}: {
  title: string;
  rows: Trial[];
  credit?: boolean;
}) {
  const total = rows.reduce(
    (n, r) => n + (credit ? -Number(r.balance) : Number(r.balance)),
    0,
  );
  return (
    <section className="acctReportBlock">
      <h3>{title}</h3>
      {rows.map((r) => (
        <div className="acctReportLine" key={r.code}>
          <span>
            {r.code} · {r.account_name}
          </span>
          <b>{money(credit ? -Number(r.balance) : Number(r.balance))}</b>
        </div>
      ))}
      <div className="acctReportLine total">
        <span>Total {title}</span>
        <b>{money(total)}</b>
      </div>
    </section>
  );
}
