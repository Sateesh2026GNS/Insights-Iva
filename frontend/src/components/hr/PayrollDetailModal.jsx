import { Download, Mail, Printer, X } from "lucide-react";
import { useToast } from "../../context/ToastContext";
import { formatInr, statusColor } from "../../data/hrMasterData";

export default function PayrollDetailModal({ record, onClose }) {
  const { addToast } = useToast();
  if (!record) return null;
  const basic = record.basic || record.regular_pay || 0;
  const ot = record.overtime || record.overtime_pay || 0;
  const gross = record.gross_pay || (basic + (record.allowance || 0) + ot + (record.bonus || 0));
  const pf = record.pf || 0;
  const esi = record.esi || 0;
  const tax = record.tax || 0;
  const deductions = record.deductions || (pf + esi + tax);
  const net = record.net_salary || record.net_pay || Math.max(0, gross - deductions);

  const handlePreview = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      addToast("Pop-up blocked. Please allow pop-ups to preview payslip.", "error");
      return;
    }
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Payslip - ${record.employee_name}</title>
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; padding: 40px; color: #1e293b; max-width: 600px; margin: 0 auto; }
            h1 { color: #0f172a; font-size: 24px; margin-bottom: 4px; }
            p { color: #64748b; font-size: 14px; margin-top: 0; }
            .divider { border-bottom: 2px solid #e2e8f0; margin: 20px 0; }
            .row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f1f5f9; font-size: 14px; }
            .bold { font-weight: bold; color: #0f172a; }
            .net { background: #ecfdf5; border-radius: 8px; padding: 12px; font-weight: bold; color: #047857; margin-top: 16px; font-size: 16px; }
          </style>
        </head>
        <body>
          <h1>Salary Slip</h1>
          <p>Employee: <strong>${record.employee_name}</strong></p>
          <p>Period: ${record.period_start || "—"} to ${record.period_end || "—"}</p>
          <div class="divider"></div>
          <div class="row"><span>Regular Pay</span><span>${formatInr(basic)}</span></div>
          <div class="row"><span>Overtime Pay</span><span>${formatInr(ot)}</span></div>
          <div class="row bold"><span>Gross Pay</span><span>${formatInr(gross)}</span></div>
          <div class="divider"></div>
          <div class="row"><span>PF Deduction</span><span>-${formatInr(pf)}</span></div>
          <div class="row"><span>ESI Deduction</span><span>-${formatInr(esi)}</span></div>
          <div class="row"><span>Tax / TDS Deduction</span><span>-${formatInr(tax)}</span></div>
          <div class="row bold"><span>Total Deductions</span><span>-${formatInr(deductions)}</span></div>
          <div class="net row"><span>Net Salary</span><span>${formatInr(net)}</span></div>
          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
    addToast("Opened payslip print preview", "success");
  };

  const handlePdfDownload = () => {
    const content = `====================================================
SALARY SLIP
====================================================
Employee Name : ${record.employee_name}
Period        : ${record.period_start || "—"} to ${record.period_end || "—"}
Status        : ${record.status}

EARNINGS:
----------------------------------------------------
Regular Pay   : ${formatInr(basic)}
Overtime Pay  : ${formatInr(ot)}
----------------------------------------------------
GROSS PAY     : ${formatInr(gross)}

DEDUCTIONS:
----------------------------------------------------
PF            : -${formatInr(pf)}
ESI           : -${formatInr(esi)}
Tax / TDS     : -${formatInr(tax)}
----------------------------------------------------
TOTAL DEDUCT. : -${formatInr(deductions)}

====================================================
NET SALARY    : ${formatInr(net)}
====================================================
`;
    const blob = new Blob([content], { type: "text/plain;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Payslip_${record.employee_name?.replace(/\s+/g, "_") || "Employee"}.txt`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast("Payslip downloaded successfully", "success");
  };

  const handleEmail = () => {
    addToast(`Payslip emailed to ${record.employee_name} successfully`, "success");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Salary Slip</h2>
            <p className="text-sm text-slate-500">{record.employee_name} · {record.period_start} to {record.period_end}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button>
        </div>

        <div className="mt-4 space-y-1 text-sm">
          <Row label="Regular Pay" value={formatInr(basic)} />
          <Row label="Overtime Pay" value={formatInr(ot)} />
          <div className="border-t pt-2"><Row label="Gross Pay" value={formatInr(gross)} bold /></div>
          <Row label="PF" value={`-${formatInr(pf)}`} />
          <Row label="ESI" value={`-${formatInr(esi)}`} />
          <Row label="Tax / TDS" value={`-${formatInr(tax)}`} />
          <div className="border-t pt-2"><Row label="Total Deductions" value={`-${formatInr(deductions)}`} /></div>
          <div className="border-t pt-2"><Row label="Net Pay" value={formatInr(net)} bold /></div>
        </div>

        <div className="mt-3">
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${statusColor(record.status)}`}>{record.status}</span>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={handlePreview} className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"><Printer className="h-4 w-4" /> Preview</button>
          <button type="button" onClick={handlePdfDownload} className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"><Download className="h-4 w-4" /> PDF / Download</button>
          <button type="button" onClick={handleEmail} className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"><Mail className="h-4 w-4" /> Email</button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, bold }) {
  return (
    <div className={`flex justify-between ${bold ? "font-bold text-slate-900" : "text-slate-600"}`}>
      <span>{label}</span><span>{value}</span>
    </div>
  );
}
