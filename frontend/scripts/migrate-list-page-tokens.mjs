import fs from "fs";
import path from "path";

const root = path.resolve("src");

const files = [
  "pages/sales/Quotations.jsx",
  "pages/procurement/PurchaseOrders.jsx",
  "pages/purchases/PurchaseDebitNotes.jsx",
  "pages/purchases/PaymentsMade.jsx",
  "pages/purchases/Purchases.jsx",
  "pages/masters/ProductsMaster.jsx",
  "pages/sales/InvoiceDashboard.jsx",
  "pages/sales/PaymentReceipts.jsx",
  "pages/sales/ExportInvoices.jsx",
  "pages/sales/DeliveryChallans.jsx",
  "pages/sales/CreditNotes.jsx",
  "pages/sales/DebitNotes.jsx",
  "pages/accounts/LedgerV2.jsx",
  "pages/accounts/BalanceSheet.jsx",
  "pages/accounts/BalanceSheetV2.jsx",
  "pages/accounts/ProfitLoss.jsx",
  "pages/accounts/ProfitLossV2.jsx",
  "pages/documents/DocumentsDashboard.jsx",
];

const replacements = [
  ["border-[#e4e4ea]", "border-[var(--color-border)]"],
  ["border-[#d0d0d8]", "border-[var(--color-table-border)]"],
  ["border-[#e8e8ee]", "border-[var(--color-border-soft)]"],
  ["border-[#f0f0f4]", "border-[var(--color-border-muted)]"],
  ["border-[#cfcfd6]", "border-[var(--color-border-soft)]"],
  ["border-[#d8d8e0]", "border-[var(--color-border-soft)]"],
  ["border-[#1a1a1f]", "border-[var(--color-border-strong)]"],
  ["bg-white", "bg-[var(--color-surface)]"],
  ["text-[#1a1a1f]", "text-[var(--color-text)]"],
  ["text-[#4a4a55]", "text-[var(--color-text-secondary)]"],
  ["text-[#6b6b76]", "text-[var(--color-text-muted)]"],
  ["text-[#9a9aa5]", "text-[var(--color-text-faint)]"],
  ["text-[#3a3a42]", "text-[var(--color-text-secondary)]"],
  ["text-[#0f172a]", "text-[var(--color-text)]"],
  ["placeholder:text-[#9a9aa5]", "placeholder:text-[var(--color-text-placeholder)]"],
  ["placeholder:text-[#a0a0ab]", "placeholder:text-[var(--color-text-placeholder)]"],
  ["bg-[#f0f0f3]", "bg-[var(--color-surface-muted)]"],
  ["bg-[#f5f5f5]", "bg-[var(--color-surface-muted)]"],
  ["bg-[#ececf0]", "bg-[var(--color-surface-muted)]"],
  ["bg-[#eceef4]", "bg-[var(--color-surface-muted)]"],
  ["bg-[#e8e8ee]", "bg-[var(--color-surface-muted)]"],
  ["bg-[#f7f7f9]", "bg-[var(--color-surface-muted)]"],
  ["bg-[#efeaf8]", "bg-[var(--color-surface-muted)]"],
  ["hover:bg-[#e4e4ea]", "hover:bg-[var(--color-surface-hover)]"],
  ["hover:bg-[#ececef]", "hover:bg-[var(--color-surface-hover)]"],
  ["hover:bg-[#e0e0e6]", "hover:bg-[var(--color-surface-hover)]"],
  ["hover:bg-[#f0f0f4]", "hover:bg-[var(--color-surface-hover)]"],
  ["hover:bg-[#f5f5f7]", "hover:bg-[var(--color-surface-hover)]"],
  ["hover:bg-[#F5F5F5]", "hover:bg-[var(--color-surface-hover)]"],
  ["hover:bg-white/70", "hover:bg-[var(--color-surface-hover)]"],
  ["hover:bg-white", "hover:bg-[var(--color-surface-hover)]"],
  ["border-slate-200", "border-[var(--color-border)]"],
  ["border-slate-100", "border-[var(--color-border-muted)]"],
  ["divide-slate-100", "divide-[var(--color-border-muted)]"],
  ["divide-slate-200", "divide-[var(--color-border)]"],
  ["bg-slate-50", "bg-[var(--color-surface-muted)]"],
  ["hover:bg-slate-50", "hover:bg-[var(--color-surface-hover)]"],
  ["text-slate-900", "text-[var(--color-text)]"],
  ["text-slate-800", "text-[var(--color-text)]"],
  ["text-slate-700", "text-[var(--color-text-secondary)]"],
  ["text-slate-600", "text-[var(--color-text-secondary)]"],
  ["text-slate-500", "text-[var(--color-text-muted)]"],
  ["text-slate-400", "text-[var(--color-text-faint)]"],
  ["hover:bg-[#fafafa]", "hover:bg-[var(--color-table-row-hover)]"],
  ["hover:bg-[#F8FAFC]", "hover:bg-[var(--color-table-row-hover)]"],
  ["bg-[#fafafa]", "bg-[var(--color-surface-muted)]"],
  ["text-[#596b82]", "text-[var(--color-text-muted)]"],
  ["text-[#c4c4cc]", "text-[var(--color-text-icon)]"],
  ["text-[#d8d8e0]", "text-[var(--color-text-icon)]"],
  ["text-[#3F51B5]", "text-[var(--color-primary)]"],
  ["border-[#3F51B5]", "border-[var(--color-primary)]"],
  ["bg-slate-100", "bg-[var(--color-surface-muted)]"],
  ["hover:bg-slate-100", "hover:bg-[var(--color-surface-hover)]"],
];

let total = 0;
for (const rel of files) {
  const filePath = path.join(root, rel);
  if (!fs.existsSync(filePath)) {
    console.warn("skip missing", rel);
    continue;
  }
  let content = fs.readFileSync(filePath, "utf8");
  const before = content;
  for (const [from, to] of replacements) {
    content = content.split(from).join(to);
  }
  if (content !== before) {
    fs.writeFileSync(filePath, content, "utf8");
    total += 1;
    console.log("updated", rel);
  }
}
console.log(`done — ${total} files updated`);
