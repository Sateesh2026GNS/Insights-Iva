import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react";

import Loader from "../../components/common/Loader";
import PageHeader from "../../components/common/PageHeader";
import DataTable from "../../components/common/DataTable";
import EmptyState from "../../components/common/EmptyState";
import { getSuppliers } from "../../api/inventoryApi";
import useTenantId from "../../hooks/useTenantId";
import usePageRefresh from "../../hooks/usePageRefresh";

import Button from "../../components/common/Button";
export default function Suppliers() {
  const tenantId = useTenantId();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [suppliers, setSuppliers] = useState([]);
  const [loadError, setLoadError] = useState("");

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    setLoadError("");
    try {
      const res = await getSuppliers(tenantId);
      const apiSuppliers = res.data || [];
      const local = JSON.parse(localStorage.getItem("smrt_suppliers") || "[]");
      const map = new Map();
      apiSuppliers.forEach((s) => map.set(String(s.name).toLowerCase(), s));
      local.forEach((s) => map.set(String(s.name).toLowerCase(), s));
      setSuppliers(Array.from(map.values()));
    } catch (err) {
      const local = JSON.parse(localStorage.getItem("smrt_suppliers") || "[]");
      setSuppliers(local);
      if (local.length === 0) setLoadError("Could not load suppliers. Is the API running?");
      if (isRefresh) throw err;
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  usePageRefresh(() => load(true));

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <Loader label="Loading suppliers..." />;

  const columns = [
    { key: "name", label: "NAME" },
    { key: "contact", label: "CONTACT", render: (r) => r.contact ?? "—" },
    { key: "email", label: "EMAIL", render: (r) => r.email ?? "—" },
    { key: "phone", label: "PHONE", render: (r) => r.phone ?? "—" },
  ];

  const emptyState = (
    <EmptyState
      icon="clipboard"
      title="No suppliers yet"
      description="Create your first supplier to link materials and purchase orders."
      actionLabel="Create supplier"
      actionHref="/inventory/suppliers/create"
    />
  );

  const createAction = (
    <Button variant="add" to="/inventory/suppliers/create" leftIcon={<Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden />}>
      Create supplier
    </Button>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        subtitle="View and manage your suppliers. Link them to materials and purchase orders."
        action={createAction}
      />
      {loadError && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-100">
          {loadError}
        </div>
      )}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <DataTable
          columns={columns}
          data={suppliers}
          searchPlaceholder={t("common.search")}
          searchKeys={["name", "contact", "email", "phone"]}
          emptyState={emptyState}
        />
      </div>
    </div>
  );
}
