import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { FileText } from "lucide-react";

import { downloadLeadAttachment, getLeadDetail } from "../../api/salesApi";
import Button from "../../components/common/Button";
import { AsyncPageBody } from "../../components/common/states";
import { cardPaddedClass } from "../../design-system/classes";
import { useToast } from "../../context/ToastContext";
import { userCanCreateLead } from "../../config/permissions";
import useAuth from "../../hooks/useAuth";
import { apiErrorMessage } from "../../utils/apiError";
import { formatIndianCurrencyField } from "../../utils/numberFormat";

function Row({ label, value }) {
  return (
    <div>
      <dt className="text-[12px] font-semibold text-[var(--color-text-muted)]">{label}</dt>
      <dd className="mt-0.5 whitespace-pre-wrap text-sm text-[var(--color-text)]">{value || "—"}</dd>
    </div>
  );
}

function fileTypeLabel(name) {
  const ext = String(name || "").split(".").pop();
  return ext ? ext.toUpperCase() : "FILE";
}

export default function LeadDetailPage() {
  const { id } = useParams();
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const canEdit = userCanCreateLead(user);
  const [lead, setLead] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getLeadDetail(id);
      setLead(res?.data || null);
    } catch (err) {
      setError(err);
      setLead(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const onDownload = async (file) => {
    try {
      const res = await downloadLeadAttachment(id, file.id);
      const blob = new Blob([res.data]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.file_name || "attachment";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      addToast(apiErrorMessage(err, t("sales.leads.detail.noAttachments")), "error");
    }
  };

  return (
    <div className="ui-page mx-auto max-w-[960px] space-y-4 p-4">
      <nav className="text-sm text-[var(--color-text-muted)]">
        <Link to="/sales/leads">{t("sales.leads.create.breadcrumbLeads")}</Link>
        <span className="mx-1">/</span>
        <span>{lead?.lead_no || id}</span>
      </nav>

      <AsyncPageBody loading={loading} errorObj={error} onRetry={load} loadingVariant="page">
        {lead ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h1 className="text-xl font-bold text-[var(--color-text)]">
                {lead.company_name || lead.contact_person}
              </h1>
              <div className="flex flex-wrap gap-2">
                {canEdit ? (
                  <Button type="button" variant="secondary" onClick={() => navigate(`/sales/leads/${id}/edit`)}>
                    {t("sales.leads.detail.edit")}
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => addToast(t("sales.leads.detail.convertComingSoon"), "info")}
                >
                  {t("sales.leads.detail.convertQuotation")}
                </Button>
              </div>
            </div>

            <section className={cardPaddedClass}>
              <h2 className="mb-3 text-base font-semibold">{t("sales.leads.create.sectionCompany")}</h2>
              <dl className="grid gap-3 sm:grid-cols-2">
                <Row label={t("sales.leads.create.companyName")} value={lead.company_name} />
                <Row label={t("sales.leads.create.contactPerson")} value={lead.contact_person} />
                <Row label={t("sales.leads.create.phone")} value={lead.phone} />
                <Row label={t("sales.leads.create.email")} value={lead.email} />
                <Row label={t("sales.leads.create.address")} value={lead.address} />
                <Row label={t("sales.leads.create.city")} value={lead.city} />
                <Row label={t("sales.leads.create.state")} value={lead.state} />
                <Row label={t("sales.leads.create.pincode")} value={lead.pincode} />
                <Row label={t("sales.leads.create.gst")} value={lead.gst_number} />
              </dl>
            </section>

            <section className={cardPaddedClass}>
              <h2 className="mb-3 text-base font-semibold">{t("sales.leads.create.sectionRequirement")}</h2>
              <dl className="grid gap-3 sm:grid-cols-2">
                <Row label={t("sales.leads.create.product")} value={lead.product_name} />
                <Row label={t("sales.leads.create.quantity")} value={lead.quantity} />
                <Row
                  label={t("sales.leads.create.expectedValue")}
                  value={
                    lead.expected_value != null
                      ? `₹${formatIndianCurrencyField(String(lead.expected_value))}`
                      : "—"
                  }
                />
                <Row label={t("sales.leads.create.expectedClose")} value={lead.expected_close_date} />
                <Row label={t("sales.leads.create.requirementDetails")} value={lead.requirement_details} />
              </dl>
            </section>

            <section className={cardPaddedClass}>
              <h2 className="mb-3 text-base font-semibold">{t("sales.leads.create.sectionDetails")}</h2>
              <dl className="grid gap-3 sm:grid-cols-2">
                <Row label={t("sales.leads.create.assignedTo")} value={lead.assigned_user_name} />
                <Row label={t("sales.leads.create.source")} value={lead.source} />
                <Row label={t("sales.leads.create.status")} value={lead.status} />
                <Row label={t("sales.leads.create.priority")} value={lead.priority} />
              </dl>
            </section>

            <section className={cardPaddedClass}>
              <h2 className="mb-3 text-base font-semibold">{t("sales.leads.create.sectionDiscussion")}</h2>
              {lead.discussions?.length ? (
                <ul className="space-y-2">
                  {lead.discussions.map((d) => (
                    <li key={d.id} className="rounded-lg border border-[var(--color-border)] p-3 text-sm">
                      <p className="font-semibold">
                        {d.discussed_with}
                        {d.role ? ` — ${d.role}` : ""}
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-[var(--color-text-secondary)]">{d.details}</p>
                      <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">
                        {[d.added_by, d.created_at ? new Date(d.created_at).toLocaleString() : null]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-[var(--color-text-muted)]">{t("sales.leads.create.noDiscussions")}</p>
              )}
            </section>

            <section className={cardPaddedClass}>
              <h2 className="mb-3 text-base font-semibold">{t("sales.leads.create.attachments")}</h2>
              {lead.attachments?.length ? (
                <ul className="space-y-2">
                  {lead.attachments.map((f) => (
                    <li key={f.id} className="flex items-center justify-between gap-2 text-sm">
                      <span className="flex min-w-0 items-center gap-2">
                        <FileText className="h-4 w-4 shrink-0 text-[var(--color-primary)]" />
                        <span className="truncate">{f.file_name}</span>
                        <span className="text-[11px] text-[var(--color-text-muted)]">{fileTypeLabel(f.file_name)}</span>
                      </span>
                      <Button type="button" variant="secondary" size="sm" onClick={() => onDownload(f)}>
                        View
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-[var(--color-text-muted)]">{t("sales.leads.detail.noAttachments")}</p>
              )}
            </section>
          </>
        ) : null}
      </AsyncPageBody>
    </div>
  );
}
