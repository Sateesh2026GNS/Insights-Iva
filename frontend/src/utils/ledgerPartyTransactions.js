import { getInvoicesV2 } from "../api/salesApi";
import { getPayments } from "../api/salesApi";
import { getSupplierPayments, getVendorBills } from "../api/procurementApi";

function inIsoRange(iso, from, to) {
  if (!iso) return false;
  if (from && iso < from) return false;
  if (to && iso > to) return false;
  return true;
}

function docTypeLabel(documentType) {
  const t = String(documentType || "tax_invoice").toLowerCase();
  if (t.includes("credit")) return "Credit Note";
  if (t.includes("debit")) return "Debit Note";
  if (t.includes("receipt")) return "Receipt";
  if (t.includes("payment")) return "Payment";
  if (t.includes("challan")) return "Delivery Challan";
  return "Invoice";
}

function invoiceToRow(inv) {
  const amount = Number(inv.grand_total ?? inv.amount ?? 0);
  const isCredit = String(inv.document_type || "").toLowerCase().includes("credit");
  return {
    id: `inv-${inv.id}`,
    voucher_date: String(inv.issue_date || inv.invoice_date || "").slice(0, 10),
    voucher_no: inv.invoice_number || String(inv.id),
    particulars: inv.buyer_name || inv.customer_name || "Sales",
    voucher_type: docTypeLabel(inv.document_type),
    debit: isCredit ? 0 : amount,
    credit: isCredit ? amount : 0,
  };
}

function paymentToRow(pay) {
  const amount = Number(pay.amount || 0);
  return {
    id: `pay-${pay.id}`,
    voucher_date: String(pay.payment_date || "").slice(0, 10),
    voucher_no: pay.payment_reference || `RCP-${pay.id}`,
    particulars: pay.notes || "Payment Receipt",
    voucher_type: "Receipt",
    debit: 0,
    credit: amount,
  };
}

function vendorBillToRow(bill) {
  const amount = Number(bill.amount || 0);
  return {
    id: `vb-${bill.id}`,
    voucher_date: String(bill.bill_date || "").slice(0, 10),
    voucher_no: bill.bill_number || String(bill.id),
    particulars: bill.supplier_name || bill.vendor_name || "Purchase",
    voucher_type: "Purchase",
    debit: 0,
    credit: amount,
  };
}

function supplierPaymentToRow(pay) {
  const amount = Number(pay.amount || 0);
  return {
    id: `sp-${pay.id}`,
    voucher_date: String(pay.payment_date || "").slice(0, 10),
    voucher_no: pay.reference || `PAY-${pay.id}`,
    particulars: pay.notes || "Payment Made",
    voucher_type: "Payment",
    debit: amount,
    credit: 0,
  };
}

/** Load party ledger lines for customer/vendor from sales & procurement APIs. */
export async function fetchPartyLedgerTransactions(kind, partyId, fromDate, toDate) {
  const partyKey = String(partyId);
  if (kind === "customer" || kind === "debtors") {
    const [invRes, payRes] = await Promise.all([
      getInvoicesV2({
        customer_id: partyKey,
        date_from: fromDate,
        date_to: toDate,
        page: 1,
        page_size: 500,
        payment_filter: "all",
      }),
      getPayments({
        customer_id: partyKey,
        date_from: fromDate,
        date_to: toDate,
      }),
    ]);
    const invoices = (invRes.data?.items || []).map(invoiceToRow);
    const payments = (Array.isArray(payRes.data) ? payRes.data : []).map(paymentToRow);
    return [...invoices, ...payments].sort((a, b) =>
      String(b.voucher_date).localeCompare(String(a.voucher_date))
    );
  }

  if (kind === "vendor" || kind === "creditors") {
    const [billsRes, payRes] = await Promise.all([getVendorBills(), getSupplierPayments()]);
    const bills = (Array.isArray(billsRes.data) ? billsRes.data : [])
      .filter((b) => String(b.supplier_id ?? b.vendor_id) === partyKey)
      .filter((b) => inIsoRange(String(b.bill_date || "").slice(0, 10), fromDate, toDate))
      .map(vendorBillToRow);
    const payments = (Array.isArray(payRes.data) ? payRes.data : [])
      .filter((p) => String(p.supplier_id) === partyKey)
      .filter((p) => inIsoRange(String(p.payment_date || "").slice(0, 10), fromDate, toDate))
      .map(supplierPaymentToRow);
    return [...bills, ...payments].sort((a, b) =>
      String(b.voucher_date).localeCompare(String(a.voucher_date))
    );
  }

  return [];
}

export function filterLocalTransactionsByRange(rows, fromDate, toDate) {
  return rows.filter((row) => inIsoRange(String(row.voucher_date || "").slice(0, 10), fromDate, toDate));
}
