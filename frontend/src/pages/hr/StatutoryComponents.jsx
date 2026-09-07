import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Info, Pencil, Plus } from "lucide-react";

import Loader from "../../components/common/Loader";
import { ListPageShell } from "../../components/common/ListPageShell";
import usePageRefresh from "../../hooks/usePageRefresh";
import { useToast } from "../../context/ToastContext";
import {
  getStatutoryEsic,
  getStatutoryPf,
  getStatutoryPt,
  saveStatutoryEsic,
  saveStatutoryPf,
  saveStatutoryPt,
} from "../../api/hrApi";
import "./statutoryComponents.css";

const TABS = [
  { key: "pf", label: "Provident Fund" },
  { key: "pt", label: "Professional Tax" },
  { key: "esic", label: "ESIC" },
];

const PF_COMPONENT_OPTIONS = ["Basic", "DA", "HRA"];

const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat",
  "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh",
  "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab",
  "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh",
  "Uttarakhand", "West Bengal", "Delhi", "Jammu and Kashmir", "Ladakh", "Puducherry",
];

const EMPLOYER_MODE_LABELS = {
  deduction: "Include employer's contribution as part of the Deduction",
  ctc: "Include employer's contribution as part of the CTC",
  hide: "Do not show employer's contribution as part of CTC and Deduction",
};

const DEFAULT_PF = {
  configured: true,
  epf_number: "",
  deduction_cycle: "Monthly",
  employee_rate: "12",
  employer_rate: "12",
  components: [],
  employer_contribution_mode: "hide",
  min_limit_1800: false,
  is_active: false,
};

const DEFAULT_PT = {
  configured: false,
  pt_number: "",
  work_location: "",
  deduction_cycle: "Monthly",
  slabs: [{ id: "slab-1", start_range: "", end_range: "", tax_amount: "" }],
  slab_mode: "dynamic",
  is_active: false,
};

const DEFAULT_ESIC = {
  configured: true,
  compliance_mode: "old",
  esic_number: "",
  employee_rate: "0.75",
  employer_rate: "3.25",
  employer_contribution_mode: "hide",
  components: [],
  deduction_mode: "wage_limit",
  is_active: false,
};

function dash(value) {
  if (value === null || value === undefined || value === "") return "—";
  return value;
}

function ComponentMultiSelect({ value, onChange, options }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const filtered = options.filter((o) => o.toLowerCase().includes(search.toLowerCase()));
  const label = value.length ? value.join(", ") : "Select Component";

  const toggle = (item) => {
    if (value.includes(item)) onChange(value.filter((v) => v !== item));
    else onChange([...value, item]);
  };

  return (
    <div ref={rootRef} className="hr-statutory__multi-select">
      <button type="button" className="hr-statutory__multi-trigger" onClick={() => setOpen((v) => !v)}>
        <span className={value.length ? "" : "is-placeholder"}>{label}</span>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {open ? (
        <div className="hr-statutory__multi-menu">
          <input
            className="hr-statutory__multi-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search"
          />
          {filtered.map((opt) => (
            <label key={opt} className="hr-statutory__multi-option">
              <input type="checkbox" checked={value.includes(opt)} onChange={() => toggle(opt)} />
              <span>{opt}</span>
            </label>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function StatusToggle({ checked, onChange, disabled }) {
  return (
    <button
      type="button"
      className={`hr-statutory__toggle ${checked ? "hr-statutory__toggle--on" : ""}`}
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      aria-pressed={checked}
    >
      <span />
    </button>
  );
}

function PfTab({ data, editing, onEdit, onCancel, onSave }) {
  const [form, setForm] = useState(data);

  useEffect(() => {
    setForm(data);
  }, [data, editing]);

  const set = (patch) => setForm((p) => ({ ...p, ...patch }));

  if (!editing && data.configured) {
    return (
      <div className="hr-statutory__card">
        <div className="hr-statutory__card-head">
          <h2>Provident Fund Calculation</h2>
          <button type="button" className="hr-statutory__edit-btn" onClick={onEdit}>
            <Pencil className="h-4 w-4" />
            Edit
          </button>
        </div>
        <div className="hr-statutory__view-grid">
          <div className="hr-statutory__view-item">
            <span className="hr-statutory__view-label">EPF Number :</span>
            <span className="hr-statutory__view-value">{dash(data.epf_number)}</span>
          </div>
          <div className="hr-statutory__view-item">
            <span className="hr-statutory__view-label">Deduction Cycle :</span>
            <span className="hr-statutory__view-value">{dash(data.deduction_cycle)}</span>
          </div>
          <div className="hr-statutory__view-item">
            <span className="hr-statutory__view-label">Employer Contribution Rate :</span>
            <span className="hr-statutory__view-value">{data.employer_rate}% of Actual PF Wage</span>
          </div>
          <div className="hr-statutory__view-item">
            <span className="hr-statutory__view-label">Employee Contribution Rate :</span>
            <span className="hr-statutory__view-value">{data.employee_rate}% of Actual PF Wage</span>
          </div>
          <div className="hr-statutory__view-item">
            <span className="hr-statutory__view-label">Set the minimum limit of deduction to Rs.1800/- :</span>
            <span className="hr-statutory__view-value">{data.min_limit_1800 ? "Yes" : "No"}</span>
          </div>
          <div className="hr-statutory__view-item">
            <span className="hr-statutory__view-label">Component for PF Calculation :</span>
            <span className="hr-statutory__view-value">{data.components?.length ? data.components.join(", ") : "—"}</span>
          </div>
          <div className="hr-statutory__view-item hr-statutory__view-item--wide">
            <label className="hr-statutory__view-check">
              <input type="checkbox" checked readOnly />
              <span>{EMPLOYER_MODE_LABELS[data.employer_contribution_mode] || EMPLOYER_MODE_LABELS.hide}</span>
            </label>
          </div>
          <div className="hr-statutory__view-item">
            <span className="hr-statutory__view-label">Status :</span>
            <StatusToggle
              checked={data.is_active}
              onChange={(v) => onSave({ ...data, is_active: v }, false)}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="hr-statutory__card">
      <h2 className="hr-statutory__section-title">Provident Fund Calculation</h2>

      <div className="hr-statutory__form-grid hr-statutory__form-grid--2">
        <div className="hr-statutory__field">
          <label className="hr-statutory__label">EPF Number</label>
          <input className="hr-statutory__input" value={form.epf_number} onChange={(e) => set({ epf_number: e.target.value })} />
        </div>
        <div className="hr-statutory__field">
          <label className="hr-statutory__label">Deduction Cycle</label>
          <input className="hr-statutory__input is-disabled" value={form.deduction_cycle} disabled readOnly />
        </div>
      </div>

      <div className="hr-statutory__form-grid hr-statutory__form-grid--2">
        <div className="hr-statutory__field">
          <label className="hr-statutory__label">Employee Contribution Rate</label>
          <div className="hr-statutory__inline-input">
            <input className="hr-statutory__input" value={form.employee_rate} onChange={(e) => set({ employee_rate: e.target.value })} />
            <span>% of Actual PF Wage</span>
          </div>
        </div>
        <div className="hr-statutory__field">
          <label className="hr-statutory__label">Employer Contribution Rate</label>
          <div className="hr-statutory__inline-input">
            <input className="hr-statutory__input" value={form.employer_rate} onChange={(e) => set({ employer_rate: e.target.value })} />
            <span>% of Actual PF Wage</span>
          </div>
        </div>
      </div>

      <div className="hr-statutory__field">
        <label className="hr-statutory__label">Select Component for PF Calculation</label>
        <ComponentMultiSelect
          value={form.components || []}
          onChange={(v) => set({ components: v })}
          options={PF_COMPONENT_OPTIONS}
        />
      </div>

      <div className="hr-statutory__radio-group">
        {Object.entries(EMPLOYER_MODE_LABELS).map(([key, label]) => (
          <label key={key} className="hr-statutory__radio">
            <input
              type="radio"
              name="pfEmployerMode"
              checked={form.employer_contribution_mode === key}
              onChange={() => set({ employer_contribution_mode: key })}
            />
            <span>{label}</span>
          </label>
        ))}
      </div>

      <label className="hr-statutory__checkbox">
        <input type="checkbox" checked={form.min_limit_1800} onChange={(e) => set({ min_limit_1800: e.target.checked })} />
        <span>Set the minimum limit of deduction to Rs.1800/-</span>
      </label>

      <div className="hr-statutory__info-box">
        <div className="hr-statutory__info-title">
          <Info className="h-4 w-4" />
          PF Contribution Adjustment
        </div>
        <ul>
          <li>If the monthly Basic + DA exceeds ₹15,000, contributions are typically calculated based on your PF wages without any change.</li>
          <li>If the monthly Basic + DA is below ₹15,000, contributions are adjusted proportionately each month.</li>
        </ul>
      </div>

      <div className="hr-statutory__footer">
        <label className="hr-statutory__checkbox">
          <input type="checkbox" checked={form.is_active} onChange={(e) => set({ is_active: e.target.checked })} />
          <span>Mark this as Active</span>
        </label>
        <div className="hr-statutory__footer-actions">
          <button type="button" className="hr-statutory__cancel-btn" onClick={onCancel}>Cancel</button>
          <button type="button" className="hr-statutory__save-btn" onClick={() => onSave({ ...form, configured: true })}>Save</button>
        </div>
      </div>
    </div>
  );
}

function PtTab({ data, onSave }) {
  const [form, setForm] = useState(data);
  useEffect(() => { setForm(data); }, [data]);

  const set = (patch) => setForm((p) => ({ ...p, ...patch }));

  const updateSlab = (id, patch) => {
    setForm((p) => ({
      ...p,
      slabs: p.slabs.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    }));
  };

  const addSlab = () => {
    setForm((p) => ({
      ...p,
      slabs: [...p.slabs, { id: `slab-${Date.now()}`, start_range: "", end_range: "", tax_amount: "" }],
    }));
  };

  return (
    <div className="hr-statutory__card">
      <h2 className="hr-statutory__section-title">Professional Tax Calculation</h2>

      <div className="hr-statutory__form-grid hr-statutory__form-grid--3">
        <div className="hr-statutory__field">
          <label className="hr-statutory__label">PT Number</label>
          <input className="hr-statutory__input" placeholder="PT Number" value={form.pt_number} onChange={(e) => set({ pt_number: e.target.value })} />
        </div>
        <div className="hr-statutory__field">
          <label className="hr-statutory__label">Work Location</label>
          <select className="hr-statutory__select" value={form.work_location} onChange={(e) => set({ work_location: e.target.value })}>
            <option value="">Select State</option>
            {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="hr-statutory__field">
          <label className="hr-statutory__label">Deduction Cycle</label>
          <input className="hr-statutory__input is-disabled" value={form.deduction_cycle} disabled readOnly />
        </div>
      </div>

      <h3 className="hr-statutory__sub-title">Tax Slabs based on Monthly Gross Salary</h3>
      <div className="hr-statutory__slab-table-wrap">
        <table className="hr-statutory__slab-table">
          <thead>
            <tr>
              <th>Start Range ₹</th>
              <th>End Range ₹</th>
              <th>Monthly TAX Amount ₹</th>
            </tr>
          </thead>
          <tbody>
            {form.slabs.map((slab) => (
              <tr key={slab.id}>
                <td>
                  <input className="hr-statutory__input" placeholder="Enter Start Range" value={slab.start_range} onChange={(e) => updateSlab(slab.id, { start_range: e.target.value })} />
                </td>
                <td>
                  <input className="hr-statutory__input" placeholder="Enter End Range" value={slab.end_range} onChange={(e) => updateSlab(slab.id, { end_range: e.target.value })} />
                </td>
                <td>
                  <input className="hr-statutory__input" placeholder="Enter Tax Amount" value={slab.tax_amount} onChange={(e) => updateSlab(slab.id, { tax_amount: e.target.value })} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button type="button" className="hr-statutory__add-slab" onClick={addSlab}>
        <Plus className="h-4 w-4" />
        Add Slab
      </button>

      <div className="hr-statutory__radio-group">
        <label className="hr-statutory__radio">
          <input type="radio" name="ptSlabMode" checked={form.slab_mode === "dynamic"} onChange={() => set({ slab_mode: "dynamic" })} />
          <span>Apply PT slab dynamically based on monthly gross salary</span>
        </label>
        <label className="hr-statutory__radio">
          <input type="radio" name="ptSlabMode" checked={form.slab_mode === "fixed"} onChange={() => set({ slab_mode: "fixed" })} />
          <span>Use fixed PT slab as configured in salary structure</span>
        </label>
      </div>

      <div className="hr-statutory__footer">
        <label className="hr-statutory__checkbox">
          <input type="checkbox" checked={form.is_active} onChange={(e) => set({ is_active: e.target.checked })} />
          <span>Mark this as Active</span>
        </label>
        <div className="hr-statutory__footer-actions">
          <button type="button" className="hr-statutory__cancel-btn" onClick={() => setForm(data)}>Cancel</button>
          <button type="button" className="hr-statutory__save-btn" onClick={() => onSave({ ...form, configured: true })}>Save</button>
        </div>
      </div>
    </div>
  );
}

function EsicTab({ data, editing, onEdit, onCancel, onSave }) {
  const [form, setForm] = useState(data);

  useEffect(() => {
    setForm(data);
  }, [data, editing]);

  const set = (patch) => setForm((p) => ({ ...p, ...patch }));
  const wageLabel = form.compliance_mode === "new" ? "% of Wages" : "% of Gross Pay";

  if (!editing && data.configured) {
    return (
      <div className="hr-statutory__card">
        <div className="hr-statutory__card-head">
          <h2>Employee&apos;s State Insurance</h2>
          <button type="button" className="hr-statutory__edit-btn" onClick={onEdit}>
            <Pencil className="h-4 w-4" />
            Edit
          </button>
        </div>
        <div className="hr-statutory__view-grid">
          <div className="hr-statutory__view-item">
            <span className="hr-statutory__view-label">ESIC Number :</span>
            <span className="hr-statutory__view-value hr-statutory__view-value--dash">{dash(data.esic_number)}</span>
          </div>
          <div className="hr-statutory__view-item">
            <span className="hr-statutory__view-label">Employee&apos;s Contribution :</span>
            <span className="hr-statutory__view-value hr-statutory__view-value--dash">
              {data.employee_rate ? `${data.employee_rate}%` : "—"}
            </span>
          </div>
          <div className="hr-statutory__view-item">
            <span className="hr-statutory__view-label">Employer&apos;s Contribution :</span>
            <span className="hr-statutory__view-value hr-statutory__view-value--dash">
              {data.employer_rate ? `${data.employer_rate}%` : "—"}
            </span>
          </div>
          <div className="hr-statutory__view-item">
            <span className="hr-statutory__view-label">Component for ESIC Calculation :</span>
            <span className="hr-statutory__view-value">{data.components?.length ? data.components.join(", ") : "—"}</span>
          </div>
          <div className="hr-statutory__view-item">
            <span className="hr-statutory__view-label">Deduction :</span>
            <span className="hr-statutory__view-value">{data.deduction_cycle || "Monthly"}</span>
          </div>
          <div className="hr-statutory__view-item">
            <span className="hr-statutory__view-label">Status :</span>
            <StatusToggle checked={data.is_active} onChange={(v) => onSave({ ...data, is_active: v }, false)} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="hr-statutory__card">
      <div className="hr-statutory__card-head hr-statutory__card-head--form">
        <h2 className="hr-statutory__section-title">Employee&apos;s State Insurance</h2>
        <div className="hr-statutory__compliance-row">
          <label className="hr-statutory__radio">
            <input type="radio" name="esicCompliance" checked={form.compliance_mode === "old"} onChange={() => set({ compliance_mode: "old" })} />
            <span>Old Compliance</span>
          </label>
          <label className="hr-statutory__radio">
            <input type="radio" name="esicCompliance" checked={form.compliance_mode === "new"} onChange={() => set({ compliance_mode: "new" })} />
            <span>New Compliance</span>
          </label>
        </div>
      </div>

      <div className="hr-statutory__field">
        <label className="hr-statutory__label">ESIC Number</label>
        <input className="hr-statutory__input" value={form.esic_number} onChange={(e) => set({ esic_number: e.target.value })} />
      </div>

      <div className="hr-statutory__form-grid hr-statutory__form-grid--2">
        <div className="hr-statutory__field">
          <label className="hr-statutory__label">Employee&apos;s Contribution</label>
          <div className="hr-statutory__inline-input">
            <input className="hr-statutory__input" value={form.employee_rate} onChange={(e) => set({ employee_rate: e.target.value })} />
            <span>{wageLabel}</span>
          </div>
        </div>
        <div className="hr-statutory__field">
          <label className="hr-statutory__label">Employer&apos;s Contribution</label>
          <div className="hr-statutory__inline-input">
            <input className="hr-statutory__input" value={form.employer_rate} onChange={(e) => set({ employer_rate: e.target.value })} />
            <span>{wageLabel}</span>
          </div>
        </div>
      </div>

      <div className="hr-statutory__radio-group">
        {Object.entries(EMPLOYER_MODE_LABELS).map(([key, label]) => (
          <label key={key} className="hr-statutory__radio">
            <input
              type="radio"
              name="esicEmployerMode"
              checked={form.employer_contribution_mode === key}
              onChange={() => set({ employer_contribution_mode: key })}
            />
            <span>{label}</span>
          </label>
        ))}
      </div>

      {form.compliance_mode === "new" ? (
        <div className="hr-statutory__field">
          <label className="hr-statutory__label">Select Component for ESIC Calculation</label>
          <ComponentMultiSelect
            value={form.components || []}
            onChange={(v) => set({ components: v })}
            options={PF_COMPONENT_OPTIONS}
          />
        </div>
      ) : null}

      <h3 className="hr-statutory__sub-title">ESIC deductions</h3>
      <div className="hr-statutory__radio-group">
        <label className="hr-statutory__radio">
          <input
            type="radio"
            name="esicDeduction"
            checked={form.deduction_mode === "wage_limit"}
            onChange={() => set({ deduction_mode: "wage_limit" })}
          />
          <span>
            {form.compliance_mode === "new"
              ? "ESIC deductions will be made only if the employee's defined wages is less than or equal to ₹21,000."
              : "ESIC deductions will be made only if the employee's monthly gross salary is less than or equal to ₹21,000."}
          </span>
        </label>
        <label className="hr-statutory__radio">
          <input type="radio" name="esicDeduction" checked={form.deduction_mode === "all"} onChange={() => set({ deduction_mode: "all" })} />
          <span>Include ESIC deductions for all employees</span>
        </label>
      </div>

      <div className="hr-statutory__footer">
        <label className="hr-statutory__checkbox">
          <input type="checkbox" checked={form.is_active} onChange={(e) => set({ is_active: e.target.checked })} />
          <span>Mark this as Active</span>
        </label>
        <div className="hr-statutory__footer-actions">
          <button type="button" className="hr-statutory__cancel-btn" onClick={onCancel}>Cancel</button>
          <button type="button" className="hr-statutory__save-btn" onClick={() => onSave({ ...form, configured: true, deduction_cycle: "Monthly" })}>Save</button>
        </div>
      </div>
    </div>
  );
}

export default function StatutoryComponents() {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("pf");
  const [pf, setPf] = useState(DEFAULT_PF);
  const [pt, setPt] = useState(DEFAULT_PT);
  const [esic, setEsic] = useState(DEFAULT_ESIC);
  const [pfEditing, setPfEditing] = useState(false);
  const [esicEditing, setEsicEditing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const [pfRes, ptRes, esicRes] = await Promise.all([
        getStatutoryPf(),
        getStatutoryPt(),
        getStatutoryEsic(),
      ]);
      setPf(pfRes?.data || DEFAULT_PF);
      setPt(ptRes?.data || DEFAULT_PT);
      setEsic(esicRes?.data || DEFAULT_ESIC);
    } catch {
      setPf(DEFAULT_PF);
      setPt(DEFAULT_PT);
      setEsic(DEFAULT_ESIC);
    } finally {
      setLoading(false);
      setPfEditing(false);
      setEsicEditing(false);
    }
  }, []);

  usePageRefresh(() => load(true));
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!loading && pf.configured) setPfEditing(false);
    else if (!loading && !pf.configured) setPfEditing(true);
  }, [loading, pf.configured]);

  const savePf = async (payload, closeEdit = true) => {
    try {
      await saveStatutoryPf(payload);
      setPf(payload);
      addToast("Provident Fund settings saved", "success");
      if (closeEdit) setPfEditing(false);
    } catch {
      addToast("Failed to save Provident Fund settings", "error");
    }
  };

  const savePt = async (payload) => {
    try {
      await saveStatutoryPt(payload);
      setPt(payload);
      addToast("Professional Tax settings saved", "success");
    } catch {
      addToast("Failed to save Professional Tax settings", "error");
    }
  };

  const saveEsic = async (payload, closeEdit = true) => {
    try {
      await saveStatutoryEsic(payload);
      setEsic(payload);
      addToast("ESIC settings saved", "success");
      if (closeEdit) setEsicEditing(false);
    } catch {
      addToast("Failed to save ESIC settings", "error");
    }
  };

  if (loading) return <Loader label="Loading statutory components..." />;

  const pfShowEdit = pfEditing || !pf.configured;
  const esicShowEdit = esicEditing;

  return (
    <ListPageShell>
      <div className="hr-statutory min-w-0">
        <h1 className="hr-statutory__title">Statutory Components</h1>

        <div className="hr-statutory__tabs">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              className={`hr-statutory__tab ${tab === t.key ? "hr-statutory__tab--active" : ""}`}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "pf" ? (
          <PfTab
            data={pf}
            editing={pfShowEdit}
            onEdit={() => setPfEditing(true)}
            onCancel={() => setPfEditing(false)}
            onSave={savePf}
          />
        ) : null}

        {tab === "pt" ? <PtTab data={pt} onSave={savePt} /> : null}

        {tab === "esic" ? (
          <EsicTab
            data={esic}
            editing={esicShowEdit}
            onEdit={() => setEsicEditing(true)}
            onCancel={() => setEsicEditing(false)}
            onSave={saveEsic}
          />
        ) : null}
      </div>
    </ListPageShell>
  );
}
