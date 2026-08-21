import { useCallback, useEffect, useMemo, useState } from "react";
import usePageRefresh from "../../hooks/usePageRefresh";

import Loader from "../../components/common/Loader";
import Button from "../../components/common/Button";
import PageHeader from "../../components/common/PageHeader";
import DataTable from "../../components/common/DataTable";
import EmptyState from "../../components/common/EmptyState";
import { useToast } from "../../context/ToastContext";
import {
  deleteSupplierPayment,
  getSupplierPayments,
  getVendors,
} from "../../api/procurementApi";
import { apiErrorMessage } from "../../utils/apiError";

export default function SupplierPayments() {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState([]);
  const [vendors, setVendors] = useState([]);

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const [p, v] = await Promise.all([getSupplierPayments(), getVendors()]);


      setPayments(p.data || []);
      setVendors(v.data || []);
    } catch (err) {
      addToast(apiErrorMessage(err, "Failed to load payments"), "error");
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  usePageRefresh(() => load(true));

  useEffect(() => {
    load();
  }, [load]);

  const vendorName = useMemo(() => {
    const map = {};
    vendors.forEach((v) => {
      map[v.id] = v.name;
    });
    return map;
  }, [vendors]);

  const handleDelete = async (row) => {
    if (!row?.id) return;
    if (!window.confirm("Delete this supplier payment?")) return;
    try {
      await deleteSupplierPayment(row.id);
      addToast("Payment deleted", "success");
      await load();
    } catch (err) {
      addToast(apiErrorMessage(err, "Failed to delete payment"), "error");
    }
  };

  if (loading) return <Loader label="Loading supplier payments..." />;

  const total = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);

  const columns = [
    {
      key: "supplier_id",
      label: "Supplier",
      render: (r) => vendorName[r.supplier_id] || `#${r.supplier_id}`,
    },
    { key: "payment_date", label: "Date" },
    {
      key: "amount",
      label: "Amount",
      render: (r) => `₹${Number(r.amount).toLocaleString()}`,
    },
    { key: "payment_method", label: "Method" },
    { key: "reference", label: "Reference" },
    {
      key: "actions",
      label: "Actions",
      render: (r) => (
        <button
          type="button"
          onClick={() => handleDelete(r)}
          className="text-xs font-semibold text-red-600 hover:underline"
        >
          Delete
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-5 pb-4">
      <PageHeader
        title="Supplier Payments"
        subtitle={`Total paid: ₹${total.toLocaleString()}`}
        action={
          <Button variant="primary" to="/procurement/supplier-payments/create">
            + Record Payment
          </Button>
        }
      />
      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-sm">
        <DataTable
          columns={columns}
          data={payments}
          searchPlaceholder="Search"
          searchKeys={["reference", "payment_method"]}
          emptyState={
            <EmptyState
              icon="clipboard"
              title="No supplier payments"
              description="Record payments to your vendors."
            />
          }
        />
      </div>
    </div>
  );
}
