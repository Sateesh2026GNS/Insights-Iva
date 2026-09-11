import { createPortal } from "react-dom";
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

  const breakdown = record.breakdown;
  const earningsList = breakdown?.earnings?.length
    ? breakdown.earnings
    : [
        { name: "Regular / Basic Pay", amount: basic || (gross ? gross * 0.5 : 0) },
        { name: "Overtime Pay", amount: ot },
        { name: "Allowances", amount: record.allowance || (gross ? gross * 0.5 : 0) },
      ].filter((item) => item.amount > 0 || item.name.includes("Basic"));

  const deductionsList = breakdown?.deductions?.length
    ? breakdown.deductions
    : [
        { name: "Provident Fund (PF)", amount: pf },
        { name: "ESIC", amount: esi },
        { name: "Tax / TDS", amount: tax },
      ].filter((item) => item.amount > 0);

  const handlePreview = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      addToast("Pop-up blocked. Please allow pop-ups to preview payslip.", "error");
      return;
    }
    const earningsHtml = earningsList.map(e => `<div class="row"><span>${e.name}</span><span>${formatInr(e.amount)}</span></div>`).join("");
    const deductionsHtml = deductionsList.length > 0
      ? deductionsList.map(d => `<div class="row"><span>${d.name}</span><span>-${formatInr(d.amount)}</span></div>`).join("")
      : `<div class="row"><span>No deductions</span><span>₹ 0.00</span></div>`;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Payslip - ${record.employee_name || "Employee"}</title>
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; padding: 40px; color: #1e293b; max-width: 600px; margin: 0 auto; }
            h1 { color: #0f172a; font-size: 24px; margin-bottom: 4px; }
            p { color: #64748b; font-size: 14px; margin-top: 0; }
            h3 { font-size: 14px; text-transform: uppercase; color: #475569; margin-top: 16px; margin-bottom: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
            .divider { border-bottom: 2px solid #e2e8f0; margin: 16px 0; }
            .row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #f1f5f9; font-size: 14px; }
            .bold { font-weight: bold; color: #0f172a; }
            .net { background: #ecfdf5; border-radius: 8px; padding: 12px; font-weight: bold; color: #047857; margin-top: 16px; font-size: 16px; }
          </style>
        </head>
        <body>
          <h1>Salary Slip</h1>
          <p>Employee: <strong>${record.employee_name || "Employee"}</strong> (${record.employee_code || "—"})</p>
          <p>Department: ${record.department || "General"} | Period: ${record.period_start || record.month_label || "—"} to ${record.period_end || "—"}</p>
          <div class="divider"></div>
          <h3>Earnings</h3>
          ${earningsHtml}
          <div class="row bold"><span>Gross Earnings</span><span>${formatInr(gross)}</span></div>
          <h3>Deductions</h3>
          ${deductionsHtml}
          <div class="row bold"><span>Total Deductions</span><span>-${formatInr(deductions)}</span></div>
          <div class="net row"><span>Net Salary Payable</span><span>${formatInr(net)}</span></div>
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
Employee Name : ${record.employee_name || "Employee"}
Employee Code : ${record.employee_code || "—"}
Department    : ${record.department || "General"}
Period        : ${record.period_start || record.month_label || "—"} to ${record.period_end || "—"}
Status        : ${record.status || "generated"}

EARNINGS:
----------------------------------------------------
${earningsList.map(e => `${e.name.padEnd(20)} : ${formatInr(e.amount)}`).join("\n")}
----------------------------------------------------
GROSS PAY     : ${formatInr(gross)}

DEDUCTIONS:
----------------------------------------------------
${deductionsList.length > 0 ? deductionsList.map(d => `${d.name.padEnd(20)} : -${formatInr(d.amount)}`).join("\n") : "None"}
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
    addToast(`Payslip emailed to ${record.employee_name || "employee"} successfully`, "success");
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 overflow-y-auto" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Salary Slip</h2>
            <p className="text-sm text-slate-500">{record.employee_name || "Employee"} · {record.period_start || record.month_label || "—"} to {record.period_end || "—"}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button>
        </div>

        <div className="mt-4 space-y-3 text-sm">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Earnings Breakdown</h3>
            <div className="space-y-1">
              {earningsList.map((e, idx) => (
                <Row key={idx} label={e.name} value={formatInr(e.amount)} />
              ))}
              <div className="border-t pt-1"><Row label="Gross Pay" value={formatInr(gross)} bold /></div>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Deductions</h3>
            <div className="space-y-1">
              {deductionsList.length > 0 ? (
                deductionsList.map((d, idx) => (
                  <Row key={idx} label={d.name} value={`-${formatInr(d.amount)}`} />
                ))
              ) : (
                <div className="text-xs text-slate-400 py-1">No deductions applied</div>
              )}
              <div className="border-t pt-1"><Row label="Total Deductions" value={`-${formatInr(deductions)}`} bold /></div>
            </div>
          </div>

          <div className="border-t pt-2 bg-emerald-50/70 p-2.5 rounded-xl">
            <Row label="Net Salary Payable" value={formatInr(net)} bold />
          </div>
        </div>

        <div className="mt-3">
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${statusColor(record.status || "processed")}`}>{record.status || "processed"}</span>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={handlePreview} className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"><Printer className="h-4 w-4" /> Preview</button>
          <button type="button" onClick={handlePdfDownload} className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"><Download className="h-4 w-4" /> PDF / Download</button>
          <button type="button" onClick={handleEmail} className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"><Mail className="h-4 w-4" /> Email</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function Row({ label, value, bold }) {
  return (
    <div className={`flex justify-between ${bold ? "font-bold text-slate-900" : "text-slate-600"}`}>
      <span>{label}</span><span>{value}</span>
    </div>
  );
}
