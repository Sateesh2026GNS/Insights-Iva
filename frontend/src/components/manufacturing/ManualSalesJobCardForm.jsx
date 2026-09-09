import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Plus, Save, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

import Button from "../common/Button";
import { Input, Select, Textarea } from "../common/FormField";
import { DatePicker } from "../../design-system/dateControls";
import { LoadingState, ErrorState } from "../common/states";
import useAuth from "../../hooks/useAuth";
import { getCompanySettings } from "../../api/settingsApi";
import {
  createManualJobCard,
  getManualJobCard,
  updateManualJobCard,
} from "../../api/workflowApi";
import { useToast } from "../../context/ToastContext";
import { apiErrorMessage, extractApiErrorDetail } from "../../utils/apiError";
import {
  buildManualPayload,
  emptyManualForm,
  emptyProductLine,
  emptySpecLine,
  manualFormFromApi,
  mapApiErrors,
  PRIORITY_OPTIONS,
  UOM_OPTIONS,
  validateManualForm,
} from "../../utils/manualSalesJobCard";
import { formatCompanyAddress, resolveCompanyLogoUrl, resolveCompanyTagline } from "../../utils/salesJobCardDocument";
import "../../styles/sales-job-card-document.css";
import "../../styles/manual-sales-job-card-form.css";

function FieldError({ error }) {
  if (!error) return null;
  return <p className="manual-sjc__error">{error}</p>;
}

function EditableFieldRow({ label, required, error, children }) {
  return (
    <div className="sjc-doc__field-row manual-sjc__field-row">
      <span className="sjc-doc__field-label">
        {label}
        {required ? " *" : ""}
      </span>
      <span className="manual-sjc__field-input">
        {children}
        <FieldError error={error} />
      </span>
    </div>
  );
}

export default function ManualSalesJobCardForm({ jobCardId = null, backTo = "/my-job-cards?dept=sales" }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const isEdit = Boolean(jobCardId);
  const [form, setForm] = useState(() => emptyManualForm(user?.full_name || user?.name || ""));
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(isEdit);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [companyProfile, setCompanyProfile] = useState(null);
  const [dirty, setDirty] = useState(false);

  const patch = useCallback((path, value) => {
    setDirty(true);
    setForm((prev) => {
      const next = { ...prev };
      const [section, key] = path.includes(".") ? path.split(".") : [null, path];
      if (section && key) {
        next[section] = { ...prev[section], [key]: value };
      } else {
        next[path] = value;
      }
      return next;
    });
    setErrors((prev) => {
      const next = { ...prev };
      delete next[path];
      return next;
    });
  }, []);

  useEffect(() => {
    getCompanySettings()
      .then((res) => setCompanyProfile(res?.data?.data ?? res?.data ?? null))
      .catch(() => setCompanyProfile(null));
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    setLoading(true);
    setLoadError("");
    getManualJobCard(jobCardId)
      .then((res) => {
        const data = res?.data ?? res;
        setForm(manualFormFromApi(data));
      })
      .catch((err) => setLoadError(apiErrorMessage(err, "Could not load job card.")))
      .finally(() => setLoading(false));
  }, [isEdit, jobCardId]);

  const addProductLine = () => {
    setDirty(true);
    setForm((prev) => ({
      ...prev,
      product_lines: [...prev.product_lines, emptyProductLine(prev.product_lines.length)],
    }));
  };

  const removeProductLine = (index) => {
    setDirty(true);
    setForm((prev) => {
      const lines = prev.product_lines.filter((_, i) => i !== index);
      return {
        ...prev,
        product_lines: lines.length ? lines.map((r, i) => ({ ...r, sl_no: i + 1 })) : [emptyProductLine(0)],
      };
    });
  };

  const patchProductLine = (index, key, value) => {
    setDirty(true);
    setForm((prev) => {
      const lines = [...prev.product_lines];
      lines[index] = { ...lines[index], [key]: value };
      return { ...prev, product_lines: lines };
    });
    setErrors((prev) => {
      const next = { ...prev };
      delete next[`product_lines.${index}.${key}`];
      delete next.product_lines;
      return next;
    });
  };

  const addSpecLine = () => {
    setDirty(true);
    setForm((prev) => ({
      ...prev,
      technical_specifications: [
        ...prev.technical_specifications,
        emptySpecLine(prev.technical_specifications.length),
      ],
    }));
  };

  const removeSpecLine = (index) => {
    setDirty(true);
    setForm((prev) => ({
      ...prev,
      technical_specifications: prev.technical_specifications
        .filter((_, i) => i !== index)
        .map((r, i) => ({ ...r, sl_no: i + 1 })),
    }));
  };

  const patchSpecLine = (index, key, value) => {
    setDirty(true);
    setForm((prev) => {
      const specs = [...prev.technical_specifications];
      specs[index] = { ...specs[index], [key]: value };
      return { ...prev, technical_specifications: specs };
    });
  };

  const handleCancel = () => {
    if (dirty && !window.confirm("Discard unsaved changes?")) return;
    navigate(backTo);
  };

  const handleSave = async () => {
    if (saving) return;
    const validation = validateManualForm(form);
    if (Object.keys(validation).length) {
      setErrors(validation);
      addToast("Please fix the highlighted fields.", "error");
      return;
    }
    setSaving(true);
    try {
      const payload = buildManualPayload(form);
      const res = isEdit
        ? await updateManualJobCard(jobCardId, payload)
        : await createManualJobCard(payload);
      const data = res?.data ?? res;
      addToast(isEdit ? "Job card saved." : "Job card created successfully.", "success");
      const id = data?.job_card_id || data?.id || jobCardId;
      navigate(id ? `/my-job-cards?dept=sales&jc=${id}` : backTo, { replace: true });
    } catch (err) {
      const detail = extractApiErrorDetail(err);
      const apiErrors = mapApiErrors(detail);
      if (Object.keys(apiErrors).length) setErrors(apiErrors);
      addToast(apiErrorMessage(err, "Failed to save job card."), "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingState label="Loading job card…" className="py-16" />;
  }
  if (loadError) {
    return (
      <ErrorState title="Could not load job card" description={loadError} onRetry={() => window.location.reload()} />
    );
  }

  const companyName =
    companyProfile?.company_name || companyProfile?.legal_name || companyProfile?.name || "";
  const companyAddress = formatCompanyAddress(companyProfile);
  const logoUrl = resolveCompanyLogoUrl(companyProfile);
  const tagline = resolveCompanyTagline(companyProfile);

  return (
    <div className="ui-page ui-stack manual-sjc-page">
      <div className="ui-card manual-sjc-page__card">
        <div className="manual-sjc-page__toolbar">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
              Sales &amp; Manufacturing
            </p>
            <h1 className="text-base font-semibold sm:text-lg">
              {isEdit ? "Edit Sales Job Card" : "Add Sales Job Card"}
            </h1>
          </div>
          <Button variant="secondary" onClick={handleCancel} leftIcon={<ArrowLeft className="h-4 w-4" aria-hidden />}>
            Cancel
          </Button>
        </div>

        <div className="manual-sjc-page__body">
          <div className="sjc-doc manual-sjc-form">
            <div className="sjc-doc__paper">
              <div className="sjc-doc__header-row">
                <div className="sjc-doc__company">
                  {logoUrl ? (
                    <img src={logoUrl} alt="" className="sjc-doc__logo" />
                  ) : (
                    <div className="sjc-doc__logo-placeholder">LOGO</div>
                  )}
                  <div>
                    <div className="sjc-doc__company-name">{companyName || "Company Name"}</div>
                    {companyAddress ? <div className="sjc-doc__company-address">{companyAddress}</div> : null}
                  </div>
                </div>
                {tagline ? <p className="sjc-doc__tagline">{tagline}</p> : null}
                <div className="sjc-doc__meta">
                  <table className="sjc-doc__meta-grid">
                    <tbody>
                      <tr>
                        <td className="sjc-doc__meta-label">Job Card No.</td>
                        <td className="sjc-doc__meta-value">
                          {form.job_card_no || "Auto-generated on save"}
                        </td>
                      </tr>
                      <tr>
                        <td className="sjc-doc__meta-label">Date</td>
                        <td className="sjc-doc__meta-value">
                          <DatePicker
                            value={form.header.job_card_date}
                            onChange={(v) => patch("header.job_card_date", v)}
                            error={errors["header.job_card_date"]}
                          />
                        </td>
                      </tr>
                      <tr>
                        <td className="sjc-doc__meta-label">Sales Order No.</td>
                        <td className="sjc-doc__meta-value">
                          <Input
                            value={form.header.sales_order_no}
                            onChange={(e) => patch("header.sales_order_no", e.target.value)}
                            error={errors["header.sales_order_no"]}
                            className="sjc-doc__input"
                          />
                        </td>
                      </tr>
                      <tr>
                        <td className="sjc-doc__meta-label">Customer PO No.</td>
                        <td className="sjc-doc__meta-value">
                          <Input
                            value={form.header.customer_po_no}
                            onChange={(e) => patch("header.customer_po_no", e.target.value)}
                            className="sjc-doc__input"
                          />
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="sjc-doc__title-band">SALES JOB CARD</div>

              <div className="sjc-doc__columns">
                <div className="sjc-doc__panel">
                  <div className="sjc-doc__panel-title">Customer Details</div>
                  <div className="sjc-doc__panel-body">
                    <EditableFieldRow label="Customer Name" required error={errors["customer.customer_name"]}>
                      <Input
                        value={form.customer.customer_name}
                        onChange={(e) => patch("customer.customer_name", e.target.value)}
                        className="sjc-doc__input"
                      />
                    </EditableFieldRow>
                    <EditableFieldRow label="Contact Person" error={errors["customer.contact_person"]}>
                      <Input
                        value={form.customer.contact_person}
                        onChange={(e) => patch("customer.contact_person", e.target.value)}
                        className="sjc-doc__input"
                      />
                    </EditableFieldRow>
                    <EditableFieldRow label="Phone" error={errors["customer.phone"]}>
                      <Input
                        value={form.customer.phone}
                        onChange={(e) => patch("customer.phone", e.target.value)}
                        className="sjc-doc__input"
                      />
                    </EditableFieldRow>
                    <EditableFieldRow label="Email" error={errors["customer.email"]}>
                      <Input
                        type="email"
                        value={form.customer.email}
                        onChange={(e) => patch("customer.email", e.target.value)}
                        className="sjc-doc__input"
                      />
                    </EditableFieldRow>
                    <EditableFieldRow label="Billing Address" error={errors["customer.billing_address"]}>
                      <Textarea
                        rows={2}
                        value={form.customer.billing_address}
                        onChange={(e) => patch("customer.billing_address", e.target.value)}
                        className="sjc-doc__input"
                      />
                    </EditableFieldRow>
                  </div>
                </div>

                <div className="sjc-doc__panel">
                  <div className="sjc-doc__panel-title">Order Details</div>
                  <div className="sjc-doc__panel-body">
                    <EditableFieldRow label="Sales Order Date" error={errors["order.sales_order_date"]}>
                      <DatePicker
                        value={form.order.sales_order_date}
                        onChange={(v) => patch("order.sales_order_date", v)}
                      />
                    </EditableFieldRow>
                    <EditableFieldRow label="Delivery Date" error={errors["order.delivery_date"]}>
                      <DatePicker
                        value={form.order.delivery_date}
                        onChange={(v) => patch("order.delivery_date", v)}
                      />
                    </EditableFieldRow>
                    <EditableFieldRow label="Product Category">
                      <Input
                        value={form.order.product_category}
                        onChange={(e) => patch("order.product_category", e.target.value)}
                        className="sjc-doc__input"
                      />
                    </EditableFieldRow>
                    <EditableFieldRow label="End Use">
                      <Input
                        value={form.order.end_use}
                        onChange={(e) => patch("order.end_use", e.target.value)}
                        className="sjc-doc__input"
                      />
                    </EditableFieldRow>
                    <EditableFieldRow label="Payment Terms">
                      <Input
                        value={form.order.payment_terms}
                        onChange={(e) => patch("order.payment_terms", e.target.value)}
                        className="sjc-doc__input"
                      />
                    </EditableFieldRow>
                    <EditableFieldRow label="Priority">
                      <Select
                        value={form.order.priority}
                        onChange={(e) => patch("order.priority", e.target.value)}
                        className="sjc-doc__input"
                      >
                        {PRIORITY_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </Select>
                    </EditableFieldRow>
                    <EditableFieldRow label="Remarks">
                      <Textarea
                        rows={2}
                        value={form.order.remarks}
                        onChange={(e) => patch("order.remarks", e.target.value)}
                        className="sjc-doc__input"
                      />
                    </EditableFieldRow>
                  </div>
                </div>
              </div>

              <div className="sjc-doc__table-wrap">
                <div className="sjc-doc__table-caption">Product / Job Details</div>
                {errors.product_lines ? <FieldError error={errors.product_lines} /> : null}
                <table className="sjc-doc__table manual-sjc__editable-table">
                  <thead>
                    <tr>
                      <th>Sl. No.</th>
                      <th>Product Code</th>
                      <th>Product Name</th>
                      <th>Description</th>
                      <th className="num">Quantity</th>
                      <th>UOM</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {form.product_lines.map((row, index) => (
                      <tr key={index}>
                        <td className="num">{index + 1}</td>
                        <td>
                          <Input
                            value={row.product_code}
                            onChange={(e) => patchProductLine(index, "product_code", e.target.value)}
                            className="sjc-doc__input"
                          />
                        </td>
                        <td>
                          <Input
                            value={row.product_name}
                            onChange={(e) => patchProductLine(index, "product_name", e.target.value)}
                            error={errors[`product_lines.${index}.product_name`]}
                            className="sjc-doc__input"
                          />
                        </td>
                        <td>
                          <Input
                            value={row.description}
                            onChange={(e) => patchProductLine(index, "description", e.target.value)}
                            className="sjc-doc__input"
                          />
                        </td>
                        <td className="num">
                          <Input
                            type="number"
                            min="0.001"
                            step="any"
                            value={row.quantity}
                            onChange={(e) => patchProductLine(index, "quantity", e.target.value)}
                            error={errors[`product_lines.${index}.quantity`]}
                            className="sjc-doc__input"
                          />
                        </td>
                        <td>
                          <Select
                            value={row.uom}
                            onChange={(e) => patchProductLine(index, "uom", e.target.value)}
                            error={errors[`product_lines.${index}.uom`]}
                            className="sjc-doc__input"
                          >
                            {UOM_OPTIONS.map((u) => (
                              <option key={u} value={u}>{u}</option>
                            ))}
                          </Select>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="manual-sjc__remove-btn"
                            onClick={() => removeProductLine(index)}
                            aria-label="Remove product row"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="manual-sjc__add-row">
                  <Button variant="outline" size="sm" onClick={addProductLine} leftIcon={<Plus className="h-4 w-4" />}>
                    Add Product
                  </Button>
                </div>
              </div>

              <div className="sjc-doc__table-wrap">
                <div className="sjc-doc__table-caption">Technical Specifications</div>
                <table className="sjc-doc__table manual-sjc__editable-table">
                  <thead>
                    <tr>
                      <th>Sl. No.</th>
                      <th>Parameter</th>
                      <th>Specification</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {form.technical_specifications.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="manual-sjc__empty-spec">
                          No specifications added yet.
                        </td>
                      </tr>
                    ) : (
                      form.technical_specifications.map((row, index) => (
                        <tr key={index}>
                          <td className="num">{index + 1}</td>
                          <td>
                            <Input
                              value={row.parameter}
                              onChange={(e) => patchSpecLine(index, "parameter", e.target.value)}
                              className="sjc-doc__input"
                            />
                          </td>
                          <td>
                            <Input
                              value={row.specification}
                              onChange={(e) => patchSpecLine(index, "specification", e.target.value)}
                              className="sjc-doc__input"
                            />
                          </td>
                          <td>
                            <button
                              type="button"
                              className="manual-sjc__remove-btn"
                              onClick={() => removeSpecLine(index)}
                              aria-label="Remove specification"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
                <div className="manual-sjc__add-row">
                  <Button variant="outline" size="sm" onClick={addSpecLine} leftIcon={<Plus className="h-4 w-4" />}>
                    Add Specification
                  </Button>
                </div>
              </div>

              <div className="sjc-doc__approval manual-sjc__approval-edit">
                <table className="sjc-doc__table">
                  <thead>
                    <tr>
                      <th>Prepared By</th>
                      <th>Checked By</th>
                      <th>Approved By</th>
                      <th>Date</th>
                      <th>Customer Acknowledgement</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>
                        <Input
                          value={form.approval.prepared_by}
                          onChange={(e) => patch("approval.prepared_by", e.target.value)}
                          className="sjc-doc__input"
                        />
                      </td>
                      <td>
                        <Input
                          value={form.approval.checked_by}
                          onChange={(e) => patch("approval.checked_by", e.target.value)}
                          className="sjc-doc__input"
                        />
                      </td>
                      <td>
                        <Input
                          value={form.approval.approved_by}
                          onChange={(e) => patch("approval.approved_by", e.target.value)}
                          className="sjc-doc__input"
                        />
                      </td>
                      <td>
                        <DatePicker
                          value={form.approval.prepared_date}
                          onChange={(v) => patch("approval.prepared_date", v)}
                        />
                      </td>
                      <td>
                        <Input
                          value={form.approval.customer_acknowledgement}
                          onChange={(e) => patch("approval.customer_acknowledgement", e.target.value)}
                          className="sjc-doc__input"
                        />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <div className="manual-sjc-page__footer">
          <Button variant="secondary" onClick={handleCancel} disabled={saving}>
            Cancel
          </Button>
          <Button
            variant="add"
            loading={saving}
            disabled={saving}
            onClick={handleSave}
            leftIcon={<Save className="h-4 w-4" aria-hidden />}
          >
            Save Job Card
          </Button>
        </div>
      </div>
    </div>
  );
}
