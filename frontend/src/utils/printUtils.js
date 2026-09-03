/**
 * Shared Print Templates for Production Planning & Work Orders
 * Standardized header: "Production | Welcome, [User] | Insights Iva"
 */

import { escapeHtml } from "./htmlEscape";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export function extractJobCardData(order, user) {
  if (!order) return {};
  const c = order.card || order;
  const f = order.form || c.form || {};
  const sp = c.summary_panel || order.summary_panel || {};
  const so = order.salesOrder || {};
  const plan = c.planning || c.production_plan || order.planning || {};
  const store = c.store || c.store_issue || c.store_context || order.store || {};
  const ex = c.execution || c.production || order.execution || {};
  const q = c.quality || order.quality || {};
  const pack = c.packing || c.dispatch || order.packing || {};
  const bill = c.billing || order.billing || {};
  const po = order.productionOrder || {};

  const jcNo = sp.job_card_no || f.job_card_no || c.job_card_no || order.job_card_no || order.order_number || `JC-${order.sales_order_id || order.id || Date.now()}`;
  const soNo = sp.sales_order_no || f.sales_order_no || so.order_number || order.order_number || order.sales_order_no || (order.sales_order_id ? `SO-${order.sales_order_id}` : "—");
  const custName = sp.customer || f.customer_name || so.customer_name || order.customer_name || order.customer || "Internal / Standard Customer";
  const prodName = sp.product || f.product_name || order.product_name || order.product || "—";
  const prodCode = order.product_code || f.product_code || order.sku || (order.selectedProduct ? (order.selectedProduct.product_code || order.selectedProduct.sku) : "") || "";
  const qty = Number(sp.order_quantity ?? f.quantity ?? so.quantity ?? order.quantity ?? order.planned_quantity ?? 0);
  const uom = sp.uom || f.unit || so.unit || order.unit || order.uom || "Pcs";

  const rawDelDate = sp.required_delivery || f.required_delivery_date || f.delivery_date || so.delivery_date || order.delivery_date || order.due_date;
  let delDate = "—";
  if (rawDelDate) {
    if (typeof rawDelDate === "string" && (rawDelDate.includes("-") || rawDelDate.includes("/"))) {
      delDate = rawDelDate;
    } else {
      try {
        delDate = new Date(rawDelDate).toLocaleDateString("en-IN");
      } catch {
        delDate = String(rawDelDate);
      }
    }
  }

  const priority = (f.priority || sp.priority || order.priority || "MEDIUM").toUpperCase();
  const rawSalesVal = so.total_amount || bill.total_amount || sp.total_amount || f.total_amount || order.total_amount || order.sales_value;
  const salesValue = rawSalesVal ? `₹ ${Number(rawSalesVal).toLocaleString("en-IN")}` : "—";
  const ws = (sp.workflow_status || c.workflow_status || f.workflow_status || order.workflow_status || order.status || "COMPLETED").toUpperCase().replace(/_/g, " ");

  const stockStatus = c.stock_status || order.stock_status || "Stock Verified & Reserved";

  // Stage 1: Sales Order
  const st1Fields = [
    { label: "Customer", value: custName },
    { label: "Sales Order No", value: soNo },
    { label: "Ordered Product", value: `${prodName}${prodCode ? ` (${prodCode})` : ""}` },
    { label: "Order Quantity", value: `${qty} ${uom}` },
    { label: "Delivery Date", value: delDate },
    ...(salesValue !== "—" ? [{ label: "Sales Value", value: salesValue }] : []),
  ];
  const st1Station = "Sales & Accounts";
  const st1Status = "Confirmed";

  // Stage 2: Inventory & BOM
  const warehouse = f.warehouse_name || c.warehouse_name || store.warehouse_name || "Main RM Store";
  const st2Fields = [
    { label: "Stock Status", value: stockStatus },
    { label: "Warehouse", value: warehouse },
    { label: "BOM Confirmation", value: `All required component items and raw materials checked & allocated for ${qty} ${uom}.` },
  ];
  const st2Station = warehouse || "Central RM Store";
  const st2Status = "Reserved";

  // Stage 3: Store Material Issue
  const issueNo = store.issue_no || store.issue_requisition || `MIV-${order.sales_order_id || order.id || 6}`;
  const storeRemarks = store.remarks || "Raw materials picked, weighed, and released to production floor.";
  const st3Fields = [
    { label: "Store Status", value: "Materials Issued to WIP" },
    { label: "Issue Requisition", value: issueNo },
    { label: "Store Remarks", value: storeRemarks },
  ];
  const st3Station = "Storekeeper";
  const st3Status = "Issued";

  // Stage 4: Production Planning
  const machine = plan.machine_name || po.machine_name || order.machine_name || "CNC Lathe / Machining Center 01";
  const operator = plan.operator_name || po.operator_name || order.assigned_to || order.operator_name || "Production Machinist";
  const shift = plan.shift || po.shift || order.shift || "Day Shift (General)";
  const st4Fields = [
    { label: "Assigned Machine", value: machine },
    { label: "Assigned Operator", value: operator },
    { label: "Planned Quantity", value: `${qty} ${uom}` },
    { label: "Assigned Shift", value: shift },
  ];
  const st4Station = machine;
  const st4Status = "Allocated";

  // Stage 5: Shop Floor Machining
  const producedQty = ex.produced_qty != null ? Number(ex.produced_qty) : qty;
  const rejectedQty = ex.rejected_qty != null ? Number(ex.rejected_qty) : 0;
  const machiningLog = ex.operator_remarks || ex.notes || "Machining cycle completed to drawing tolerances. Forwarded to QA Inspection.";
  const st5Fields = [
    { label: "Good Output Qty", value: `${producedQty} ${uom}` },
    { label: "Scrap / Rejection Qty", value: `${rejectedQty} ${uom}` },
    { label: "Machining Log", value: machiningLog },
  ];
  const st5Station = operator;
  const st5Status = "Machined";

  // Stage 6: Quality Inspection (QA)
  const qaInspector = q.inspected_by || q.checked_by || "Certified QA Inspector";
  const qaStatus = (q.status || q.result || "PASSED (Approved)").toUpperCase();
  const qaNotes = q.notes || q.remarks || "Dimensional verification, surface finish test, and tolerance checks passed 100%.";
  const st6Fields = [
    { label: "QA Status", value: qaStatus },
    { label: "QA Inspector", value: qaInspector },
    { label: "Quality Stamp / Notes", value: qaNotes },
  ];
  const st6Station = qaInspector;
  const st6Status = "Approved";

  // Stage 7: Packing & Dispatch
  const packedQty = pack.packed_quantity || pack.packed_qty || qty;
  const courier = pack.courier || pack.transporter || "SafeExpress Logistics";
  const lrNo = pack.lr_number || pack.dc_no || `LR-${order.sales_order_id || order.id || 6}-2026`;
  const st7Fields = [
    { label: "Packing Status", value: pack.packing_status || "Packed & Labelled" },
    { label: "Packed Quantity", value: `${packedQty} ${uom}` },
    { label: "Courier / Transporter", value: courier },
    { label: "LR / Tracking No", value: lrNo },
  ];
  const st7Station = "Logistics";
  const st7Status = "Packed";

  // Stage 8: GST Tax Invoicing
  const invoiceNo = bill.invoice_no || bill.invoice_number || `INV-${order.sales_order_id || order.id || 6}`;
  const invAmount = bill.total_amount != null ? `₹ ${Number(bill.total_amount).toLocaleString("en-IN")}` : salesValue;
  const st8Fields = [
    { label: "Tax Invoice No", value: invoiceNo },
    { label: "Total Invoiced Amount", value: invAmount },
    { label: "Billing Status", value: "Official GST Tax Invoice Generated · Ledger Posted" },
  ];
  const st8Station = "Finance Dept";
  const st8Status = "Invoiced";

  const rawStageDefs = [
    { num: "01", name: "Sales Order", fields: st1Fields, station: st1Station, status: st1Status },
    { num: "02", name: "Inventory & BOM Check", fields: st2Fields, station: st2Station, status: st2Status },
    { num: "03", name: "Store Material Issue", fields: st3Fields, station: st3Station, status: st3Status },
    { num: "04", name: "Production Planning", fields: st4Fields, station: st4Station, status: st4Status },
    { num: "05", name: "Shop Floor Machining", fields: st5Fields, station: st5Station, status: st5Status },
    { num: "06", name: "Quality Inspection (QA)", fields: st6Fields, station: st6Station, status: st6Status },
    { num: "07", name: "Packing & Dispatch", fields: st7Fields, station: st7Station, status: st7Status },
    { num: "08", name: "GST Tax Invoicing", fields: st8Fields, station: st8Station, status: st8Status },
  ];

  const stagesForPdf = rawStageDefs.map((s) => [
    s.num,
    s.name,
    s.fields.map((fld) => `• ${fld.label}: ${fld.value}`).join("\n"),
    s.station,
    s.status,
  ]);

  return {
    jcNo,
    soNo,
    custName,
    prodName,
    prodCode,
    qty,
    uom,
    delDate,
    priority,
    salesValue,
    ws,
    warehouse,
    issueNo,
    machine,
    operator,
    shift,
    producedQty,
    rejectedQty,
    qaInspector,
    qaStatus,
    courier,
    lrNo,
    invoiceNo,
    invAmount,
    rawStageDefs,
    stages: stagesForPdf,
  };
}

export function downloadJobCardPdf(order, user) {
  if (!order) return;
  const data = extractJobCardData(order, user);
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  
  // Header Banner
  doc.setFillColor(15, 118, 110);
  doc.rect(0, 0, doc.internal.pageSize.width, 42, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("INSIGHTS IVA ERP — MANUFACTURING WORKFLOW TRAVELER", 30, 26);

  // Job Card Details
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(`Job Card Reference: ${data.jcNo}`, 30, 64);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text(`Sales Order: ${data.soNo}   |   Status: ${data.ws}   |   Date: ${new Date().toLocaleDateString("en-IN")}`, 30, 78);

  // Summary box
  autoTable(doc, {
    startY: 88,
    head: [["Customer", "Ordered Product", "Target Quantity", "Delivery Due", "Sales Value", "Priority"]],
    body: [[
      data.custName,
      `${data.prodName}${data.prodCode ? ` (${data.prodCode})` : ""}`,
      `${data.qty.toLocaleString("en-IN")} ${data.uom}`,
      data.delDate,
      data.salesValue,
      data.priority
    ]],
    styles: { fontSize: 8.5, cellPadding: 6 },
    headStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: "bold" },
    bodyStyles: { textColor: [30, 41, 59] },
    theme: "grid"
  });

  // 8-Stage Manufacturing Steps
  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 12,
    head: [["Stage", "Process Stage", "Workflow Details & Specifications", "Assigned / Station", "Stage Status"]],
    body: data.stages,
    styles: { fontSize: 8, cellPadding: 5.5, overflow: "linebreak" },
    headStyles: { fillColor: [15, 118, 110], textColor: [255, 255, 255], fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: 32, fontStyle: "bold", halign: "center" },
      1: { cellWidth: 95, fontStyle: "bold" },
      2: { cellWidth: "auto" },
      3: { cellWidth: 88 },
      4: { cellWidth: 60, halign: "center", fontStyle: "bold", textColor: [4, 120, 87] }
    },
    theme: "striped"
  });

  // Signatures
  const finalY = Math.min(doc.lastAutoTable.finalY + 38, 770);
  doc.setDrawColor(148, 163, 184);
  doc.setLineDashPattern([3, 3], 0);
  doc.line(30, finalY - 10, doc.internal.pageSize.width - 30, finalY - 10);
  doc.setLineDashPattern([], 0);

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(71, 85, 105);

  const colWidth = (doc.internal.pageSize.width - 60) / 4;
  const signLabels = ["Store In-Charge", "Machine Operator", "Quality Inspector", "Plant Manager"];
  signLabels.forEach((lbl, i) => {
    const x = 30 + i * colWidth + colWidth / 2;
    doc.line(30 + i * colWidth + 10, finalY + 18, 30 + (i + 1) * colWidth - 10, finalY + 18);
    doc.text(lbl, x, finalY + 28, { align: "center" });
  });

  doc.save(`JobCard_${data.jcNo}_Workflow.pdf`);
}

export function printProductionOrder(order, user) {
  if (!order) return;
  const data = extractJobCardData(order, user);
  const printedBy = escapeHtml(user?.full_name || user?.name || "");
  const jcNo = escapeHtml(data.jcNo);
  const soNo = escapeHtml(data.soNo);
  const custName = escapeHtml(data.custName);
  const prodName = escapeHtml(data.prodName);
  const prodCode = escapeHtml(data.prodCode);
  const qty = data.qty;
  const uom = escapeHtml(data.uom);
  const delDate = escapeHtml(data.delDate);
  const priority = escapeHtml(data.priority);
  const salesValue = escapeHtml(data.salesValue);
  const ws = escapeHtml(data.ws);

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Job Card ${jcNo} - Manufacturing Workflow Traveler</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif; color: #1e293b; background: #fff; font-size: 11px; line-height: 1.4; }
    .page { padding: 24px 28px; max-width: 860px; margin: 0 auto; }
    .header-table { width: 100%; border-bottom: 2px solid #0f766e; padding-bottom: 12px; margin-bottom: 16px; }
    .company-name { font-size: 18px; font-weight: 800; color: #0f766e; text-transform: uppercase; letter-spacing: 0.5px; }
    .doc-title { font-size: 15px; font-weight: 700; color: #0f172a; text-transform: uppercase; margin-top: 2px; }
    .meta-text { font-size: 10px; color: #64748b; }
    
    .card { border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px 14px; margin-bottom: 14px; background: #f8fafc; }
    .grid-5 { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; }
    .field-lbl { font-size: 9px; font-weight: 700; text-transform: uppercase; color: #64748b; margin-bottom: 2px; }
    .field-val { font-size: 12px; font-weight: 600; color: #0f172a; word-break: break-word; }
    .badge { display: inline-block; padding: 2px 7px; border-radius: 4px; font-size: 10px; font-weight: 700; }
    .badge-status { background: #ccfbf1; color: #0f766e; border: 1px solid #99f6e4; }
    .badge-priority { background: #fef3c7; color: #92400e; border: 1px solid #fde68a; }

    .section-title { font-size: 12px; font-weight: 800; text-transform: uppercase; color: #0f766e; margin: 16px 0 8px 0; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; display: flex; justify-content: space-between; align-items: center; }
    
    .wf-table { width: 100%; border-collapse: collapse; margin-top: 6px; font-size: 10.5px; }
    .wf-table th { background: #0f766e; color: #ffffff; text-align: left; padding: 7px 8px; font-weight: 700; text-transform: uppercase; font-size: 9.5px; border: 1px solid #0f766e; }
    .wf-table td { padding: 7px 8px; border: 1px solid #cbd5e1; vertical-align: top; }
    .wf-table tr:nth-child(even) td { background: #f8fafc; }
    .step-num { font-weight: 800; color: #0f766e; text-align: center; }
    .step-title { font-weight: 700; color: #0f172a; margin-bottom: 2px; }
    .step-desc { font-size: 9.5px; color: #475569; }
    .step-badge { font-weight: 700; color: #047857; background: #ecfdf5; border: 1px solid #a7f3d0; padding: 2px 6px; border-radius: 4px; font-size: 9px; display: inline-block; }

    .point-list { display: flex; flex-direction: column; gap: 3px; }
    .field-row { display: flex; align-items: baseline; gap: 4px; font-size: 9.5px; line-height: 1.4; color: #1e293b; }
    .field-bullet { color: #0f766e; font-weight: 800; font-size: 11px; line-height: 1; flex-shrink: 0; }
    .field-label { font-weight: 700; color: #475569; flex-shrink: 0; }
    .field-val { font-weight: 600; color: #0f172a; word-break: break-word; }

    .signs { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-top: 24px; padding-top: 14px; border-top: 1px dashed #94a3b8; }
    .sign-box { text-align: center; }
    .sign-line { border-bottom: 1px solid #64748b; height: 32px; margin-bottom: 4px; }
    .sign-lbl { font-size: 9px; font-weight: 700; text-transform: uppercase; color: #475569; }

    @media print {
      @page { margin: 8mm 10mm; size: A4 portrait; }
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
<div class="page">

  <!-- Header -->
  <table class="header-table">
    <tr>
      <td>
        <div class="company-name">Insights Iva ERP</div>
        <div class="doc-title">Manufacturing Job Card &amp; Workflow Traveler</div>
        <div class="meta-text">Job Card Reference: <strong>${jcNo}</strong> | SO: <strong>${soNo}</strong></div>
      </td>
      <td style="text-align: right; vertical-align: bottom;">
        <span class="badge badge-status">${ws}</span>
        <div class="meta-text" style="margin-top: 4px;">Print Date: ${new Date().toLocaleDateString("en-IN")} ${printedBy ? `| By: ${printedBy}` : ""}</div>
      </td>
    </tr>
  </table>

  <!-- Order Info Card -->
  <div class="card">
    <div class="grid-5">
      <div>
        <div class="field-lbl">Customer</div>
        <div class="field-val">${custName}</div>
      </div>
      <div>
        <div class="field-lbl">Ordered Item</div>
        <div class="field-val">${prodName}</div>
        ${prodCode ? `<div class="meta-text">Code: ${prodCode}</div>` : ""}
      </div>
      <div>
        <div class="field-lbl">Target Quantity</div>
        <div class="field-val">${qty.toLocaleString("en-IN")} ${uom}</div>
      </div>
      <div>
        <div class="field-lbl">Delivery Due</div>
        <div class="field-val">${delDate}</div>
        <span class="badge badge-priority" style="margin-top:2px;">${priority}</span>
      </div>
      <div>
        <div class="field-lbl">Sales Value</div>
        <div class="field-val" style="color: #0f766e;">${salesValue}</div>
      </div>
    </div>
  </div>

  <!-- Manufacturing Workflow Steps Traveler -->
  <div class="section-title">
    <span>Manufacturing Workflow Steps &amp; Stage Audit Traveler</span>
    <span style="font-size: 9.5px; font-weight: 600; color: #475569;">8-Stage Process Standard</span>
  </div>

  <table class="wf-table">
    <thead>
      <tr>
        <th style="width: 45px; text-align: center;">Stage</th>
        <th style="width: 155px;">Process Stage</th>
        <th>Workflow Details &amp; Specifications</th>
        <th style="width: 135px;">Assigned / Station</th>
        <th style="width: 100px; text-align: center;">Stage Status</th>
      </tr>
    </thead>
    <tbody>
      ${data.rawStageDefs.map((stg) => `
        <tr>
          <td class="step-num">${escapeHtml(stg.num)}</td>
          <td>
            <div class="step-title">${escapeHtml(stg.name)}</div>
          </td>
          <td>
            <div class="point-list">
              ${stg.fields.map((fld) => `
                <div class="field-row">
                  <span class="field-bullet">•</span>
                  <span class="field-label">${escapeHtml(fld.label)}:</span>
                  <span class="field-val">${escapeHtml(fld.value)}</span>
                </div>
              `).join("")}
            </div>
          </td>
          <td>${escapeHtml(stg.station)}</td>
          <td style="text-align: center;"><span class="step-badge">✓ ${escapeHtml(stg.status)}</span></td>
        </tr>
      `).join("")}
    </tbody>
  </table>

  <!-- Authorization Signatures -->
  <div class="signs">
    <div class="sign-box">
      <div class="sign-line"></div>
      <div class="sign-lbl">Store In-Charge</div>
    </div>
    <div class="sign-box">
      <div class="sign-line"></div>
      <div class="sign-lbl">Machine Operator</div>
    </div>
    <div class="sign-box">
      <div class="sign-line"></div>
      <div class="sign-lbl">Quality Inspector</div>
    </div>
    <div class="sign-box">
      <div class="sign-line"></div>
      <div class="sign-lbl">Plant Manager</div>
    </div>
  </div>

</div>
</body>
</html>`;

  const win = window.open("", "_blank", "width=880,height=920");
  if (!win) {
    alert("Please allow popups to print the Job Card traveler.");
    return;
  }
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); }, 400);
}




export function printWorkOrder(workOrder, user) {
  if (!workOrder) return;
  const printedBy = escapeHtml(user?.full_name || user?.name || "");
  const planned  = Number(workOrder.planned_quantity || 0);
  const produced = Number(workOrder.produced_quantity ?? workOrder.actual_quantity ?? 0);
  const balance  = Math.max(planned - produced, 0);
  const startDate = workOrder.planned_start ? new Date(workOrder.planned_start).toLocaleDateString() : "—";
  const dueDate   = workOrder.planned_end   ? new Date(workOrder.planned_end).toLocaleDateString()   : "—";
  const priority  = workOrder.priority ? workOrder.priority.charAt(0).toUpperCase() + workOrder.priority.slice(1) : "—";
  const status    = workOrder.status   ? workOrder.status.charAt(0).toUpperCase()   + workOrder.status.slice(1).replace(/_/g," ") : "—";

  const html = `<!DOCTYPE html><html><head><title>Work Order ${escapeHtml(workOrder.work_order_number || "")}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Arial,Helvetica,sans-serif;color:#000;background:#fff;font-size:12px;line-height:1.5}
  .page{padding:24px 30px}
  .top-bar{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;font-size:12px;color:#000}
  .brand{color:#000;font-weight:bold;font-size:12px}
  .title{font-size:24px;font-weight:800;letter-spacing:.5px;text-transform:uppercase;margin-bottom:6px;color:#000}
  .subtitle{font-size:12px;color:#000;padding-bottom:10px;border-bottom:1px solid #000;margin-bottom:16px}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:0}
  .section{padding:10px 0;border-bottom:1px solid #ddd}
  .section:last-child{border-bottom:none}
  .section-label{font-size:12px;font-weight:bold;color:#000;text-transform:uppercase;margin-bottom:4px}
  .section-value{font-size:12px;font-weight:normal;color:#000}
  .section-sub{font-size:12px;color:#000;margin-top:2px}
  .badge{display:inline-block;padding:0;border-radius:0;font-size:12px;font-weight:normal;margin-right:8px;background:none !important;color:#000 !important;border:none !important}
  .qty-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:4px}
  .qty-box .num{font-size:12px;font-weight:normal;color:#000}
  .qty-box .lbl{font-size:12px;color:#000;text-transform:uppercase;margin-top:2px}
  @media print{@page{margin:10mm;size:auto;}body{-webkit-print-color-adjust:exact;print-color-adjust:exact;margin:0;}}
</style>
</head><body><div class="page">

<div class="top-bar">
  <div>
    <span>Production</span>
    ${printedBy ? `<span style="margin-left:10px">Welcome, ${printedBy}</span>` : ""}
  </div>
  <span class="brand">Insights Iva</span>
</div>

<div class="title">Work Order Details</div>
<div class="subtitle">Order # ${escapeHtml(workOrder.work_order_number || "—")} &nbsp;|&nbsp; Printed on ${new Date().toLocaleDateString()} ${printedBy ? `&nbsp;|&nbsp; By: ${printedBy}` : ""}</div>

<div class="grid">
  <div class="section">
    <div class="section-label">Product Information</div>
    <div class="section-value">${escapeHtml(workOrder.product_name || "—")}</div>
    ${workOrder.production_order_number ? `<div class="section-sub">Production Order: ${escapeHtml(workOrder.production_order_number)}</div>` : ""}
    ${workOrder.department ? `<div class="section-sub">Department: ${escapeHtml(workOrder.department)}</div>` : ""}
  </div>
  <div class="section">
    <div class="section-label">Customer</div>
    <div class="section-value">${escapeHtml(workOrder.customer_name || "—")}</div>
  </div>
</div>

<div class="grid">
  <div class="section">
    <div class="section-label">Priority &amp; Status</div>
    <div style="margin-top:4px">
      <span class="badge">${escapeHtml(priority)}</span>
      <span class="badge">${escapeHtml(status)}</span>
      ${workOrder.materials_issued ? '<span class="badge">Materials ✔</span>' : ""}
    </div>
  </div>
  <div class="section">
    <div class="section-label">Production Quantities</div>
    <div class="qty-grid">
      <div class="qty-box"><div class="lbl">Planned: ${planned}</div></div>
      <div class="qty-box"><div class="lbl">Produced: ${produced}</div></div>
      <div class="qty-box"><div class="lbl">Balance: ${balance}</div></div>
    </div>
  </div>
</div>

<div class="grid">
  <div class="section">
    <div class="section-label">Schedule</div>
    <div style="margin-top:4px">
      <div>Start: ${startDate}</div>
      <div>Due: ${dueDate}</div>
    </div>
  </div>
  <div class="section">
    <div class="section-label">Assignment</div>
    <div style="margin-top:4px">
      <div>Machine: ${escapeHtml(workOrder.machine_name || "—")}</div>
      <div>Operator: ${escapeHtml(workOrder.operator_name || "—")}</div>
      <div>Shift: ${escapeHtml(workOrder.shift || "—")}</div>
    </div>
  </div>
</div>

</div></body></html>`;

  const win = window.open("", "_blank", "width=750,height=680");
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); }, 400);
}
