import { useEffect, useMemo, useState } from "react";

import DailyWeeklyProductionPlanner from "./DailyWeeklyProductionPlanner";
import ManufacturingToolkitDashboard from "./ManufacturingToolkitDashboard";
import { resolveToolkitConfig } from "../../data/manufacturingToolkitLiveMerge";
import { MANUFACTURING_TOOLKITS } from "../../data/manufacturingToolkitRegistry";
import { getInventoryDashboard, getRawMaterials, getRawMaterialsSummary } from "../../api/inventoryApi";
import { getBreakdownSummary, getBreakdownsEnriched } from "../../api/maintenanceApi";
import { getDefectSummary, getDefectsEnriched } from "../../api/qualityApi";
import {
  getAllocationSummary,
  getAllocations,
  createManufacturingIssue,
  assignManufacturingIssue,
  transitionManufacturingIssueStatus,
  createProcessChecklistItem,
  updateProcessChecklistItem,
  getManufacturingToolkitDashboard,
  getProductionProductCostDashboard,
  listManufacturingIssues,
  listSafetyIncidents,
  createSafetyIncidentToolkit,
  assignSafetyIncidentInvestigation,
  transitionSafetyIncidentStatus,
  listProcessChecklistItems,
  verifyProcessChecklistItem,
  approveProcessChecklistItem,
  transitionProcessChecklistStatus,
} from "../../api/productionApi";
import { asArray } from "../../utils/apiError";
import ManufacturingToolkitIncidentPanel from "./ManufacturingToolkitIncidentPanel";
import ManufacturingToolkitIssuePanel from "./ManufacturingToolkitIssuePanel";
import ManufacturingToolkitChecklistPanel from "./ManufacturingToolkitChecklistPanel";
import {
  checklistListParams,
  incidentListParams,
  issueListParams,
  toolkitActionError,
} from "./manufacturingToolkitWorkflows";

export default function ManufacturingProductionToolkitHost({
  orders = [],
  machines = [],
  summary = {},
  plannerTab = "dashboard",
  onPlannerTabChange,
  plannerRefreshKey = 0,
}) {
  const [toolkitId, setToolkitId] = useState("daily_weekly_planner");
  const [inventoryItems, setInventoryItems] = useState(null);
  const [breakdownSummary, setBreakdownSummary] = useState(null);
  const [breakdowns, setBreakdowns] = useState(null);
  const [rawMaterials, setRawMaterials] = useState(null);
  const [rawMaterialsSummary, setRawMaterialsSummary] = useState(null);
  const [defectSummary, setDefectSummary] = useState(null);
  const [defects, setDefects] = useState(null);
  const [allocationSummary, setAllocationSummary] = useState(null);
  const [allocationRows, setAllocationRows] = useState(null);
  const [productCostPayload, setProductCostPayload] = useState(null);
  const [productCostError, setProductCostError] = useState(null);
  const [toolkitDashboards, setToolkitDashboards] = useState({});
  const [toolkitDashboardError, setToolkitDashboardError] = useState(null);
  const [toolkitDashboardLoading, setToolkitDashboardLoading] = useState(false);
  const [manufacturingIssues, setManufacturingIssues] = useState(null);
  const [manufacturingIssuesError, setManufacturingIssuesError] = useState(null);
  const [issueForm, setIssueForm] = useState({ title: "", department: "", priority: "medium", owner_name: "" });
  const [issueSubmitting, setIssueSubmitting] = useState(false);
  const [issueRefreshKey, setIssueRefreshKey] = useState(0);
  const [issueFilter, setIssueFilter] = useState("all");
  const [issueAssignOwner, setIssueAssignOwner] = useState("");
  const [issueCloseNotes, setIssueCloseNotes] = useState("");
  const [issuesLoaded, setIssuesLoaded] = useState(false);
  const [processChecklistItems, setProcessChecklistItems] = useState(null);
  const [checklistError, setChecklistError] = useState(null);
  const [checklistRefreshKey, setChecklistRefreshKey] = useState(0);
  const [checklistForm, setChecklistForm] = useState({
    process_stage: "",
    description: "",
    owner_name: "",
    due_date: "",
  });
  const [checklistSubmitting, setChecklistSubmitting] = useState(false);
  const [checklistFilter, setChecklistFilter] = useState("all");
  const [checklistLoaded, setChecklistLoaded] = useState(false);
  const [checklistEditItem, setChecklistEditItem] = useState(null);
  const [checklistEditForm, setChecklistEditForm] = useState({ process_stage: "", description: "" });
  const [checklistRejectReason, setChecklistRejectReason] = useState("");
  const [safetyIncidents, setSafetyIncidents] = useState(null);
  const [safetyIncidentsError, setSafetyIncidentsError] = useState(null);
  const [incidentRefreshKey, setIncidentRefreshKey] = useState(0);
  const [incidentForm, setIncidentForm] = useState({
    title: "",
    type: "Near Miss",
    department: "",
    severity: "low",
    description: "",
  });
  const [incidentSubmitting, setIncidentSubmitting] = useState(false);
  const [incidentFilter, setIncidentFilter] = useState("all");
  const [incidentsLoaded, setIncidentsLoaded] = useState(false);
  const [investigationOwnerName, setInvestigationOwnerName] = useState("");
  const [closureEvidence, setClosureEvidence] = useState("");

  const BATCH2_TOOLKIT_IDS = new Set([
    "quality_management_plan",
    "equipment_inventory",
    "utilization_rate",
    "labour_productivity",
    "timesheet_tracking",
    "daily_work_log",
    "process_checklist",
    "incident_report",
    "issue_log",
  ]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [
        invRes,
        bdSumRes,
        bdListRes,
        rmSumRes,
        rmListRes,
        defectSumRes,
        defectListRes,
        allocSumRes,
        allocRowsRes,
        productCostRes,
      ] = await Promise.allSettled([
        getInventoryDashboard(),
        getBreakdownSummary(),
        getBreakdownsEnriched(),
        getRawMaterialsSummary(),
        getRawMaterials(),
        getDefectSummary(),
        getDefectsEnriched(),
        getAllocationSummary(),
        getAllocations(),
        getProductionProductCostDashboard(),
      ]);
      if (cancelled) return;
      setInventoryItems(invRes.status === "fulfilled" ? asArray(invRes.value?.data) : []);
      setBreakdownSummary(bdSumRes.status === "fulfilled" ? bdSumRes.value?.data ?? null : null);
      setBreakdowns(bdListRes.status === "fulfilled" ? asArray(bdListRes.value?.data) : []);
      setRawMaterialsSummary(rmSumRes.status === "fulfilled" ? rmSumRes.value?.data ?? null : null);
      setRawMaterials(rmListRes.status === "fulfilled" ? asArray(rmListRes.value?.data) : []);
      setDefectSummary(defectSumRes.status === "fulfilled" ? defectSumRes.value?.data ?? null : null);
      setDefects(defectListRes.status === "fulfilled" ? asArray(defectListRes.value?.data) : []);
      setAllocationSummary(allocSumRes.status === "fulfilled" ? allocSumRes.value?.data ?? null : null);
      setAllocationRows(allocRowsRes.status === "fulfilled" ? asArray(allocRowsRes.value?.data) : []);
      if (productCostRes.status === "fulfilled") {
        setProductCostPayload({ loaded: true, ...productCostRes.value?.data });
        setProductCostError(null);
      } else {
        setProductCostPayload({ loaded: true, rows: [], cost_visible: false });
        setProductCostError("Could not load product cost dashboard");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [plannerRefreshKey]);

  useEffect(() => {
    if (!BATCH2_TOOLKIT_IDS.has(toolkitId)) return;
    let cancelled = false;
    setToolkitDashboardLoading(true);
    setToolkitDashboardError(null);
    (async () => {
      try {
        const res = await getManufacturingToolkitDashboard(toolkitId);
        if (cancelled) return;
        setToolkitDashboards((prev) => ({
          ...prev,
          [toolkitId]: { loaded: true, ...res.data },
        }));
      } catch {
        if (cancelled) return;
        setToolkitDashboards((prev) => ({
          ...prev,
          [toolkitId]: { loaded: true, toolkit_id: toolkitId, data_available: false, kpis: [], table_rows: [] },
        }));
        setToolkitDashboardError("Could not load dashboard data");
      } finally {
        if (!cancelled) setToolkitDashboardLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [toolkitId, plannerRefreshKey, issueRefreshKey, checklistRefreshKey, incidentRefreshKey]);

  useEffect(() => {
    if (toolkitId !== "issue_log") return;
    let cancelled = false;
    setManufacturingIssuesError(null);
    setIssuesLoaded(false);
    (async () => {
      try {
        const res = await listManufacturingIssues(issueListParams(issueFilter));
        if (cancelled) return;
        setManufacturingIssues(res.data ?? { items: [], total: 0 });
        setIssuesLoaded(true);
      } catch (err) {
        if (cancelled) return;
        setManufacturingIssues({ items: [], total: 0 });
        setManufacturingIssuesError(toolkitActionError(err, "Could not load issue register"));
        setIssuesLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [toolkitId, plannerRefreshKey, issueRefreshKey, issueFilter]);

  useEffect(() => {
    if (toolkitId !== "process_checklist") return;
    let cancelled = false;
    setChecklistError(null);
    setChecklistLoaded(false);
    (async () => {
      try {
        const res = await listProcessChecklistItems(checklistListParams(checklistFilter));
        if (cancelled) return;
        setProcessChecklistItems(res.data ?? { items: [], total: 0 });
        setChecklistLoaded(true);
      } catch (err) {
        if (cancelled) return;
        setProcessChecklistItems({ items: [], total: 0 });
        setChecklistError(toolkitActionError(err, "Could not load checklist register"));
        setChecklistLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [toolkitId, plannerRefreshKey, checklistRefreshKey, checklistFilter]);

  useEffect(() => {
    if (toolkitId !== "incident_report") return;
    let cancelled = false;
    setSafetyIncidentsError(null);
    setIncidentsLoaded(false);
    (async () => {
      try {
        const res = await listSafetyIncidents(incidentListParams(incidentFilter));
        if (cancelled) return;
        setSafetyIncidents(res.data ?? { items: [], total: 0 });
        setIncidentsLoaded(true);
      } catch (err) {
        if (cancelled) return;
        setSafetyIncidents({ items: [], total: 0 });
        setSafetyIncidentsError(toolkitActionError(err, "Could not load incident register"));
        setIncidentsLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [toolkitId, plannerRefreshKey, incidentRefreshKey, incidentFilter]);

  const activeMeta = useMemo(
    () => MANUFACTURING_TOOLKITS.find((t) => t.id === toolkitId) || MANUFACTURING_TOOLKITS[0],
    [toolkitId]
  );

  const config = useMemo(() => {
    if (toolkitId === "daily_weekly_planner") return null;
    return resolveToolkitConfig(toolkitId, {
      orders,
      machines,
      summary,
      inventoryItems,
      breakdownSummary,
      breakdowns,
      rawMaterials,
      rawMaterialsSummary,
      defectSummary,
      defects,
      allocationSummary,
      allocationRows,
      productCostPayload,
      toolkitDashboards,
      manufacturingIssues,
      processChecklistItems,
      safetyIncidents,
    });
  }, [
    toolkitId,
    orders,
    machines,
    summary,
    inventoryItems,
    breakdownSummary,
    breakdowns,
    rawMaterials,
    rawMaterialsSummary,
    defectSummary,
    defects,
    allocationSummary,
    allocationRows,
    productCostPayload,
    toolkitDashboards,
    manufacturingIssues,
    processChecklistItems,
    safetyIncidents,
  ]);

  function bumpIncidentData() {
    setIncidentRefreshKey((k) => k + 1);
    setToolkitDashboards((prev) => {
      const next = { ...prev };
      delete next.incident_report;
      return next;
    });
  }

  function bumpChecklistData() {
    setChecklistRefreshKey((k) => k + 1);
    setToolkitDashboards((prev) => {
      const next = { ...prev };
      delete next.process_checklist;
      return next;
    });
  }

  async function submitNewIssue(e) {
    e.preventDefault();
    if (!issueForm.title.trim()) return;
    setIssueSubmitting(true);
    try {
      await createManufacturingIssue({
        title: issueForm.title.trim(),
        department: issueForm.department.trim() || undefined,
        priority: issueForm.priority,
        owner_name: issueForm.owner_name.trim() || undefined,
      });
      setIssueForm({ title: "", department: "", priority: "medium", owner_name: "" });
      setIssueRefreshKey((k) => k + 1);
      setToolkitDashboards((prev) => {
        const next = { ...prev };
        delete next.issue_log;
        return next;
      });
    } catch (err) {
      setManufacturingIssuesError(toolkitActionError(err, "Failed to create issue"));
    } finally {
      setIssueSubmitting(false);
    }
  }

  async function submitNewChecklistItem(e) {
    e.preventDefault();
    if (!checklistForm.process_stage.trim() || !checklistForm.description.trim()) return;
    setChecklistSubmitting(true);
    try {
      await createProcessChecklistItem({
        process_stage: checklistForm.process_stage.trim(),
        description: checklistForm.description.trim(),
        owner_name: checklistForm.owner_name.trim() || undefined,
        due_date: checklistForm.due_date || undefined,
      });
      setChecklistForm({ process_stage: "", description: "", owner_name: "", due_date: "" });
      bumpChecklistData();
    } catch (err) {
      setChecklistError(toolkitActionError(err, "Failed to create checklist item"));
    } finally {
      setChecklistSubmitting(false);
    }
  }

  async function submitNewIncident(e) {
    e.preventDefault();
    if (!incidentForm.title.trim()) return;
    setIncidentSubmitting(true);
    try {
      await createSafetyIncidentToolkit({
        title: incidentForm.title.trim(),
        type: incidentForm.type,
        department: incidentForm.department.trim() || undefined,
        severity: incidentForm.severity,
        description: incidentForm.description.trim() || undefined,
      });
      setIncidentForm({ title: "", type: "Near Miss", department: "", severity: "low", description: "" });
      bumpIncidentData();
    } catch (err) {
      setSafetyIncidentsError(toolkitActionError(err, "Failed to report incident"));
    } finally {
      setIncidentSubmitting(false);
    }
  }

  async function runIncidentAssign(incidentId) {
    setSafetyIncidentsError(null);
    try {
      await assignSafetyIncidentInvestigation(incidentId, {
        investigation_owner_name: investigationOwnerName.trim(),
      });
      bumpIncidentData();
    } catch (err) {
      setSafetyIncidentsError(toolkitActionError(err, "Incident assignment failed"));
    }
  }

  async function runIncidentClose(incidentId) {
    setSafetyIncidentsError(null);
    try {
      await transitionSafetyIncidentStatus(incidentId, {
        status: "closed",
        closure_evidence: closureEvidence.trim(),
      });
      bumpIncidentData();
    } catch (err) {
      setSafetyIncidentsError(toolkitActionError(err, "Incident closure failed"));
    }
  }

  async function runIssueAssign(issueId) {
    setManufacturingIssuesError(null);
    try {
      await assignManufacturingIssue(issueId, { owner_name: issueAssignOwner.trim() });
      setIssueRefreshKey((k) => k + 1);
    } catch (err) {
      setManufacturingIssuesError(toolkitActionError(err, "Issue assignment failed"));
    }
  }

  async function runIssueClose(issueId) {
    setManufacturingIssuesError(null);
    try {
      await transitionManufacturingIssueStatus(issueId, {
        status: "closed",
        resolution_notes: issueCloseNotes.trim(),
      });
      setIssueRefreshKey((k) => k + 1);
    } catch (err) {
      setManufacturingIssuesError(toolkitActionError(err, "Issue close failed"));
    }
  }

  async function runIssueReopen(issueId) {
    setManufacturingIssuesError(null);
    try {
      await transitionManufacturingIssueStatus(issueId, { status: "open" });
      setIssueRefreshKey((k) => k + 1);
    } catch (err) {
      setManufacturingIssuesError(toolkitActionError(err, "Issue reopen failed"));
    }
  }

  async function runChecklistStart(itemId) {
    setChecklistError(null);
    try {
      await transitionProcessChecklistStatus(itemId, { status: "in_progress" });
      bumpChecklistData();
    } catch (err) {
      setChecklistError(toolkitActionError(err, "Checklist action failed"));
    }
  }

  async function runChecklistPass(itemId) {
    setChecklistError(null);
    try {
      await transitionProcessChecklistStatus(itemId, { status: "in_progress" });
      await verifyProcessChecklistItem(itemId, { verification_result: "pass" });
      bumpChecklistData();
    } catch (err) {
      setChecklistError(toolkitActionError(err, "Checklist verification failed"));
    }
  }

  async function runChecklistApprove(itemId) {
    setChecklistError(null);
    try {
      await approveProcessChecklistItem(itemId, { approved: true });
      bumpChecklistData();
    } catch (err) {
      setChecklistError(toolkitActionError(err, "Checklist approval failed"));
    }
  }

  async function runChecklistFail(itemId) {
    setChecklistError(null);
    try {
      await verifyProcessChecklistItem(itemId, { verification_result: "fail" });
      bumpChecklistData();
    } catch (err) {
      setChecklistError(toolkitActionError(err, "Checklist verification failed"));
    }
  }

  async function runChecklistReject(itemId) {
    setChecklistError(null);
    try {
      await approveProcessChecklistItem(itemId, {
        approved: false,
        rejection_reason: checklistRejectReason.trim(),
      });
      bumpChecklistData();
    } catch (err) {
      setChecklistError(toolkitActionError(err, "Checklist rejection failed"));
    }
  }

  async function saveChecklistEdit() {
    if (!checklistEditItem) return;
    setChecklistError(null);
    try {
      await updateProcessChecklistItem(checklistEditItem.id, {
        process_stage: checklistEditForm.process_stage.trim(),
        description: checklistEditForm.description.trim(),
      });
      setChecklistEditItem(null);
      bumpChecklistData();
    } catch (err) {
      setChecklistError(toolkitActionError(err, "Checklist update failed"));
    }
  }

  function beginChecklistEdit(item) {
    setChecklistEditItem(item);
    setChecklistEditForm({ process_stage: item.process_stage, description: item.description });
  }

  return (
    <div className="min-w-0">
      <div className="mtk-host__picker" role="tablist" aria-label="Manufacturing toolkits">
        {MANUFACTURING_TOOLKITS.map((toolkit) => (
          <button
            key={toolkit.id}
            type="button"
            role="tab"
            aria-selected={toolkitId === toolkit.id}
            className={toolkitId === toolkit.id ? "mtk-host__picker--active" : ""}
            onClick={() => {
              setToolkitId(toolkit.id);
              if (toolkit.id !== "daily_weekly_planner" && plannerTab === "production_data") {
                onPlannerTabChange?.("dashboard");
              }
            }}
          >
            {toolkit.label}
          </button>
        ))}
      </div>

      {activeMeta.kind === "planner" ? (
        <DailyWeeklyProductionPlanner
          orders={orders}
          activeTab={plannerTab}
          onTabChange={onPlannerTabChange}
          refreshToken={plannerRefreshKey}
        />
      ) : (
        <>
          {toolkitId === "product_cost" && productCostError ? (
            <div className="mb-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
              {productCostError}
            </div>
          ) : null}
          {toolkitId === "product_cost" && productCostPayload == null ? (
            <div className="mb-2 text-center text-xs text-[var(--color-text-muted)]">
              Loading product cost data…
            </div>
          ) : null}
          {BATCH2_TOOLKIT_IDS.has(toolkitId) && !toolkitDashboards[toolkitId]?.loaded ? (
            <div className="mb-2 py-8 text-center text-sm text-[var(--color-text-muted)]">
              Loading dashboard data…
            </div>
          ) : (
            <>
              {BATCH2_TOOLKIT_IDS.has(toolkitId) && toolkitDashboardError ? (
                <div className="mb-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  {toolkitDashboardError}. Showing empty state — sample figures are not used.
                </div>
              ) : null}
              {toolkitId === "incident_report" ? (
                <ManufacturingToolkitIncidentPanel
                  filter={incidentFilter}
                  onFilterChange={setIncidentFilter}
                  form={incidentForm}
                  onFormChange={setIncidentForm}
                  onSubmit={submitNewIncident}
                  submitting={incidentSubmitting}
                  register={safetyIncidents}
                  registerLoaded={incidentsLoaded}
                  error={safetyIncidentsError}
                  investigationOwnerName={investigationOwnerName}
                  onInvestigationOwnerNameChange={setInvestigationOwnerName}
                  closureEvidence={closureEvidence}
                  onClosureEvidenceChange={setClosureEvidence}
                  onAssign={runIncidentAssign}
                  onClose={runIncidentClose}
                />
              ) : null}
              {toolkitId === "issue_log" ? (
                <ManufacturingToolkitIssuePanel
                  filter={issueFilter}
                  onFilterChange={setIssueFilter}
                  form={issueForm}
                  onFormChange={setIssueForm}
                  onSubmit={submitNewIssue}
                  submitting={issueSubmitting}
                  register={manufacturingIssues}
                  registerLoaded={issuesLoaded}
                  error={manufacturingIssuesError}
                  assignOwnerName={issueAssignOwner}
                  onAssignOwnerNameChange={setIssueAssignOwner}
                  closeNotes={issueCloseNotes}
                  onCloseNotesChange={setIssueCloseNotes}
                  onAssign={runIssueAssign}
                  onClose={runIssueClose}
                  onReopen={runIssueReopen}
                />
              ) : null}
              {toolkitId === "process_checklist" ? (
                <ManufacturingToolkitChecklistPanel
                  filter={checklistFilter}
                  onFilterChange={setChecklistFilter}
                  form={checklistForm}
                  onFormChange={setChecklistForm}
                  onSubmit={submitNewChecklistItem}
                  submitting={checklistSubmitting}
                  register={processChecklistItems}
                  registerLoaded={checklistLoaded}
                  error={checklistError}
                  editItem={checklistEditItem}
                  editForm={checklistEditForm}
                  onEditFormChange={setChecklistEditForm}
                  onSaveEdit={saveChecklistEdit}
                  onCancelEdit={() => setChecklistEditItem(null)}
                  onBeginEdit={beginChecklistEdit}
                  onStart={runChecklistStart}
                  onPass={runChecklistPass}
                  onFail={runChecklistFail}
                  onApprove={runChecklistApprove}
                  onReject={runChecklistReject}
                  rejectReason={checklistRejectReason}
                  onRejectReasonChange={setChecklistRejectReason}
                />
              ) : null}
              <ManufacturingToolkitDashboard config={config} />
            </>
          )}
        </>
      )}
    </div>
  );
}
