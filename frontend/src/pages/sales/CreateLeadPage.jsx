import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { FileText, Paperclip, Plus, X } from "lucide-react";

import { getTeamDirectory } from "../../api/adminApi";
import { getEmployees } from "../../api/hrApi";
import {
  checkLeadDuplicate,
  createLead,
  createLeadActivity,
  deleteLeadAttachment,
  getLeadDetail,
  getLeadNextId,
  updateLead,
  uploadLeadAttachments,
} from "../../api/salesApi";
import ConfirmDialog from "../../components/admin/ConfirmDialog";
import AdminModal from "../../components/admin/AdminModal";
import Button from "../../components/common/Button";
import IndianCurrencyInput from "../../components/common/IndianCurrencyInput";
import SearchableSelect from "../../components/common/SearchableSelect";
import {
  AsyncPageBody,
  FieldError,
  PermissionDeniedState,
} from "../../components/common/states";
import AddExecutiveNameModal from "../../components/sales/AddExecutiveNameModal";
import LeadProductSelectModal from "../../components/sales/LeadProductSelectModal";
import { cardPaddedClass, inputClass, selectClass, textareaClass } from "../../design-system/classes";
import useMeasuredStickyFooter from "../../hooks/useMeasuredStickyFooter";
import useAuth from "../../hooks/useAuth";
import { useToast } from "../../context/ToastContext";
import { userCanAddLeadExecutiveName, userCanCreateLead } from "../../config/permissions";
import {
  apiErrorMessage,
  applyBackendFieldErrors,
  classifyApiError,
} from "../../utils/apiError";
import {
  executiveDisplayName,
  filterLeadExecutiveCandidates,
  findExecutiveById,
} from "../../utils/salesExecutiveDirectory";

const SOURCE_OPTIONS = ["Website", "Referral", "Exhibition", "Cold call", "Other"];
const STATUS_OPTIONS = ["New", "Contacted", "Qualified"];
const PRIORITY_OPTIONS = ["High", "Medium", "Low"];
const ALLOWED_EXT = [".pdf", ".png", ".jpg", ".jpeg", ".dxf", ".xlsx"];
const PIN_RE = /^[1-9][0-9]{5}$/;
const ADD_EXECUTIVE_VALUE = "__add_executive__";

const EMPTY_FORM = {
  company_name: "",
  contact_person: "",
  phone: "",
  email: "",
  city: "",
  state: "",
  address: "",
  pincode: "",
  gst_number: "",
  product_id: "",
  product_name: "",
  quantity: "",
  expected_value: "",
  expected_close_date: "",
  requirement_details: "",
  source: "Website",
  status: "New",
  priority: "Medium",
  assigned_user_id: "",
  next_follow_up: "",
  notes: "",
};

function SectionCard({ title, children, grid = true }) {
  return (
    <section className={cardPaddedClass}>
      <h2 className="mb-4 text-base font-semibold text-[var(--color-text)]">{title}</h2>
      {grid ? <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{children}</div> : children}
    </section>
  );
}

function Field({ label, required, error, children, className = "" }) {
  return (
    <div className={`block min-w-0 ${className}`} data-lead-error={error ? "true" : undefined}>
      <span className="mb-1.5 block text-[12px] font-semibold text-[#6b6b76]">
        {label}
        {required ? <span className="text-[#e11d48]"> *</span> : null}
      </span>
      {children}
      <FieldError message={error} />
    </div>
  );
}

function unwrapLead(res) {
  const body = res?.data;
  if (body && typeof body === "object" && body.id != null) return body;
  if (body?.data && typeof body.data === "object" && body.data.id != null) return body.data;
  return body || null;
}

function personLabel(row) {
  const name = row.full_name || row.name || executiveDisplayName(row);
  const role = row.designation || row.role || row.department || "";
  return role ? `${name} — ${role}` : name;
}

export default function CreateLeadPage() {
  const { t } = useTranslation();
  const { id: editId } = useParams();
  const isEdit = Boolean(editId) && !Number.isNaN(Number(editId));
  const { user } = useAuth();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const canCreate = userCanCreateLead(user);
  const canAddExecutive = userCanAddLeadExecutiveName(user);
  const fileInputRef = useRef(null);
  const savingRef = useRef(false);
  const { footerRef } = useMeasuredStickyFooter(true);

  const [leadNo, setLeadNo] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [files, setFiles] = useState([]);
  const [existingFiles, setExistingFiles] = useState([]);
  const [executives, setExecutives] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [duplicateMatches, setDuplicateMatches] = useState([]);
  const [duplicateAck, setDuplicateAck] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitKind, setSubmitKind] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [addExecutiveOpen, setAddExecutiveOpen] = useState(false);
  const [discussions, setDiscussions] = useState([]);
  const [discussionOpen, setDiscussionOpen] = useState(false);
  const [discussionDraft, setDiscussionDraft] = useState({ discussed_with: "", role: "", details: "" });
  const [discussionError, setDiscussionError] = useState("");
  const initialAssigned = useRef(false);

  useEffect(() => {
    if (!dirty || saving) return undefined;
    const onBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty, saving]);

  const set = (key, value) => {
    setDirty(true);
    setForm((f) => ({ ...f, [key]: value }));
    setFieldErrors((e) => ({ ...e, [key]: "" }));
  };

  const loadExecutives = useCallback(async () => {
    const res = await getTeamDirectory();
    const list = Array.isArray(res.data) ? res.data : [];
    const next = filterLeadExecutiveCandidates(list);
    setExecutives(next);
    return next;
  }, []);

  const loadBootstrap = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [nextRes, execList] = await Promise.all([
        isEdit ? Promise.resolve({ data: {} }) : getLeadNextId(),
        loadExecutives(),
      ]);
      if (!isEdit) setLeadNo(nextRes?.data?.lead_no || "");
      try {
        const empRes = await getEmployees();
        const emps = Array.isArray(empRes.data) ? empRes.data : empRes.data?.items || [];
        setContacts(Array.isArray(emps) ? emps.filter((e) => e?.full_name || e?.name) : []);
      } catch {
        setContacts(execList);
      }
      if (isEdit) {
        const detail = await getLeadDetail(editId);
        const lead = detail?.data || {};
        setLeadNo(lead.lead_no || "");
        setForm({
          ...EMPTY_FORM,
          company_name: lead.company_name || "",
          contact_person: lead.contact_person || "",
          phone: lead.phone || "",
          email: lead.email || "",
          city: lead.city || "",
          state: lead.state || "",
          address: lead.address || "",
          pincode: lead.pincode || "",
          gst_number: lead.gst_number || "",
          product_id: lead.product_id ? String(lead.product_id) : "",
          product_name: lead.product_name || "",
          quantity: lead.quantity != null ? String(lead.quantity) : "",
          expected_value: lead.expected_value != null ? String(lead.expected_value) : "",
          expected_close_date: lead.expected_close_date || "",
          requirement_details: lead.requirement_details || "",
          source: lead.source || "Website",
          status: lead.status ? String(lead.status).charAt(0).toUpperCase() + String(lead.status).slice(1) : "New",
          priority: lead.priority ? String(lead.priority).charAt(0).toUpperCase() + String(lead.priority).slice(1) : "Medium",
          assigned_user_id: lead.assigned_user_id ? String(lead.assigned_user_id) : "",
          next_follow_up: lead.next_follow_up || "",
          notes: lead.notes || "",
        });
        setDiscussions(Array.isArray(lead.discussions) ? lead.discussions : []);
        setExistingFiles(Array.isArray(lead.attachments) ? lead.attachments : []);
        initialAssigned.current = true;
      }
    } catch (err) {
      setLoadError(err);
    } finally {
      setLoading(false);
    }
  }, [editId, isEdit, loadExecutives]);

  useEffect(() => {
    if (canCreate) loadBootstrap();
  }, [canCreate, loadBootstrap]);

  useEffect(() => {
    if (isEdit || !user?.id || initialAssigned.current || !executives.length) return;
    initialAssigned.current = true;
    setForm((f) => ({ ...f, assigned_user_id: String(user.id) }));
  }, [user?.id, executives.length, isEdit]);

  const executiveOptions = useMemo(
    () => executives.map((u) => ({ value: String(u.id), label: executiveDisplayName(u) })),
    [executives]
  );

  const contactOptions = useMemo(() => {
    const source = contacts.length ? contacts : executives;
    return source.map((row) => {
      const name = row.full_name || row.name || executiveDisplayName(row);
      const role = row.designation || row.role || row.department || "";
      return {
        value: String(row.id || name),
        label: personLabel(row),
        name,
        role,
      };
    });
  }, [contacts, executives]);

  const checkDuplicate = async (field) => {
    const phone = field === "phone" ? form.phone : undefined;
    const gst = field === "gst_number" ? form.gst_number : undefined;
    if (!phone && !gst) return;
    try {
      const res = await checkLeadDuplicate({ phone, gst_number: gst });
      const matches = res?.data?.matches || [];
      setDuplicateMatches(matches);
      setDuplicateAck(false);
    } catch {
      setDuplicateMatches([]);
    }
  };

  const validateClient = (asDraft) => {
    const errs = {};
    if (asDraft) {
      if (!form.company_name.trim()) errs.company_name = t("sales.leads.create.errors.companyRequired");
      return errs;
    }
    if (!form.company_name.trim()) errs.company_name = t("sales.leads.create.errors.companyRequired");
    if (!form.contact_person.trim()) errs.contact_person = t("sales.leads.create.errors.contactRequired");
    if (!form.phone.trim()) errs.phone = t("sales.leads.create.errors.phoneRequired");
    if (!form.product_id) errs.product_id = t("sales.leads.create.errors.productRequired");
    if (!form.source) errs.source = t("sales.leads.create.errors.sourceRequired");
    if (!form.assigned_user_id) errs.assigned_user_id = t("sales.leads.create.errors.assigneeRequired");
    if (form.pincode && !PIN_RE.test(form.pincode.replace(/\D/g, ""))) {
      errs.pincode = t("sales.leads.create.errors.pincode");
    }
    if (form.quantity && Number(form.quantity) <= 0) errs.quantity = t("sales.leads.create.errors.quantityPositive");
    if (form.expected_value && Number(form.expected_value) <= 0) {
      errs.expected_value = t("sales.leads.create.errors.valuePositive");
    }
    const today = new Date().toISOString().slice(0, 10);
    if (form.expected_close_date && form.expected_close_date < today) {
      errs.expected_close_date = t("sales.leads.create.errors.datePast");
    }
    if (form.next_follow_up && form.next_follow_up < today) {
      errs.next_follow_up = t("sales.leads.create.errors.datePast");
    }
    return errs;
  };

  const buildPayload = (asDraft) => ({
    company_name: form.company_name.trim(),
    contact_person: form.contact_person.trim(),
    phone: form.phone.trim(),
    email: form.email.trim() || null,
    city: form.city.trim() || null,
    state: form.state.trim() || null,
    address: form.address.trim() || null,
    pincode: form.pincode.trim() || null,
    gst_number: form.gst_number.trim() || null,
    product_id: form.product_id ? Number(form.product_id) : null,
    quantity: form.quantity ? Number(form.quantity) : null,
    expected_value: form.expected_value ? Number(form.expected_value) : null,
    expected_close_date: form.expected_close_date || null,
    requirement_details: form.requirement_details.trim() || null,
    source: form.source,
    status: asDraft ? "draft" : form.status.toLowerCase() || "new",
    priority: form.priority.toLowerCase() || "medium",
    assigned_user_id: form.assigned_user_id ? Number(form.assigned_user_id) : null,
    next_follow_up: form.next_follow_up || null,
    notes: form.notes.trim() || null,
    is_draft: Boolean(asDraft),
    discussions: isEdit
      ? undefined
      : discussions.map((d) => ({
          discussed_with: d.discussed_with,
          role: d.role || null,
          details: d.details,
        })),
  });

  const scrollToFirstError = () => {
    window.setTimeout(() => {
      const el = document.querySelector("[data-lead-error='true']");
      if (el && typeof el.scrollIntoView === "function") {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 0);
  };

  const submit = async (asDraft) => {
    if (savingRef.current) return;
    const errs = validateClient(asDraft);
    if (Object.keys(errs).length) {
      setFieldErrors(errs);
      addToast(Object.values(errs)[0], "error");
      scrollToFirstError();
      return;
    }
    if (!asDraft && duplicateMatches.length && !duplicateAck) {
      addToast(t("sales.leads.create.duplicateConfirm"), "warning");
      return;
    }
    savingRef.current = true;
    setSubmitKind(asDraft ? "draft" : "create");
    setSaving(true);
    try {
      const payload = buildPayload(asDraft);
      if (isEdit) {
        payload.next_followup = payload.next_follow_up;
        delete payload.next_follow_up;
        delete payload.is_draft;
        delete payload.discussions;
      }
      let lead;
      if (isEdit) {
        const res = await updateLead(editId, payload);
        lead = unwrapLead(res);
      } else {
        const res = await createLead(payload);
        lead = unwrapLead(res);
      }
      const leadId = lead?.id || (isEdit ? Number(editId) : null);
      if (!leadId) {
        throw new Error(t("sales.leads.create.saveFailed"));
      }
      if (files.length) {
        try {
          await uploadLeadAttachments(leadId, files);
        } catch (attachErr) {
          addToast(apiErrorMessage(attachErr, t("sales.leads.create.saveFailed")), "error");
          navigate(`/sales/leads/${leadId}`);
          return;
        }
      }
      if (isEdit) {
        const pending = discussions.filter((d) => String(d.id).startsWith("local-"));
        for (const d of pending) {
          await createLeadActivity(leadId, {
            type: "Discussion",
            subject: d.role ? `${d.discussed_with} — ${d.role}` : d.discussed_with,
            notes: d.details,
          });
        }
      }
      setDirty(false);
      addToast(
        asDraft ? t("sales.leads.create.savedDraft") : t(isEdit ? "sales.leads.create.updated" : "sales.leads.create.created"),
        "success"
      );
      navigate(`/sales/leads/${leadId}`);
    } catch (err) {
      applyBackendFieldErrors(err, setFieldErrors);
      const classified = classifyApiError(err, t("sales.leads.create.saveFailed"));
      addToast(classified.message, "error");
      scrollToFirstError();
    } finally {
      savingRef.current = false;
      setSaving(false);
      setSubmitKind(null);
    }
  };

  const onCancel = () => {
    if (savingRef.current) return;
    if (dirty) {
      setCancelOpen(true);
      return;
    }
    navigate("/sales/leads");
  };

  const onFiles = (e) => {
    const picked = Array.from(e.target.files || []);
    const valid = [];
    for (const f of picked) {
      const ext = `.${f.name.split(".").pop()?.toLowerCase()}`;
      if (!ALLOWED_EXT.includes(ext)) {
        addToast(t("sales.leads.create.fileType", { name: f.name }), "error");
        continue;
      }
      if (f.size > 10 * 1024 * 1024) {
        addToast(t("sales.leads.create.fileSize", { name: f.name }), "error");
        continue;
      }
      valid.push(f);
    }
    if (valid.length) {
      setDirty(true);
      setFiles((prev) => [...prev, ...valid]);
    }
    e.target.value = "";
  };

  const addDiscussion = () => {
    const person = discussionDraft.discussed_with.trim();
    const details = discussionDraft.details.trim();
    if (!person) {
      setDiscussionError(t("sales.leads.create.errors.discussedWith"));
      return;
    }
    if (!details) {
      setDiscussionError(t("sales.leads.create.errors.discussionDetails"));
      return;
    }
    setDiscussions((prev) => [
      ...prev,
      {
        id: `local-${Date.now()}`,
        discussed_with: person,
        role: discussionDraft.role.trim(),
        details,
        added_by: user?.full_name || user?.email,
        created_at: new Date().toISOString(),
      },
    ]);
    setDirty(true);
    setDiscussionOpen(false);
    setDiscussionDraft({ discussed_with: "", role: "", details: "" });
    setDiscussionError("");
  };

  if (!canCreate) {
    return (
      <div className="ui-page mx-auto max-w-[960px] p-4">
        <PermissionDeniedState description={t("sales.leads.create.permissionDenied")} />
      </div>
    );
  }

  return (
    <div className="ui-page mx-auto max-w-[960px] space-y-4 p-4 pb-24">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-[var(--color-text)]">
          {isEdit ? t("sales.leads.create.editTitle") : t("sales.leads.create.title")}
        </h1>
        {leadNo ? (
          <span className="rounded-full bg-[var(--color-surface-muted)] px-3 py-1 text-xs font-semibold text-[var(--color-text-secondary)]">
            {leadNo}
          </span>
        ) : null}
      </div>

      <AsyncPageBody
        loading={loading}
        errorObj={loadError}
        onRetry={loadBootstrap}
        loadingVariant="page"
        loadingLabel={t("sales.leads.create.loading")}
        errorTitle={t("sales.leads.create.loadError")}
      >
        <form
          id="create-lead-form"
          className="space-y-4"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            submit(false);
          }}
        >
          <SectionCard title={t("sales.leads.create.sectionCompany")}>
            <Field label={t("sales.leads.create.companyName")} required error={fieldErrors.company_name}>
              <input className={inputClass} value={form.company_name} onChange={(e) => set("company_name", e.target.value)} />
            </Field>
            <Field label={t("sales.leads.create.contactPerson")} required error={fieldErrors.contact_person}>
              <input className={inputClass} value={form.contact_person} onChange={(e) => set("contact_person", e.target.value)} />
            </Field>
            <Field label={t("sales.leads.create.phone")} required error={fieldErrors.phone}>
              <input
                className={inputClass}
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
                onBlur={() => checkDuplicate("phone")}
              />
            </Field>
            <Field label={t("sales.leads.create.email")} error={fieldErrors.email}>
              <input className={inputClass} value={form.email} onChange={(e) => set("email", e.target.value)} />
            </Field>
            <Field label={t("sales.leads.create.city")} error={fieldErrors.city}>
              <input className={inputClass} value={form.city} onChange={(e) => set("city", e.target.value)} />
            </Field>
            <Field label={t("sales.leads.create.state")} error={fieldErrors.state}>
              <input className={inputClass} value={form.state} onChange={(e) => set("state", e.target.value)} />
            </Field>
            <Field label={t("sales.leads.create.address")} className="lg:col-span-3" error={fieldErrors.address}>
              <textarea className={textareaClass} rows={2} value={form.address} onChange={(e) => set("address", e.target.value)} />
            </Field>
            <Field label={t("sales.leads.create.pincode")} error={fieldErrors.pincode}>
              <input
                className={inputClass}
                inputMode="numeric"
                maxLength={6}
                value={form.pincode}
                onChange={(e) => set("pincode", e.target.value.replace(/\D/g, "").slice(0, 6))}
              />
            </Field>
            <Field label={t("sales.leads.create.gst")} error={fieldErrors.gst_number}>
              <input
                className={inputClass}
                value={form.gst_number}
                onChange={(e) => set("gst_number", e.target.value)}
                onBlur={() => checkDuplicate("gst_number")}
              />
            </Field>
          </SectionCard>

          {duplicateMatches.length ? (
            <div className="rounded-lg border border-[var(--color-warning)]/40 bg-[var(--color-warning)]/10 p-3 text-sm">
              <p className="font-medium text-[var(--color-text)]">{t("sales.leads.create.duplicateWarning")}</p>
              <ul className="mt-2 list-disc pl-5">
                {duplicateMatches.map((m) => (
                  <li key={m.id}>
                    <Link to={`/sales/leads/${m.id}`} className="text-[var(--color-primary)] underline">
                      {m.lead_no || `#${m.id}`} — {m.company_name || m.contact_person}
                    </Link>
                  </li>
                ))}
              </ul>
              <label className="mt-2 flex items-center gap-2 text-xs">
                <input type="checkbox" checked={duplicateAck} onChange={(e) => setDuplicateAck(e.target.checked)} />
                {t("sales.leads.create.duplicateAck")}
              </label>
            </div>
          ) : null}

          <SectionCard title={t("sales.leads.create.sectionRequirement")}>
            <Field label={t("sales.leads.create.product")} required error={fieldErrors.product_id} className="lg:col-span-3">
              <button
                type="button"
                className={`${inputClass} flex items-center justify-between text-left`}
                onClick={() => setProductModalOpen(true)}
              >
                <span className={form.product_name ? "text-[var(--color-text)]" : "text-[#a0a0ab]"}>
                  {form.product_name || t("sales.leads.create.selectProduct")}
                </span>
              </button>
            </Field>
            <Field label={t("sales.leads.create.quantity")} error={fieldErrors.quantity}>
              <input className={inputClass} type="number" min="0" step="any" value={form.quantity} onChange={(e) => set("quantity", e.target.value)} />
            </Field>
            <Field label={t("sales.leads.create.expectedValue")} error={fieldErrors.expected_value}>
              <IndianCurrencyInput
                value={form.expected_value}
                onChange={(val) => set("expected_value", val)}
                placeholder="0"
                className={inputClass}
              />
            </Field>
            <Field label={t("sales.leads.create.expectedClose")} error={fieldErrors.expected_close_date}>
              <input className={inputClass} type="date" value={form.expected_close_date} onChange={(e) => set("expected_close_date", e.target.value)} />
            </Field>
            <Field label={t("sales.leads.create.requirementDetails")} className="md:col-span-2 lg:col-span-3" error={fieldErrors.requirement_details}>
              <textarea className={textareaClass} rows={3} value={form.requirement_details} onChange={(e) => set("requirement_details", e.target.value)} />
            </Field>
          </SectionCard>

          <SectionCard title={t("sales.leads.create.sectionDetails")}>
            <Field label={t("sales.leads.create.source")} required error={fieldErrors.source}>
              <select className={selectClass} value={form.source} onChange={(e) => set("source", e.target.value)}>
                {SOURCE_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </Field>
            <Field label={t("sales.leads.create.status")} error={fieldErrors.status}>
              <select className={selectClass} value={form.status} onChange={(e) => set("status", e.target.value)}>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </Field>
            <Field label={t("sales.leads.create.priority")} error={fieldErrors.priority}>
              <select className={selectClass} value={form.priority} onChange={(e) => set("priority", e.target.value)}>
                {PRIORITY_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </Field>
            <Field label={t("sales.leads.create.assignedTo")} required error={fieldErrors.assigned_user_id} className="md:col-span-2">
              <SearchableSelect
                value={form.assigned_user_id}
                onChange={(value) => set("assigned_user_id", value || "")}
                options={executiveOptions}
                placeholder={t("sales.leads.create.selectUser")}
                searchPlaceholder={t("sales.leads.create.selectUser")}
                clearable
                onClear={() => set("assigned_user_id", "")}
                clearAriaLabel="Clear assigned executive"
                footerOptions={
                  canAddExecutive
                    ? [{ value: ADD_EXECUTIVE_VALUE, label: t("sales.leads.create.addExecutive") }]
                    : []
                }
                onFooterPick={() => setAddExecutiveOpen(true)}
              />
              {canAddExecutive ? (
                <button
                  type="button"
                  className="mt-2 text-[12px] font-semibold text-[var(--color-primary)] hover:underline"
                  onClick={() => setAddExecutiveOpen(true)}
                >
                  {t("sales.leads.create.addExecutive")}
                </button>
              ) : null}
            </Field>
            <Field label={t("sales.leads.create.nextFollowUp")} error={fieldErrors.next_follow_up}>
              <input className={inputClass} type="date" value={form.next_follow_up} onChange={(e) => set("next_follow_up", e.target.value)} />
            </Field>
          </SectionCard>

          <SectionCard title={t("sales.leads.create.sectionDiscussion")} grid={false}>
            <div className="space-y-3">
              {discussions.length ? (
                <ul className="space-y-2">
                  {discussions.map((d) => (
                    <li key={d.id} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-3 text-sm">
                      <p className="font-semibold text-[var(--color-text)]">
                        {d.discussed_with}
                        {d.role ? ` — ${d.role}` : ""}
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-[var(--color-text-secondary)]">{d.details}</p>
                      <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">
                        {[d.added_by, d.created_at ? new Date(d.created_at).toLocaleString() : null].filter(Boolean).join(" · ")}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-[var(--color-text-muted)]">{t("sales.leads.create.noDiscussions")}</p>
              )}
              <Button type="button" variant="secondary" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setDiscussionOpen(true)}>
                {t("sales.leads.create.addDiscussion")}
              </Button>
            </div>
          </SectionCard>

          <SectionCard title={t("sales.leads.create.sectionNotes")} grid={false}>
            <Field label={t("sales.leads.create.notes")} error={fieldErrors.notes}>
              <textarea className={textareaClass} rows={3} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
            </Field>
            <Field label={t("sales.leads.create.attachments")} className="mt-4">
              <button
                type="button"
                className="flex min-h-20 w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-[var(--color-border)] bg-[var(--color-surface-muted)] text-[13px] text-[var(--color-text-muted)] hover:bg-[var(--color-primary-soft)]"
                onClick={() => fileInputRef.current?.click()}
              >
                <Paperclip className="mb-1 h-5 w-5 text-[var(--color-primary)]" />
                {t("sales.leads.create.addFiles")}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept={ALLOWED_EXT.join(",")}
                className="sr-only"
                onChange={onFiles}
              />
              {existingFiles.length || files.length ? (
                <ul className="mt-3 space-y-2 rounded-lg border border-[var(--color-border)] p-2">
                  {existingFiles.map((f) => (
                    <li key={`saved-${f.id}`} className="flex items-center justify-between gap-2 text-sm">
                      <span className="flex min-w-0 items-center gap-2">
                        <FileText className="h-4 w-4 shrink-0 text-[var(--color-primary)]" />
                        <span className="truncate">{f.file_name}</span>
                      </span>
                      <button
                        type="button"
                        className="rounded p-1 text-[var(--color-text-muted)] hover:text-[var(--color-danger)]"
                        aria-label={t("sales.leads.create.removeFile")}
                        onClick={async () => {
                          try {
                            await deleteLeadAttachment(editId, f.id);
                            setExistingFiles((prev) => prev.filter((row) => row.id !== f.id));
                          } catch (err) {
                            addToast(apiErrorMessage(err, t("sales.leads.create.saveFailed")), "error");
                          }
                        }}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                  {files.map((f, i) => (
                    <li key={`${f.name}-${f.size}-${i}`} className="flex items-center justify-between gap-2 text-sm">
                      <span className="flex min-w-0 items-center gap-2">
                        <FileText className="h-4 w-4 shrink-0 text-[var(--color-primary)]" />
                        <span className="truncate">{f.name}</span>
                      </span>
                      <button
                        type="button"
                        className="rounded p-1 text-[var(--color-text-muted)] hover:text-[var(--color-danger)]"
                        aria-label={t("sales.leads.create.removeFile")}
                        onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </Field>
          </SectionCard>

          <div
            ref={footerRef}
            data-skip-nav-loader
            className="sticky bottom-0 z-20 flex flex-wrap justify-end gap-2 border-t border-[var(--color-border)] bg-[var(--color-bg)] py-4 pointer-events-auto max-lg:bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))]"
          >
            <Button type="button" variant="secondary" disabled={saving} onClick={onCancel}>
              {t("sales.leads.create.cancel")}
            </Button>
            {!isEdit ? (
              <Button
                type="button"
                variant="secondary"
                disabled={saving}
                loading={saving && submitKind === "draft"}
                onClick={() => submit(true)}
              >
                {saving && submitKind === "draft" ? t("sales.leads.create.savingDraft") : t("sales.leads.create.saveDraft")}
              </Button>
            ) : null}
            <Button
              type="submit"
              form="create-lead-form"
              variant="primary"
              disabled={saving}
              loading={saving && submitKind === "create"}
            >
              {saving && submitKind === "create"
                ? t(isEdit ? "sales.leads.create.savingChanges" : "sales.leads.create.creating")
                : t(isEdit ? "sales.leads.create.saveChanges" : "sales.leads.create.submit")}
            </Button>
          </div>
        </form>
      </AsyncPageBody>

      <LeadProductSelectModal
        open={productModalOpen}
        selectedId={form.product_id}
        onClose={() => setProductModalOpen(false)}
        onSelect={(product) => {
          set("product_id", String(product.id));
          setForm((f) => ({ ...f, product_id: String(product.id), product_name: product.name }));
          setFieldErrors((e) => ({ ...e, product_id: "" }));
          setDirty(true);
          setProductModalOpen(false);
        }}
      />

      {canAddExecutive ? (
        <AddExecutiveNameModal
          open={addExecutiveOpen}
          onClose={() => setAddExecutiveOpen(false)}
          onSuccess={async (created) => {
            const list = await loadExecutives();
            const match = findExecutiveById(list, created?.id) || created;
            if (match?.id) set("assigned_user_id", String(match.id));
          }}
        />
      ) : null}

      <AdminModal
        open={discussionOpen}
        onClose={() => setDiscussionOpen(false)}
        title={t("sales.leads.create.addDiscussion")}
        maxWidth="max-w-md"
      >
        <div className="space-y-3 p-5">
          <Field label={t("sales.leads.create.discussedWith")} required error={discussionError && !discussionDraft.discussed_with ? discussionError : ""}>
            <SearchableSelect
              value={
                contactOptions.find(
                  (o) => o.name === discussionDraft.discussed_with && o.role === discussionDraft.role
                )?.value || discussionDraft.discussed_with
              }
              onChange={(value) => {
                const opt = contactOptions.find((o) => String(o.value) === String(value));
                setDiscussionDraft((d) => ({
                  ...d,
                  discussed_with: opt?.name || value || "",
                  role: opt?.role || d.role,
                }));
                setDiscussionError("");
              }}
              options={contactOptions}
              placeholder={t("sales.leads.create.selectPerson")}
              allowCustom
            />
          </Field>
          <Field label={t("sales.leads.create.discussionDetails")} required>
            <textarea
              className={textareaClass}
              rows={4}
              value={discussionDraft.details}
              onChange={(e) => {
                setDiscussionDraft((d) => ({ ...d, details: e.target.value }));
                setDiscussionError("");
              }}
            />
            {discussionError && discussionDraft.discussed_with ? <FieldError message={discussionError} /> : null}
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setDiscussionOpen(false)}>
              {t("sales.leads.create.cancel")}
            </Button>
            <Button type="button" variant="primary" onClick={addDiscussion}>
              {t("sales.leads.create.addDiscussion")}
            </Button>
          </div>
        </div>
      </AdminModal>

      <ConfirmDialog
        open={cancelOpen}
        title={t("sales.leads.create.unsavedTitle")}
        message={t("sales.leads.create.unsavedMessage")}
        confirmLabel={t("sales.leads.create.leave")}
        cancelLabel={t("sales.leads.create.stay")}
        destructive={false}
        onClose={() => setCancelOpen(false)}
        onConfirm={() => {
          setCancelOpen(false);
          setDirty(false);
          navigate("/sales/leads");
        }}
      />
    </div>
  );
}
