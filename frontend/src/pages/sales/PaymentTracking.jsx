import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";

import Button from "../../components/common/Button";
import EmptyState from "../../components/common/EmptyState";
import Loader from "../../components/common/Loader";
import StandardPageLayout from "../../components/common/StandardPageLayout";
import Table from "../../components/common/Table";
import { getPayments, getInvoices } from "../../api/salesApi";
import useTenantId from "../../hooks/useTenantId";
import useManufacturingRefresh from "../../hooks/useManufacturingRefresh";
import { formatInr } from "../../data/salesMasterData";

export default function PaymentTracking() {
  const tenantId = useTenantId();
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState([]);
  const [invoices, setInvoices] = useState([]);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([getPayments(tenantId), getInvoices(tenantId)])
      .then(([pr, ir]) => {
        setPayments(pr.data || []);
        setInvoices(ir.data || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [tenantId]);

  useEffect(() => {
    load();
  }, [load]);

  useManufacturingRefresh(load);

  const invMap = Object.fromEntries((invoices || []).map((i) => [i.id, i]));

  if (loading) return <Loader label="Loading payments..." />;

  return (
    <StandardPageLayout
      subtitle="Payments update invoice balances, income, and AR journal entries."
      action={
        <Button variant="primary" to="/sales/payments/create">
          <Plus className="h-4 w-4" /> Record Payment
        </Button>
      }
    >
      <div className="ui-card p-4">
        {payments.length === 0 ? (
          <EmptyState
            title="No payments recorded"
            description="Record a customer payment against an invoice to update AR and invoice balance."
            actionLabel="Record Payment"
            actionHref="/sales/payments/create"
          />
        ) : (
          <Table
            columns={[
              { key: "id", label: "Payment#" },
              {
                key: "invoice_id",
                label: "Invoice",
                render: (r) => invMap[r.invoice_id]?.invoice_number ?? `INV-${r.invoice_id}`,
              },
              { key: "payment_date", label: "Date" },
              {
                key: "amount",
                label: "Amount",
                align: "right",
                render: (r) => formatInr(r.amount),
              },
              { key: "method", label: "Method" },
              { key: "notes", label: "Notes" },
            ]}
            data={payments}
          />
        )}
      </div>
    </StandardPageLayout>
  );
}
