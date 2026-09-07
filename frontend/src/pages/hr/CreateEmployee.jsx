import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CalendarDays, Check, Plus, X } from "lucide-react";

import { ListPageShell } from "../../components/common/ListPageShell";
import { useToast } from "../../context/ToastContext";
import { createEmployee, getEmployeesEnriched } from "../../api/hrApi";
import "./createEmployeeOnboarding.css";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const GENDER_OPTIONS = ["", "male", "female", "other"];
const BLOOD_GROUPS = ["", "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const EMPLOYMENT_TYPES = ["", "permanent", "contract", "probation"];
const EMPLOYEE_STATUS = ["", "active", "inactive", "on_notice"];
const PAYMENT_MODES = ["", "cash", "bank_transfer", "cheque"];
const MANAGER_OPTIONS = ["", "none", "manager1"];

function formatDisplayDate(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return `${String(d.getDate()).padStart(2, "0")} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function Field({ label, required, children }) {
  return (
    <div className="hr-create-employee__field">
      <label className="hr-create-employee__label">{label}{required ? <span> *</span> : null}</label>
      {children}
    </div>
  );
}

function DateField({ value, onChange, placeholder }) {
  return (
    <div className="hr-create-employee__date-wrap">
      <span className={value ? "" : "is-placeholder"}>{value ? formatDisplayDate(value) : placeholder}</span>
      <CalendarDays className="h-4 w-4 shrink-0 text-[#9ca3af]" />
      <input type="date" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function WorkExperienceModal({ open, onClose, onSave }) {
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [responsibility, setResponsibility] = useState("");

  useEffect(() => {
    if (!open) return;
    setCompany("");
    setRole("");
    setStartDate("");
    setEndDate("");
    setResponsibility("");
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  if (!open) return null;

  const modal = (
    <div className="hr-create-employee__overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="hr-create-employee__modal" onClick={(e) => e.stopPropagation()}>
        <div className="hr-create-employee__modal-header">
          <h2 className="hr-create-employee__modal-title">Work Experience</h2>
          <button type="button" className="hr-create-employee__modal-close" onClick={onClose} aria-label="Close"><X className="h-5 w-5" /></button>
        </div>
        <div className="hr-create-employee__modal-body">
          <Field label="Company Name" required>
            <input className="hr-create-employee__input" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Enter Company Name" />
          </Field>
          <Field label="Role Name" required>
            <input className="hr-create-employee__input" value={role} onChange={(e) => setRole(e.target.value)} placeholder="Enter Role Name" />
          </Field>
          <div className="hr-create-employee__grid-2">
            <Field label="Start Date" required><DateField value={startDate} onChange={setStartDate} placeholder="01 Jan 2024" /></Field>
            <Field label="End Date" required><DateField value={endDate} onChange={setEndDate} placeholder="01 Jan 2024" /></Field>
          </div>
          <Field label="Responsibility" required>
            <div className="hr-create-employee__rte-toolbar">
              <button type="button" className="hr-create-employee__rte-btn">B</button>
              <button type="button" className="hr-create-employee__rte-btn"><em>I</em></button>
              <button type="button" className="hr-create-employee__rte-btn"><u>U</u></button>
              <button type="button" className="hr-create-employee__rte-btn">S</button>
            </div>
            <textarea className="hr-create-employee__textarea" value={responsibility} onChange={(e) => setResponsibility(e.target.value)} placeholder="Insert text here..." />
          </Field>
        </div>
        <div className="hr-create-employee__modal-footer">
          <button type="button" className="hr-create-employee__outline-btn" onClick={onClose}>Close</button>
          <button
            type="button"
            className="hr-create-employee__solid-btn"
            onClick={() => {
              if (!company || !role) return;
              onSave({ company, role, start_date: startDate, end_date: endDate, responsibility });
              onClose();
            }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

function emptyEducationRow() {
  return { id: `edu-${Date.now()}`, institute: "", specialization: "", degree: "", completion_date: "" };
}

export default function CreateEmployee() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get("id");
  const { addToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [workModalOpen, setWorkModalOpen] = useState(false);

  const [employeeCode, setEmployeeCode] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [fatherHusband, setFatherHusband] = useState("");
  const [nationality, setNationality] = useState("Indian");
  const [bloodGroup, setBloodGroup] = useState("");
  const [role, setRole] = useState("");
  const [department, setDepartment] = useState("");
  const [branch, setBranch] = useState("");
  const [designation, setDesignation] = useState("");
  const [employmentType, setEmploymentType] = useState("");
  const [employeeStatus, setEmployeeStatus] = useState("");
  const [sourceOfHire, setSourceOfHire] = useState("");
  const [dateOfJoining, setDateOfJoining] = useState("");
  const [currentExperience, setCurrentExperience] = useState("");
  const [expYears, setExpYears] = useState("");
  const [expMonths, setExpMonths] = useState("");
  const [probationDays, setProbationDays] = useState("");
  const [reportingManager, setReportingManager] = useState("none");
  const [secondaryManager, setSecondaryManager] = useState("none");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [maritalStatus, setMaritalStatus] = useState("");
  const [aboutMe, setAboutMe] = useState("");
  const [uan, setUan] = useState("");
  const [pan, setPan] = useState("");
  const [aadhaar, setAadhaar] = useState("");
  const [ipNumber, setIpNumber] = useState("");
  const [paymentMode, setPaymentMode] = useState("cash");
  const [accountNumber, setAccountNumber] = useState("");
  const [ifsc, setIfsc] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankBranch, setBankBranch] = useState("");
  const [beneficiaryCode, setBeneficiaryCode] = useState("");
  const [crnNumber, setCrnNumber] = useState("");
  const [workPhone, setWorkPhone] = useState("");
  const [personalMobile, setPersonalMobile] = useState("");
  const [emergencyContact, setEmergencyContact] = useState("");
  const [personalEmail, setPersonalEmail] = useState("");
  const [permanentAddress, setPermanentAddress] = useState("");
  const [localAddress, setLocalAddress] = useState("");
  const [workExperience, setWorkExperience] = useState([]);
  const [education, setEducation] = useState([emptyEducationRow()]);

  useEffect(() => {
    if (!editId) return;
    getEmployeesEnriched()
      .then((res) => {
        const rows = Array.isArray(res?.data) ? res.data : [];
        const row = rows.find((e) => String(e.id) === String(editId));
        if (!row) return;
        setEmployeeCode(row.employee_code || "");
        setFirstName(row.first_name || "");
        setLastName(row.last_name || "");
        setEmail(row.email || "");
        setDepartment(row.department || "");
        setBranch(row.branch || "");
        setDesignation(row.designation || "");
        setDateOfJoining(row.date_of_joining || row.hire_date || "");
      })
      .catch(() => {});
  }, [editId]);

  const buildPayload = () => ({
    id: editId || `emp-${Date.now()}`,
    employee_code: employeeCode.trim(),
    first_name: firstName.trim(),
    last_name: lastName.trim(),
    full_name: `${firstName.trim()} ${lastName.trim()}`.trim(),
    email: email.trim(),
    father_husband: fatherHusband,
    nationality,
    blood_group: bloodGroup,
    role,
    department,
    branch,
    designation,
    employment_type: employmentType,
    employee_status: employeeStatus,
    source_of_hire: sourceOfHire,
    date_of_joining: dateOfJoining,
    current_experience: currentExperience,
    exp_years: expYears,
    exp_months: expMonths,
    probation_days: probationDays,
    reporting_to: reportingManager === "none" ? "" : reportingManager,
    secondary_reporting_manager: secondaryManager === "none" ? "" : secondaryManager,
    date_of_birth: dateOfBirth,
    age,
    gender,
    marital_status: maritalStatus,
    about_me: aboutMe,
    uan,
    pan,
    aadhaar,
    ip_number: ipNumber,
    payment_mode: paymentMode,
    account_number: accountNumber,
    ifsc,
    bank_name: bankName,
    bank_branch: bankBranch,
    beneficiary_code: beneficiaryCode,
    crn_number: crnNumber,
    work_phone: workPhone,
    mobile: personalMobile,
    emergency_contact: emergencyContact,
    personal_email: personalEmail,
    permanent_address: permanentAddress,
    local_address: localAddress,
    work_experience: workExperience,
    education,
    created_by: null,
  });

  const handleSave = async () => {
    if (!employeeCode.trim() || !firstName.trim() || !lastName.trim() || !email.trim()) {
      addToast("Please fill required basic details", "error");
      return;
    }
    const payload = buildPayload();
    setSaving(true);
    try {
      await createEmployee({
        employee_code: payload.employee_code,
        full_name: payload.full_name,
        email: payload.email,
        department: payload.department,
        designation: payload.designation,
        hire_date: payload.date_of_joining,
        phone: payload.mobile,
        address: payload.permanent_address,
      });
      addToast("Employee saved successfully", "success");
      navigate("/hr/employees");
    } catch {
      addToast("Failed to save employee", "error");
    } finally {
      setSaving(false);
    }
  };

  const updateEducation = (id, field, value) => {
    setEducation((prev) => prev.map((row) => (row.id === id ? { ...row, [field]: value } : row)));
  };

  return (
    <ListPageShell>
      <div className="hr-create-employee min-w-0">
        <h1 className="hr-create-employee__title">Employee Onboarding</h1>

        <section className="hr-create-employee__section">
          <h2 className="hr-create-employee__section-title">Basic Detail</h2>
          <div className="hr-create-employee__grid-3">
            <Field label="Employee Code" required><input className="hr-create-employee__input" value={employeeCode} onChange={(e) => setEmployeeCode(e.target.value)} placeholder="Enter Employee code" /></Field>
            <Field label="First Name" required><input className="hr-create-employee__input" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Enter First name" /></Field>
            <Field label="Last Name" required><input className="hr-create-employee__input" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Enter Last name" /></Field>
            <Field label="Email Address" required><input className="hr-create-employee__input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Enter Email" /></Field>
            <Field label="Father/Husband"><input className="hr-create-employee__input" value={fatherHusband} onChange={(e) => setFatherHusband(e.target.value)} placeholder="Enter Father/Husband" /></Field>
            <Field label="Nationality">
              <select className="hr-create-employee__select" value={nationality} onChange={(e) => setNationality(e.target.value)}>
                <option value="Indian">Indian</option>
                <option value="Other">Other</option>
              </select>
            </Field>
            <Field label="Blood Group">
              <select className="hr-create-employee__select" value={bloodGroup} onChange={(e) => setBloodGroup(e.target.value)}>
                <option value="">Select Blood Group</option>
                {BLOOD_GROUPS.filter(Boolean).map((bg) => <option key={bg} value={bg}>{bg}</option>)}
              </select>
            </Field>
          </div>
        </section>

        <section className="hr-create-employee__section">
          <h2 className="hr-create-employee__section-title">Work Information</h2>
          <div className="hr-create-employee__grid-3">
            <Field label="Role" required>
              <select className="hr-create-employee__select" value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="">Select Role</option>
                <option value="admin">Admin</option>
                <option value="employee">Employee</option>
              </select>
            </Field>
            <Field label="Department" required>
              <select className="hr-create-employee__select" value={department} onChange={(e) => setDepartment(e.target.value)}>
                <option value="">Select Departments</option>
                <option value="hr">HR Department</option>
                <option value="production">Production</option>
                <option value="accounts">Accounts</option>
              </select>
            </Field>
            <Field label="Branch" required>
              <select className="hr-create-employee__select" value={branch} onChange={(e) => setBranch(e.target.value)}>
                <option value="">Select Branch</option>
                <option value="hq">Head Office</option>
                <option value="plant">Manufacturing Plant</option>
              </select>
            </Field>
            <Field label="Designation" required>
              <select className="hr-create-employee__select" value={designation} onChange={(e) => setDesignation(e.target.value)}>
                <option value="">Select Designation</option>
                <option value="HR Head">HR Head</option>
                <option value="Engineer">Engineer</option>
                <option value="Operator">Operator</option>
              </select>
            </Field>
            <Field label="Employment type" required>
              <select className="hr-create-employee__select" value={employmentType} onChange={(e) => setEmploymentType(e.target.value)}>
                <option value="">Employment type</option>
                {EMPLOYMENT_TYPES.filter(Boolean).map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Employee Status" required>
              <select className="hr-create-employee__select" value={employeeStatus} onChange={(e) => setEmployeeStatus(e.target.value)}>
                <option value="">Select Employee Status</option>
                {EMPLOYEE_STATUS.filter(Boolean).map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Source of Hire">
              <select className="hr-create-employee__select" value={sourceOfHire} onChange={(e) => setSourceOfHire(e.target.value)}>
                <option value="">Source of Hire</option>
                <option value="referral">Referral</option>
                <option value="portal">Job Portal</option>
              </select>
            </Field>
            <Field label="Date of Joining" required><DateField value={dateOfJoining} onChange={setDateOfJoining} placeholder="Select Date of Joining" /></Field>
            <Field label="Current Experience"><input className="hr-create-employee__input" value={currentExperience} onChange={(e) => setCurrentExperience(e.target.value)} placeholder="---" /></Field>
            <Field label="Total Experience">
              <div className="hr-create-employee__grid-2" style={{ gap: 8 }}>
                <select className="hr-create-employee__select" value={expYears} onChange={(e) => setExpYears(e.target.value)}><option value="">Year</option>{Array.from({ length: 30 }, (_, i) => <option key={i} value={i}>{i}</option>)}</select>
                <select className="hr-create-employee__select" value={expMonths} onChange={(e) => setExpMonths(e.target.value)}><option value="">Month</option>{Array.from({ length: 12 }, (_, i) => <option key={i} value={i}>{i}</option>)}</select>
              </div>
            </Field>
            <Field label="Probation Duration">
              <div className="hr-create-employee__suffix-group">
                <input className="hr-create-employee__input" value={probationDays} onChange={(e) => setProbationDays(e.target.value)} placeholder="Enter Probation Duration" />
                <span className="hr-create-employee__suffix">Days</span>
              </div>
            </Field>
          </div>
        </section>

        <section className="hr-create-employee__section">
          <h2 className="hr-create-employee__section-title">Hierarchy Information</h2>
          <div className="hr-create-employee__grid-2">
            <Field label="Reporting Manager">
              <select className="hr-create-employee__select" value={reportingManager} onChange={(e) => setReportingManager(e.target.value)}>
                <option value="none">No Reporting Manager</option>
              </select>
            </Field>
            <Field label="Secondary Reporting Manager">
              <select className="hr-create-employee__select" value={secondaryManager} onChange={(e) => setSecondaryManager(e.target.value)}>
                <option value="none">No Reporting Manager</option>
              </select>
            </Field>
          </div>
        </section>

        <section className="hr-create-employee__section">
          <h2 className="hr-create-employee__section-title">Personal Details</h2>
          <div className="hr-create-employee__grid-3">
            <Field label="Date of birth" required><DateField value={dateOfBirth} onChange={setDateOfBirth} placeholder="Select Date of birth" /></Field>
            <Field label="Age"><input className="hr-create-employee__input" value={age} onChange={(e) => setAge(e.target.value)} placeholder="Age" /></Field>
            <Field label="Gender" required>
              <select className="hr-create-employee__select" value={gender} onChange={(e) => setGender(e.target.value)}>
                <option value="">Select Gender</option>
                {GENDER_OPTIONS.filter(Boolean).map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </Field>
            <Field label="Marital Status">
              <select className="hr-create-employee__select" value={maritalStatus} onChange={(e) => setMaritalStatus(e.target.value)}>
                <option value="">Select Marital Status</option>
                <option value="single">Single</option>
                <option value="married">Married</option>
              </select>
            </Field>
            <div className="hr-create-employee__field" style={{ gridColumn: "span 2" }}>
              <label className="hr-create-employee__label">About me</label>
              <textarea className="hr-create-employee__textarea" value={aboutMe} onChange={(e) => setAboutMe(e.target.value)} placeholder="About me" />
            </div>
          </div>
        </section>

        <section className="hr-create-employee__section">
          <h2 className="hr-create-employee__section-title">Identity Information</h2>
          <div className="hr-create-employee__grid-3">
            <Field label="UAN"><input className="hr-create-employee__input" value={uan} onChange={(e) => setUan(e.target.value)} placeholder="Enter UAN" /></Field>
            <Field label="PAN"><input className="hr-create-employee__input" value={pan} onChange={(e) => setPan(e.target.value)} placeholder="Enter PAN" /></Field>
            <Field label="Aadhaar"><input className="hr-create-employee__input" value={aadhaar} onChange={(e) => setAadhaar(e.target.value)} placeholder="Enter Aadhaar Number" /></Field>
            <Field label="IP Number"><input className="hr-create-employee__input" value={ipNumber} onChange={(e) => setIpNumber(e.target.value)} placeholder="Enter IP Number" /></Field>
          </div>
        </section>

        <section className="hr-create-employee__section">
          <h2 className="hr-create-employee__section-title">Bank Detail</h2>
          <div className="hr-create-employee__grid-3">
            <Field label="Payment Mode">
              <select className="hr-create-employee__select" value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)}>
                {PAYMENT_MODES.filter(Boolean).map((m) => <option key={m} value={m}>{m === "bank_transfer" ? "Bank Transfer" : m.charAt(0).toUpperCase() + m.slice(1)}</option>)}
              </select>
            </Field>
            <Field label="Account Number"><input className="hr-create-employee__input" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} placeholder="Enter Account Number" /></Field>
            <Field label="IFSC Code"><input className="hr-create-employee__input" value={ifsc} onChange={(e) => setIfsc(e.target.value)} placeholder="Enter IFSC Code" /></Field>
            <Field label="Bank Name"><input className="hr-create-employee__input" value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="Enter Bank Name" /></Field>
            <Field label="Branch Name"><input className="hr-create-employee__input" value={bankBranch} onChange={(e) => setBankBranch(e.target.value)} placeholder="Enter Branch Name" /></Field>
            <Field label="Beneficiary Code"><input className="hr-create-employee__input" value={beneficiaryCode} onChange={(e) => setBeneficiaryCode(e.target.value)} placeholder="Enter Beneficiary Code" /></Field>
            <Field label="CRN Number"><input className="hr-create-employee__input" value={crnNumber} onChange={(e) => setCrnNumber(e.target.value)} placeholder="Enter CRN Number" /></Field>
          </div>
        </section>

        <section className="hr-create-employee__section">
          <h2 className="hr-create-employee__section-title">Contact Details</h2>
          <div className="hr-create-employee__grid-3">
            <Field label="Work Phone Number"><input className="hr-create-employee__input" value={workPhone} onChange={(e) => setWorkPhone(e.target.value)} placeholder="Enter Work Phone Number" /></Field>
            <Field label="Personal Mobile Number" required><input className="hr-create-employee__input" value={personalMobile} onChange={(e) => setPersonalMobile(e.target.value)} placeholder="Enter Personal Mobile Number" /></Field>
            <Field label="Contact Person - In case of emergency" required><input className="hr-create-employee__input" value={emergencyContact} onChange={(e) => setEmergencyContact(e.target.value)} placeholder="Enter Emergency Number" /></Field>
            <Field label="Personal Email Address"><input className="hr-create-employee__input" type="email" value={personalEmail} onChange={(e) => setPersonalEmail(e.target.value)} placeholder="Enter Personal Email Address" /></Field>
            <Field label="Permanent Address" required><textarea className="hr-create-employee__textarea" value={permanentAddress} onChange={(e) => setPermanentAddress(e.target.value)} placeholder="Enter Permanent Address" /></Field>
            <Field label="Local Residential Address"><textarea className="hr-create-employee__textarea" value={localAddress} onChange={(e) => setLocalAddress(e.target.value)} placeholder="Enter Local Residential Address" /></Field>
          </div>
        </section>

        <section className="hr-create-employee__section">
          <div className="hr-create-employee__section-header">
            <h2>Work Experience</h2>
            <button type="button" className="hr-create-employee__add-icon-btn" onClick={() => setWorkModalOpen(true)} aria-label="Add work experience"><Plus className="h-4 w-4" /></button>
          </div>
          <div className="hr-create-employee__experience-list">
            {workExperience.length === 0 ? <p className="text-sm text-[#5e6278]">No work experience added yet.</p> : workExperience.map((item, i) => (
              <div key={i} className="hr-create-employee__experience-item">
                <span>{item.company} — {item.role}</span>
                <button type="button" className="text-[#dc2626]" onClick={() => setWorkExperience((prev) => prev.filter((_, idx) => idx !== i))}>Remove</button>
              </div>
            ))}
          </div>
        </section>

        <section className="hr-create-employee__section">
          <div className="hr-create-employee__section-header">
            <h2>Education Details</h2>
          </div>
          <div className="hr-create-employee__edu-table-wrap">
            <table className="hr-create-employee__edu-table">
              <thead>
                <tr>
                  <th>SR No.</th>
                  <th>Institute Name</th>
                  <th>Specialization</th>
                  <th>Degree</th>
                  <th>Date of Completion</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {education.map((row, index) => (
                  <tr key={row.id}>
                    <td>{index + 1}</td>
                    <td><input className="hr-create-employee__input" value={row.institute} onChange={(e) => updateEducation(row.id, "institute", e.target.value)} placeholder="Enter Institute name" /></td>
                    <td><input className="hr-create-employee__input" value={row.specialization} onChange={(e) => updateEducation(row.id, "specialization", e.target.value)} placeholder="Enter specialization" /></td>
                    <td><input className="hr-create-employee__input" value={row.degree} onChange={(e) => updateEducation(row.id, "degree", e.target.value)} placeholder="Enter degree" /></td>
                    <td><DateField value={row.completion_date} onChange={(v) => updateEducation(row.id, "completion_date", v)} placeholder="Select Month" /></td>
                    <td>
                      <div className="hr-create-employee__edu-actions">
                        {education.length > 1 ? (
                          <button type="button" className="hr-create-employee__edu-action-btn hr-create-employee__edu-action-btn--remove" onClick={() => setEducation((prev) => prev.filter((r) => r.id !== row.id))} aria-label="Remove row"><X className="h-3.5 w-3.5" /></button>
                        ) : null}
                        <button type="button" className="hr-create-employee__edu-action-btn hr-create-employee__edu-action-btn--save" aria-label="Confirm row"><Check className="h-3.5 w-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="hr-create-employee__edu-add-row">
            <button type="button" className="hr-create-employee__edu-action-btn hr-create-employee__edu-action-btn--add" onClick={() => setEducation((prev) => [...prev, emptyEducationRow()])} aria-label="Add education row"><Plus className="h-4 w-4" /></button>
          </div>
        </section>

        <div className="hr-create-employee__footer">
          <button type="button" className="hr-create-employee__cancel-btn" onClick={() => navigate("/hr/employees")}>Cancel</button>
          <button type="button" className="hr-create-employee__save-btn" onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Save"}</button>
        </div>

        <WorkExperienceModal
          open={workModalOpen}
          onClose={() => setWorkModalOpen(false)}
          onSave={(item) => setWorkExperience((prev) => [...prev, item])}
        />
      </div>
    </ListPageShell>
  );
}
