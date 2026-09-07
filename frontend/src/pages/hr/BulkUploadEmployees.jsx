import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Download } from "lucide-react";

import { ListPageShell } from "../../components/common/ListPageShell";
import { useToast } from "../../context/ToastContext";
import "./bulkUploadEmployees.css";

const STEPS = ["Step 1", "Step 2", "Step 3"];

export default function BulkUploadEmployees() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const fileRef = useRef(null);
  const [activeStep, setActiveStep] = useState(0);

  const handleTemplate = () => {
    addToast("Excel template download started", "info");
  };

  const handleUpload = () => {
    fileRef.current?.click();
  };

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    addToast(`Uploaded ${file.name}`, "success");
    if (activeStep < STEPS.length - 1) setActiveStep((s) => s + 1);
    e.target.value = "";
  };

  return (
    <ListPageShell>
      <div className="hr-bulk-upload min-w-0">
        <div className="hr-bulk-upload__top">
          <div className="hr-bulk-upload__title-row">
            <button type="button" className="hr-bulk-upload__back" onClick={() => navigate("/hr/employees")} aria-label="Back">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h1 className="hr-bulk-upload__title">Bulk Upload</h1>
          </div>
          <button type="button" className="hr-bulk-upload__template-btn" onClick={handleTemplate}>
            <Download className="h-4 w-4" />
            Excel Template
          </button>
        </div>

        <div className="hr-bulk-upload__stepper">
          {STEPS.map((label, index) => (
            <div key={label} style={{ display: "contents" }}>
              <div className="hr-bulk-upload__step-item">
                <span className={`hr-bulk-upload__step-dot ${index === activeStep ? "hr-bulk-upload__step-dot--active" : ""}`}>
                  {index + 1}
                </span>
                <span className={`hr-bulk-upload__step-label ${index === activeStep ? "hr-bulk-upload__step-label--active" : ""}`}>{label}</span>
              </div>
              {index < STEPS.length - 1 ? <div className="hr-bulk-upload__step-line" aria-hidden /> : null}
            </div>
          ))}
        </div>

        <div className="hr-bulk-upload__dropzone">
          <div className="hr-bulk-upload__excel-icon" aria-hidden>📊</div>
          <p>Upload excel with users data here</p>
          <button type="button" className="hr-bulk-upload__upload-btn" onClick={handleUpload}>Upload</button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hr-bulk-upload__hidden-input" onChange={handleFile} />
        </div>
      </div>
    </ListPageShell>
  );
}
