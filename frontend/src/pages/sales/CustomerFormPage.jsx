import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import CustomerForm from "../../components/sales/CustomerForm";
import Loader from "../../components/common/Loader";
import { getCustomers } from "../../api/salesApi";
import { enrichApiCustomer } from "../../data/customersMasterData";
import { customerToForm, emptyCustomerForm } from "../../utils/customerFormModel";
import { apiErrorMessage } from "../../utils/apiError";

export default function CustomerFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);
  const [loading, setLoading] = useState(isEdit);
  const [customer, setCustomer] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isEdit) return;
    let mounted = true;
    setLoading(true);
    setError("");
    getCustomers()
      .then((res) => {
        if (!mounted) return;
        const rows = Array.isArray(res.data) ? res.data : [];
        const match = rows.find((row) => String(row.id) === String(id));
        if (!match) {
          setError("Customer not found");
          return;
        }
        setCustomer(enrichApiCustomer(match));
      })
      .catch((err) => {
        if (!mounted) return;
        setError(apiErrorMessage(err, "Could not load customer"));
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [id, isEdit]);

  const initialForm = useMemo(() => {
    if (!isEdit) return emptyCustomerForm();
    if (!customer) return emptyCustomerForm();
    return customerToForm(customer);
  }, [isEdit, customer]);

  if (isEdit && loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader label="Loading customer..." />
      </div>
    );
  }

  if (isEdit && error) {
    return (
      <div className="p-6 text-center">
        <p className="text-sm text-red-600">{error}</p>
        <button type="button" className="mt-3 text-sm font-semibold text-[var(--color-primary)]" onClick={() => navigate("/sales/customers")}>
          Back to Customers
        </button>
      </div>
    );
  }

  return <CustomerForm initialForm={initialForm} customer={customer} />;
}
