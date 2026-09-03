import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  X,
  ArrowRight,
  UserCheck,
  HelpCircle,
  Clock,
  Calendar,
  Layers,
  Box,
  CheckCircle2,
  AlertTriangle,
  Factory,
  CheckSquare,
  PackageCheck,
  Receipt,
  ShoppingCart,
  Boxes,
} from "lucide-react";
import Button from "../common/Button";
import { PriorityBadge, WorkflowStatusBadge, fmtDeliveryDisplay } from "./jobCardUiShared";
import { stageJobCardUrl } from "../../utils/workflowStageRoutes";

const STAGES_CONFIG = [
  { step: 1, key: "sales", label: "Sales Order", role: "Sales Team", icon: ShoppingCart, desc: "Create Sales Order & initiate manufacturing workflow." },
  { step: 2, key: "inventory", label: "Inventory Check", role: "Store Manager", icon: Boxes, desc: "Verify warehouse raw material stock availability." },
  { step: 3, key: "store", label: "Store Issue", role: "Store Manager", icon: Layers, desc: "Issue raw materials to shop floor and generate Work Order." },
  { step: 4, key: "production", label: "Production Planning", role: "Production Manager", icon: Factory, desc: "Assign Machine and Operator for shop floor run." },
  { step: 5, key: "operator", label: "Shop Floor", role: "Machine Operator", icon: Clock, desc: "Run production on machine, record output and scrap." },
  { step: 6, key: "quality", label: "Quality QA", role: "Quality QC Team", icon: CheckSquare, desc: "Inspect finished goods and issue QA approval stamp." },
  { step: 7, key: "packing", label: "Packing & Dispatch", role: "Store / Packing Team", icon: PackageCheck, desc: "Pack items, record batch/lot number, and update FG stock." },
  { step: 8, key: "billing", label: "GST Tax Invoice", role: "Finance / Accounts", icon: Receipt, desc: "Generate official GST Tax Invoice and complete Job Card." },
];

function getStageInfo(workflowStatus) {
  const ws = String(workflowStatus || "").toUpperCase();
  if (ws === "SALES_CONFIRMED") return { step: 1, ...STAGES_CONFIG[0] };
  if (ws === "MATERIAL_CHECK_PENDING" || ws === "MATERIAL_SHORTAGE" || ws === "MATERIAL_PARTIAL") {
    return { step: 2, ...STAGES_CONFIG[1] };
  }
  if (ws === "MATERIAL_AVAILABLE" || ws === "STORE_ISSUE_PENDING" || ws === "STORE_ISSUE_PARTIAL") {
    return { step: 3, ...STAGES_CONFIG[2] };
  }
  if (ws === "READY_FOR_PRODUCTION" || ws === "PRODUCTION_REWORK" || ws === "QUALITY_REJECTED") {
    return { step: 4, ...STAGES_CONFIG[3] };
  }
  if (ws === "PRODUCTION_ASSIGNED" || ws === "PRODUCTION_IN_PROGRESS" || ws === "PRODUCTION_COMPLETED") {
    return { step: 5, ...STAGES_CONFIG[4] };
  }
  if (ws === "QUALITY_CHECK_PENDING" || ws === "QUALITY_ON_HOLD") {
    return { step: 6, ...STAGES_CONFIG[5] };
  }
  if (ws.startsWith("PACKING") || ws === "QUALITY_APPROVED") {
    return { step: 7, ...STAGES_CONFIG[6] };
  }
  if (ws.startsWith("BILLING") || ws === "PACKED" || ws === "INVOICED") {
    return { step: 8, ...STAGES_CONFIG[7] };
  }
  if (ws === "COMPLETED") {
    return { step: 8, ...STAGES_CONFIG[7], label: "Completed", desc: "Job Card fully processed and invoiced." };
  }
  return { step: 2, ...STAGES_CONFIG[1] };
}

export default function JobCardQuickViewModal({ row, open, onClose }) {
  if (!open || !row) return null;

  const orderId = row.sales_order_id ?? row.id;
  const ws = String(row.workflow_status || "").toUpperCase();
  const isCompleted = ws === "COMPLETED" || String(row.status || "").toLowerCase() === "completed";
  const currentStage = isCompleted
    ? {
        step: 8,
        key: "billing",
        label: "Completed",
        role: "All Teams",
        desc: "All manufacturing stages, quality inspection, and GST Tax Invoicing are 100% finished.",
      }
    : getStageInfo(row.workflow_status);
  const targetUrl = stageJobCardUrl(orderId, row.workflow_status);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl rounded-2xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header with Title & Middle-Cross Close Button */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/60 px-5 py-4 shrink-0">
          <div className="flex items-center gap-2.5">
            <span
              className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold text-white shadow-xs ${
                isCompleted ? "bg-emerald-600" : "bg-teal-600"
              }`}
            >
              {isCompleted ? <CheckCircle2 className="h-4 w-4" /> : currentStage.step}
            </span>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                {row.job_card_no || row.order_number || `Job Card #${orderId}`}
                {isCompleted ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                    <CheckCircle2 className="h-3 w-3" /> Completed
                  </span>
                ) : null}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Sales Order: <span className="font-semibold text-slate-700 dark:text-slate-300">{row.order_number || "—"}</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="rounded-full p-1.5 text-slate-400 hover:bg-slate-200/80 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Modal Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Who Can & What is What — Role & Step Notification Box */}
          <div
            className={`rounded-xl border p-4 ${
              isCompleted
                ? "border-emerald-200/80 bg-emerald-50/70 dark:border-emerald-900/60 dark:bg-emerald-950/40"
                : "border-teal-200/80 bg-teal-50/70 dark:border-teal-900/60 dark:bg-teal-950/40"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold text-white ${
                      isCompleted ? "bg-emerald-600" : "bg-teal-600"
                    }`}
                  >
                    <UserCheck className="h-3.5 w-3.5" />
                    {isCompleted ? "Status: 100% Completed" : `Who Can: ${currentStage.role}`}
                  </span>
                  <span
                    className={`text-xs font-semibold ${
                      isCompleted ? "text-emerald-950 dark:text-emerald-200" : "text-teal-950 dark:text-teal-200"
                    }`}
                  >
                    {isCompleted ? "Order Lifecycle Finished" : `Stage ${currentStage.step}: ${currentStage.label}`}
                  </span>
                </div>
                <p
                  className={`text-xs leading-relaxed font-medium ${
                    isCompleted ? "text-emerald-900 dark:text-emerald-300" : "text-teal-900 dark:text-teal-300"
                  }`}
                >
                  <span className="font-bold">What is what:</span> {currentStage.desc}
                </p>
              </div>

              <WorkflowStatusBadge status={row.workflow_status} label={row.status_label || row.status} />
            </div>
          </div>

          {/* Key Order Details Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 text-xs">
            <div>
              <p className="text-[11px] text-slate-400 font-medium">Customer</p>
              <p className="font-semibold text-slate-800 dark:text-slate-100 truncate mt-0.5" title={row.customer_name}>
                {row.customer_name || "—"}
              </p>
            </div>

            <div>
              <p className="text-[11px] text-slate-400 font-medium">Product / Item</p>
              <p className="font-semibold text-slate-800 dark:text-slate-100 truncate mt-0.5" title={row.product_name}>
                {row.product_name || "—"}
              </p>
            </div>

            <div>
              <p className="text-[11px] text-slate-400 font-medium">Order Quantity</p>
              <p className="font-semibold text-slate-800 dark:text-slate-100 mt-0.5 tabular-nums">
                {row.quantity ? `${Number(row.quantity).toLocaleString("en-IN")} ${row.unit || "Pcs"}` : "—"}
              </p>
            </div>

            <div>
              <p className="text-[11px] text-slate-400 font-medium">Delivery Date</p>
              <p className="font-semibold text-slate-800 dark:text-slate-100 mt-0.5 flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-slate-400" />
                {fmtDeliveryDisplay(row.delivery_date)}
              </p>
            </div>

            <div>
              <p className="text-[11px] text-slate-400 font-medium">Order Priority</p>
              <div className="mt-0.5">
                <PriorityBadge priority={row.priority || "medium"} showDot={false} />
              </div>
            </div>

            <div>
              <p className="text-[11px] text-slate-400 font-medium">Total Amount</p>
              <p className="font-bold text-teal-700 dark:text-teal-300 mt-0.5">
                {row.total_amount ? `₹ ${Number(row.total_amount).toLocaleString("en-IN")}` : "—"}
              </p>
            </div>
          </div>

          {/* 8-Stage Progress Stepper & Detailed Step-by-Step Data */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 p-4 space-y-4">
            <h4 className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center justify-between">
              <span>Manufacturing Workflow Progress (Stages 1 – 8)</span>
              {isCompleted ? (
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                  All 8 Stages 100% Completed
                </span>
              ) : (
                <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                  Current: Stage {currentStage.step}
                </span>
              )}
            </h4>

            {/* Stepper Buttons */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {STAGES_CONFIG.map((st) => {
                const isPassed = isCompleted || st.step < currentStage.step;
                const isCurrent = !isCompleted && st.step === currentStage.step;

                return (
                  <div
                    key={st.step}
                    className={`flex items-center gap-2 rounded-lg p-2.5 text-xs border transition-colors ${
                      isPassed
                        ? "border-emerald-300 dark:border-emerald-900/60 bg-emerald-50/60 dark:bg-emerald-950/30 text-emerald-950 dark:text-emerald-200 font-medium"
                        : isCurrent
                        ? "border-teal-500 bg-teal-50 dark:bg-teal-950/50 font-bold text-teal-900 dark:text-teal-100 shadow-xs"
                        : "border-slate-200/50 dark:border-slate-800/40 bg-slate-100/40 dark:bg-slate-900/20 text-slate-400"
                    }`}
                  >
                    <div
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                        isPassed
                          ? "bg-emerald-600 text-white"
                          : isCurrent
                          ? "bg-teal-600 text-white animate-pulse"
                          : "bg-slate-200 dark:bg-slate-800 text-slate-500"
                      }`}
                    >
                      {isPassed ? <CheckCircle2 className="h-3 w-3" /> : st.step}
                    </div>

                    <div className="min-w-0">
                      <p className="truncate font-semibold text-[11px]">{st.label}</p>
                      <p className="text-[9px] text-slate-400 truncate">{st.role}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer with Clear Action Buttons */}
        <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-5 py-3.5 shrink-0">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>

          <Button
            variant="primary"
            to={targetUrl}
            onClick={onClose}
            rightIcon={<ArrowRight className="h-4 w-4" />}
          >
            {isCompleted ? "View Completed Job Card" : "Open Job Card"}
          </Button>
        </div>
      </div>
    </div>
  );
}
