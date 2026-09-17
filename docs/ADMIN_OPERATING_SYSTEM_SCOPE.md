# New India Solar Admin Operating System

This document defines the target admin workflow for New India Solar. It separates the features delivered in the current upgrade from the next operational phases required for full ERP and Tally-style parity.

## Navigation by department

| Department             | Admin areas                                                         | Primary ownership          |
| ---------------------- | ------------------------------------------------------------------- | -------------------------- |
| Command Center         | Dashboard, notifications and tasks                                  | Management                 |
| Sales & Customers      | Leads, RFQs, quotations, customers and orders                       | Sales                      |
| Catalogue & Pricing    | Products, bulk edit, components, pricing and cost sheets            | Product and commercial     |
| Inventory & Purchase   | Inventory, FIFO layers, bulk imports, suppliers and purchase orders | Stores and procurement     |
| Finance & Accounts     | Accounting, invoices, GST, payments and expenses                    | Finance                    |
| Assembly & Engineering | BOMs, builder rules, assembly jobs and quality                      | Engineering and operations |
| Automation             | Integrations and workflow automation                                | Operations and technology  |
| Storefront             | Content, media, themes and customer reviews                         | Marketing and ecommerce    |
| Administration         | Users, roles, audit log, security, settings and data tools          | Administrators             |

## Current upgrade delivered

- Quick view and edit action on every product.
- Dedicated bulk product matrix for status, cost price, selling price, MRP, GST, stock threshold and variant activation.
- Selected-row bulk status and activation actions.
- Inventory update sheet download with import-compatible columns.
- Opening-stock import, pricing/cost-sheet import and exported inventory audit fields.
- FIFO inventory lots, cost allocation and traceability for standard orders and assembly consumption.
- FIFO stock-layer view inside Inventory.
- Double-entry chart of accounts and balanced voucher posting.
- Voucher register, trial balance, profit and loss, balance sheet, period filtering and accounting CSV export.
- Department-based sidebar with launch-only readiness and cutover tools removed from daily navigation.
- Existing role-based access controls extended to the accounting module.

## Complete operational workflow

### 1. Catalogue and product information

1. Create component masters, brands, categories and technical attributes.
2. Create products and variants with BOMs, tax rate, MOQ, warranty and lead time.
3. Set cost, selling price, MRP, dealer price and margin rules.
4. Review products in quick view, update in bulk and publish to the storefront.
5. Keep complete price history and approval evidence for margin-sensitive changes.

### 2. Inventory and warehouses

1. Receive opening stock or GRN quantities into costed FIFO lots.
2. Reserve available inventory when an order is confirmed.
3. Consume the oldest available lot when an order or assembly job is fulfilled.
4. Track on-hand, reserved, available, reorder threshold, lot cost and stock value.
5. Perform cycle counts and approved positive or negative adjustments.
6. Export an inventory sheet, update quantities or costs, validate it, preview errors and import it.
7. Add multi-warehouse bins, transfers, serial numbers and ageing reports in the next phase.

### 3. Procurement

1. Raise a purchase request from reorder alerts or project demand.
2. Compare supplier quotations and approve the selected supplier.
3. Issue a purchase order and record dispatch expectations.
4. Receive goods through GRN with quantity and quality checks.
5. Create FIFO stock lots from accepted quantities.
6. Match supplier bill, PO and GRN before payment approval.
7. Post the purchase, input GST, payable and payment entries automatically in the next phase.

### 4. Sales and fulfilment

1. Capture lead or RFQ and convert it to a quotation.
2. Approve commercial terms, GST treatment, freight and payment schedule.
3. Convert the quote to an order and reserve inventory.
4. Pick components by FIFO, assemble when required, complete QC and pack.
5. Generate invoice, dispatch documents and shipment tracking.
6. Record collection, credit note, return or replacement.
7. Release unused reservations and post COGS from actual FIFO allocation.

### 5. Assembly and engineering

1. Maintain approved BOM revisions and component substitutions.
2. Create an assembly job from a custom ACDB/DCDB order.
3. Reserve and issue materials, record technician work and capture test results.
4. Complete QC, consume components by FIFO and receive the finished box into stock.
5. Preserve component-lot traceability for warranty and field-service investigations.

### 6. Finance and accounting

The current release establishes a safe double-entry ledger foundation. Full Tally-style parity is a phased ERP programme and includes:

- Chart of accounts, opening balances and journal, payment, receipt, contra, sales and purchase vouchers.
- Automatic sales invoice, credit note, payment, purchase, inventory and COGS postings.
- Customer and supplier ledgers, receivable/payable ageing and statement reconciliation.
- CGST, SGST and IGST ledgers, HSN summaries, GSTR-1, GSTR-3B and reconciliation controls.
- Bank accounts, statement import, matching rules and bank reconciliation.
- Cost centres, projects, departments and profitability reporting.
- Trial balance, profit and loss, balance sheet, cash flow and stock valuation.
- Financial-year controls, voucher numbering, period locks, approvals and immutable audit evidence.
- Tally-compatible import/export and accountant hand-off packages.

### 7. Roles, approvals and controls

- Management: full reporting and approval visibility.
- Sales: leads, customers, quotations and orders without cost-price access unless granted.
- Product: catalogue, attributes, media and publishing.
- Commercial: pricing, margin and discount approvals.
- Stores: inventory, GRN, reservations, picking and adjustments.
- Procurement: suppliers, purchase requests and purchase orders.
- Finance: accounting, GST, invoices, payments, expenses and reports.
- Engineering: BOMs, substitutions, assembly jobs and QC.
- Marketing: storefront content, themes, media and reviews.
- Administrator: users, roles, security, integrations, settings and audit logs.

Every sensitive action should require the smallest necessary permission, record the actor and timestamp, and preserve before/after data.

## Recommended implementation phases

| Phase                               | Scope                                                                                             | Exit criteria                                                          |
| ----------------------------------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Live foundation                     | Bulk catalogue, cost and inventory tools; FIFO; manual double-entry books; reorganized navigation | Staff can safely maintain products, stock layers and balanced vouchers |
| Phase 2: Transaction automation     | Automatic sales, payment, purchase, GST, inventory and COGS postings                              | Every operational transaction produces an auditable balanced entry     |
| Phase 3: Procurement and warehouses | PR, supplier comparison, PO, GRN, QC, multi-warehouse and transfers                               | Complete procure-to-stock traceability                                 |
| Phase 4: Finance control            | Bank reconciliation, ageing, GST returns, cost centres, financial locks and Tally exchange        | Accountant can close a period without parallel spreadsheets            |
| Phase 5: Intelligence               | Forecasting, reorder recommendations, profitability, exception alerts and department KPIs         | Management operates from one trusted command centre                    |

## Go-live acceptance checklist

- All staff roles tested using least-privilege accounts.
- Opening inventory reconciled by item, lot and value.
- Opening ledger balances approved by the accountant.
- Trial balance debit equals credit.
- One complete quote-to-cash transaction tested.
- One complete purchase-to-pay transaction tested after Phase 2.
- Returns, cancellations and stock adjustments tested.
- GST calculations and invoice numbering approved.
- CSV import validation tested with both valid and invalid files.
- Audit logs, backups and restore procedure verified.
