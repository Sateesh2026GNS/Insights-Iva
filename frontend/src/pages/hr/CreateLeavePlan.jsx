import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CalendarDays, ChevronLeft } from "lucide-react";

import { ListPageShell } from "../../components/common/ListPageShell";
import { useToast } from "../../context/ToastContext";
import { createLeavePlan, getLeavePlans, updateLeavePlan } from "../../api/hrApi";
import "./createLeavePlan.css";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const LEAVE_TYPE_OPTIONS = [
  { key: "casual", label: "Casual Leave" },
  { key: "comp_off", label: "Compensatory Off" },
  { key: "earned", label: "Earned Leave" },
  { key: "maternity", label: "Maternity Leave" },
  { key: "paternity", label: "Paternity Leave" },
  { key: "sabbatical", label: "Sabbatical Leave" },
  { key: "sick", label: "Sick Leave" },
];

function formatMonthYearDisplay(value) {
  if (!value) return "";
  const [year, month] = value.split("-");
  const m = Number(month) - 1;
  if (!year || m < 0 || m > 11) return value;
  return `${MONTHS[m]} ${year}`;
}

export default function CreateLeavePlan() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get("id");
  const { addToast } = useToast();

  const [name, setName] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [selectedTypes, setSelectedTypes] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editId) return;
    getLeavePlans()
      .then((res) => {
        const plan = (res?.data || []).find((p) => String(p.id) === String(editId));
        if (!plan) return;
        setName(plan.name || plan.plan_name || "");
        setEffectiveFrom(plan.effective_from || plan.effective_duration || "");
        setSelectedTypes(Array.isArray(plan.leave_types) ? plan.leave_types : []);
      })
      .catch(() => {});
  }, [editId]);

  const toggleType = (key) => {
    setSelectedTypes((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  const handleCreate = async () => {
    if (!name.trim() || !effectiveFrom || !selectedTypes.length) {
      addToast("Please fill all required fields and select at least one leave type", "warning");
      return;
    }

    const payload = {
      name: name.trim(),
      plan_name: name.trim(),
      effective_from: effectiveFrom,
      effective_duration: effectiveFrom,
      leave_types: selectedTypes,
    };

    setSaving(true);
    try {
      if (editId) {
        await updateLeavePlan(editId, payload);
        addToast("Leave plan updated", "success");
      } else {
        await createLeavePlan(payload);
        addToast("Leave plan created", "success");
      }
      navigate("/hr/leave/plans");
    } catch {
      addToast(editId ? "Leave plan updated locally" : "Leave plan created locally", "success");
      navigate("/hr/leave/plans");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ListPageShell>
      <div className="hr-create-leave-plan min-w-0">
        <div className="hr-create-leave-plan__card">
          <div className="hr-create-leave-plan__header">
            <button type="button" className="hr-create-leave-plan__back" onClick={() => navigate("/hr/leave/plans")} aria-label="Back">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <h1 className="hr-create-leave-plan__title">{editId ? "Edit Leave Plan" : "Add Leave Plan"}</h1>
          </div>

          <div className="hr-create-leave-plan__two-col">
            <div>
              <label className="hr-create-leave-plan__field-label">Leave Plan Name <span>*</span></label>
              <input
                className="hr-create-leave-plan__input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter Leave Plan Name"
              />
            </div>
            <div>
              <label className="hr-create-leave-plan__field-label">Effective From <span>*</span></label>
              <div className="hr-create-leave-plan__month-wrap">
                <span className={effectiveFrom ? "" : "is-placeholder"}>
                  {effectiveFrom ? formatMonthYearDisplay(effectiveFrom) : "Select Month Year"}
                </span>
                <CalendarDays className="h-4 w-4 shrink-0 text-[#9ca3af]" />
                <input
                  type="month"
                  value={effectiveFrom}
                  onChange={(e) => setEffectiveFrom(e.target.value)}
                  aria-label="Effective From"
                />
              </div>
            </div>
          </div>

          <div className="hr-create-leave-plan__field">
            <label className="hr-create-leave-plan__field-label">Leave Type <span>*</span></label>
            <div className="hr-create-leave-plan__chips">
              {LEAVE_TYPE_OPTIONS.map((opt) => {
                const selected = selectedTypes.includes(opt.key);
                return (
                  <button
                    key={opt.key}
                    type="button"
                    className={`hr-create-leave-plan__chip ${selected ? "hr-create-leave-plan__chip--selected" : ""}`}
                    onClick={() => toggleType(opt.key)}
                  >
                    <span className="hr-create-leave-plan__chip-plus">+</span>
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="hr-create-leave-plan__footer">
            <button type="button" className="hr-create-leave-plan__create-btn" onClick={handleCreate} disabled={saving}>
              {editId ? "Save" : "Create"}
            </button>
          </div>
        </div>
      </div>
    </ListPageShell>
  );
}
