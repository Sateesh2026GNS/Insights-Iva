import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarDays } from "lucide-react";

import { ListPageShell } from "../../components/common/ListPageShell";
import { useToast } from "../../context/ToastContext";
import { createPreboardingCandidate } from "../../api/hrApi";
import "./addCandidate.css";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const GENDER_OPTIONS = [
  { value: "", label: "Select Gender" },
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
];

const DESIGNATION_OPTIONS = [
  { value: "", label: "Select Designation" },
  { value: "engineer", label: "Engineer" },
  { value: "manager", label: "Manager" },
  { value: "operator", label: "Operator" },
  { value: "accountant", label: "Accountant" },
  { value: "hr_executive", label: "HR Executive" },
];

const EMPLOYMENT_OPTIONS = [
  { value: "", label: "Select Employment Type" },
  { value: "permanent", label: "Permanent" },
  { value: "contract", label: "Contract" },
  { value: "probation", label: "Probation" },
];

const BRANCH_OPTIONS = [
  { value: "", label: "Select Branch" },
  { value: "hq", label: "Head Office" },
  { value: "plant", label: "Manufacturing Plant" },
];

const DEPARTMENT_OPTIONS = [
  { value: "", label: "Select Department" },
  { value: "production", label: "Production" },
  { value: "hr", label: "Human Resources" },
  { value: "accounts", label: "Accounts" },
];

function formatDisplayDate(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return `${String(d.getDate()).padStart(2, "0")}-${MONTHS[d.getMonth()]}-${d.getFullYear()}`;
}

function FormSelect({ value, onChange, options, error }) {
  return (
    <div className="hr-add-candidate__field-control">
      <select className="hr-add-candidate__select" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((opt) => (
          <option key={opt.value || opt.label} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      {error ? <p className="hr-add-candidate__error">{error}</p> : null}
    </div>
  );
}

function FormInput({ value, onChange, placeholder, type = "text", error }) {
  return (
    <div className="hr-add-candidate__field-control">
      <input
        className="hr-add-candidate__input"
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      {error ? <p className="hr-add-candidate__error">{error}</p> : null}
    </div>
  );
}

function DateField({ value, onChange }) {
  return (
    <div className="hr-add-candidate__field-control">
      <div className="hr-add-candidate__date-wrap">
        <span className={value ? "" : "is-placeholder"}>{value ? formatDisplayDate(value) : "Select Date of Joining"}</span>
        <CalendarDays className="h-4 w-4 shrink-0 text-[#9ca3af]" />
        <input type="date" value={value} onChange={(e) => onChange(e.target.value)} aria-label="Date of Joining" />
      </div>
    </div>
  );
}

export default function AddCandidate() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [gender, setGender] = useState("");
  const [designation, setDesignation] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [employmentType, setEmploymentType] = useState("");
  const [branch, setBranch] = useState("");
  const [department, setDepartment] = useState("");
  const [dateOfJoining, setDateOfJoining] = useState("");

  const validate = () => {
    const next = {};
    if (!firstName.trim()) next.firstName = "This field is required.";
    if (!lastName.trim()) next.lastName = "This field is required.";
    if (!gender) next.gender = "This field is required.";
    if (!designation) next.designation = "This field is required.";
    if (!email.trim()) next.email = "This field is required.";
    if (!mobile.trim()) next.mobile = "This field is required.";
    if (!employmentType) next.employmentType = "This field is required.";
    if (!branch) next.branch = "This field is required.";
    if (!department) next.department = "This field is required.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) {
      addToast("Please fill all required fields", "error");
      return;
    }

    const payload = {
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      gender,
      designation: DESIGNATION_OPTIONS.find((o) => o.value === designation)?.label || designation,
      email: email.trim(),
      mobile: mobile.trim(),
      employment_type: employmentType,
      branch,
      department,
      date_of_joining: dateOfJoining || null,
      stage: "offers",
      status: "Pending",
      archived: false,
    };

    setSaving(true);
    try {
      await createPreboardingCandidate(payload);
      addToast("Candidate added successfully", "success");
      navigate("/hr/recruitment");
    } catch {
      addToast("Failed to add candidate", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ListPageShell>
      <div className="hr-add-candidate min-w-0">
        <h1 className="hr-add-candidate__title">Add Candidate</h1>

        <div className="hr-add-candidate__grid">
          <div className="hr-add-candidate__card">
            <div className="hr-add-candidate__field">
              <label className="hr-add-candidate__field-label">First Name <span>*</span></label>
              <FormInput value={firstName} onChange={setFirstName} placeholder="Enter First name" error={errors.firstName} />
            </div>
            <div className="hr-add-candidate__field">
              <label className="hr-add-candidate__field-label">Last Name <span>*</span></label>
              <FormInput value={lastName} onChange={setLastName} placeholder="Enter Last name" error={errors.lastName} />
            </div>
            <div className="hr-add-candidate__field">
              <label className="hr-add-candidate__field-label">Gender <span>*</span></label>
              <FormSelect value={gender} onChange={setGender} options={GENDER_OPTIONS} error={errors.gender} />
            </div>
            <div className="hr-add-candidate__field">
              <label className="hr-add-candidate__field-label">Designation <span>*</span></label>
              <FormSelect value={designation} onChange={setDesignation} options={DESIGNATION_OPTIONS} error={errors.designation} />
            </div>
            <div className="hr-add-candidate__field">
              <label className="hr-add-candidate__field-label">Email <span>*</span></label>
              <FormInput value={email} onChange={setEmail} placeholder="Enter Email" type="email" error={errors.email} />
            </div>
            <div className="hr-add-candidate__field">
              <label className="hr-add-candidate__field-label">Mobile Number <span>*</span></label>
              <FormInput value={mobile} onChange={setMobile} placeholder="Enter Mobile Number" error={errors.mobile} />
            </div>
          </div>

          <div className="hr-add-candidate__card">
            <div className="hr-add-candidate__field">
              <label className="hr-add-candidate__field-label">Employment Type <span>*</span></label>
              <FormSelect value={employmentType} onChange={setEmploymentType} options={EMPLOYMENT_OPTIONS} error={errors.employmentType} />
            </div>
            <div className="hr-add-candidate__field">
              <label className="hr-add-candidate__field-label">Branch <span>*</span></label>
              <FormSelect value={branch} onChange={setBranch} options={BRANCH_OPTIONS} error={errors.branch} />
            </div>
            <div className="hr-add-candidate__field">
              <label className="hr-add-candidate__field-label">Department <span>*</span></label>
              <FormSelect value={department} onChange={setDepartment} options={DEPARTMENT_OPTIONS} error={errors.department} />
            </div>
            <div className="hr-add-candidate__field">
              <label className="hr-add-candidate__field-label">Date of Joining</label>
              <DateField value={dateOfJoining} onChange={setDateOfJoining} />
            </div>
          </div>
        </div>

        <div className="hr-add-candidate__actions">
          <button type="button" className="hr-add-candidate__save-btn" onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </ListPageShell>
  );
}
