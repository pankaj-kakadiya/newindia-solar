# Accounting workspace release 1

This release fixes accounting entry and reporting foundations. It is not a complete Tally replacement or a verified automated procure-to-pay implementation.

## Included

- Tally-style ledger subgroups based on the supplied ledger-list reference, with validated mapping to asset, liability, equity, income and expense.
- Zero-opening ledger creation through a permission-checked RPC. Opening entries use balanced journals.
- Receipt, payment, contra, journal, purchase, sales, debit-note and credit-note accounting entries; simple two-ledger mode or split lines.
- Exact monetary validation and request UUID retry protection. Posted vouchers are preserved; corrections use adjusting journals.
- Complete server-calculated opening, period and closing balances. Profit uses period movement; balance sheet uses closing balances and accumulated result.
- Date-filtered, paginated day book and voucher line drill-down. Export explicitly labels current register page; balance export includes all ledgers. Formula-safe CSV cells.
- F2 period focus, F4 contra, F5 payment, F6 receipt, F7 journal, F8 sales, F9 purchase, Ctrl/Cmd+Enter post, Tab navigation, Escape close, Ctrl/Cmd+K existing global navigation.
- Accounting and manufacturing route permission mapping.

Function shortcuts intentionally do not run while typing in inputs. OS/browser shortcuts can take precedence; Mac may need Fn.

## Database release

Migration `20260926000423_accounting_workspace.sql` was applied to the connected production database before UI release. Additive migration adds ledger_group and three authenticated permission-checked functions. No stock/product/image records or historical entries are changed.

New APIs retain the existing has_admin_permission authorization model. No direct table write grants are added. Tests run in isolated PGlite, not production.

## Entry boundary

Manual accounting purchase/sales vouchers do not move inventory, allocate order payments, generate GST invoices or execute bank transfers. The UI explains this and links to purchasing, inventory and finance workflows. Do not enter a source document twice manually and automatically.

## Next integrations requiring explicit reconciliation tests

1. Atomic purchase order edits, supplier invoices/payables, partial GRNs and supplier bill allocation.
2. Source-linked automatic sales invoice, customer receipt, purchase receipt and manufacturing valuation postings with reversals and unique source IDs.
3. Supplier payments, bank reconciliation/import matching, bill-wise aging and returns.
4. Period locking, approved opening balances, GST review/export, and accountant reconciliation against existing documents.
5. Authenticated browser end-to-end tests across staff roles, accessibility and concurrency.

The supplied reference is a ledger classification guide, not a company accounting policy or current tax-rate source. No tax rates or opening balances were imported from it.

Security advisor review: authenticated SECURITY DEFINER exposure is intentional for the three RPCs. Each checks auth.uid and accounting permission, pins an empty search_path and revokes PUBLIC/anon execution. No direct accounting table mutations were granted.
