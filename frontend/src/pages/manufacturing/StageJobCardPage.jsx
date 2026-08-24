import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { FormField, Input, Select, Textarea } from "../../components/common/FormField";
import OperatorJobCardBody from "../../components/manufacturing/OperatorJobCardBody";
import JobCardActions from "../../components/manufacturing/JobCardActions";
import JobCardLayout, { StageNavLinks } from "../../components/manufacturing/JobCardLayout";
import MaterialTable from "../../components/manufacturing/MaterialTable";
import { CardSectionHeader } from "../../components/manufacturing/jobCardUiShared";
import { useToast } from "../../context/ToastContext";
import useAuth from "../../hooks/useAuth";
import { getTeamDirectory } from "../../api/adminApi";
import { getMachines } from "../../api/productionApi";
import {
  assignOperator,
  completePacking,
  completeProduction,
  createBillingInvoice,
  getStageJobCard,
  holdWorkflowOrder,
  pauseProduction,
  raiseMaterialRequest,
  resumeProduction,
  startProduction,
  submitMaterialCheck,
  submitQualityCheck,
  submitStoreIssue,
  updateProductionProgress,
} from "../../api/workflowApi";
import { ROUTE_SEGMENT_TO_STAGE, STAGE_TITLES } from "../../config/workflowStages";

export default function StageJobCardPage() {
  const { orderId, stage: routeStage } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { user } = useAuth();

  const stage = ROUTE_SEGMENT_TO_STAGE[routeStage] || routeStage;
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [card, setCard] = useState(null);
  const [materialLines, setMaterialLines] = useState([]);
  const [issueLines, setIssueLines] = useState([]);
  const [operators, setOperators] = useState([]);
  const [machines, setMachines] = useState([]);
  const [assignForm, setAssignForm] = useState({ operator_user_id: "", machine_id: "", planned_quantity: "" });
  const [qualityForm, setQualityForm] = useState({ result: "pass", notes: "", defects: "" });
  const [packingForm, setPackingForm] = useState({ packing_status: "packed", packed_quantity: "", courier: "", lr_number: "", remarks: "" });
  const [productionForm, setProductionForm] = useState({
    produced_qty: "",
    rejected_qty: "",
    rework_qty: "",
    notes: "",
    actual_start_time: "",
    actual_end_time: "",
  });

  const load = useCallback(async () => {
    if (!orderId || !stage) return;
    setLoading(true);
    try {
      const res = await getStageJobCard(orderId, stage);
      const data = res?.data ?? res;
      setCard(data);
      if (data.materials) setMaterialLines(data.materials.map((m) => ({ ...m })));
      if (data.material_issue_lines) setIssueLines(data.material_issue_lines.map((m) => ({ ...m })));
      if (data.summary_panel?.order_quantity) {
        setAssignForm((f) => ({ ...f, planned_quantity: String(data.summary_panel.order_quantity) }));
        setPackingForm((f) => ({ ...f, packed_quantity: String(data.summary_panel.order_quantity) }));
      }
      if (stage === "operator" && data.execution) {
        const ex = data.execution;
        setProductionForm({
          produced_qty: ex.produced_qty != null ? String(ex.produced_qty) : "",
          rejected_qty: ex.rejected_qty != null ? String(ex.rejected_qty) : "",
          rework_qty: ex.rework_qty != null ? String(ex.rework_qty) : "",
          notes: ex.operator_remarks || "",
          actual_start_time: "",
          actual_end_time: "",
        });
      } else if (data.summary_panel?.order_quantity && stage !== "operator") {
        setProductionForm((f) => ({ ...f, produced_qty: String(data.summary_panel.order_quantity) }));
      }
    } catch (err) {
      addToast(err?.response?.data?.detail || "Could not load stage job card", "error");
      setCard(null);
    } finally {
      setLoading(false);
    }
  }, [orderId, stage, addToast]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (stage !== "production_manager") return;
    Promise.all([
      getTeamDirectory().then((r) => {
        const rows = r?.data?.items ?? r?.data ?? r ?? [];
        return (Array.isArray(rows) ? rows : []).filter((u) =>
          (u.roles || []).some((role) => (typeof role === "string" ? role : role?.name) === "Operator")
        );
      }),
      getMachines().then((r) => r?.data ?? r ?? []),
    ])
      .then(([ops, macs]) => {
        setOperators(ops);
        setMachines(Array.isArray(macs) ? macs : macs?.items ?? []);
      })
      .catch(() => {});
  }, [stage]);

  const woId = card?.production_plan?.work_order_id || card?.execution?.work_order_id;
  const inspectionId = card?.inspection_id;

  const saveOperatorProgress = async () => {
    if (!woId) return;
    setSubmitting(true);
    try {
      await updateProductionProgress(woId, {
        produced_qty: productionForm.produced_qty ? Number(productionForm.produced_qty) : undefined,
        rejected_qty: productionForm.rejected_qty ? Number(productionForm.rejected_qty) : undefined,
        rework_qty: productionForm.rework_qty ? Number(productionForm.rework_qty) : undefined,
        notes: productionForm.notes,
        actual_start_time: productionForm.actual_start_time || undefined,
        actual_end_time: productionForm.actual_end_time || undefined,
      });
      addToast("Production progress saved", "success");
      await load();
    } catch (err) {
      addToast(err?.response?.data?.detail || "Could not save progress", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const runAction = async (action) => {
    setSubmitting(true);
    try {
      if (stage === "inventory_check") {
        if (action === "confirm_inventory") {
          await submitMaterialCheck(orderId, {
            lines: materialLines.map((ln) => ({
              id: ln.id,
              available_qty: ln.available_qty,
              stock_location: ln.stock_location,
            })),
          });
          addToast("Inventory check submitted", "success");
        } else if (action === "hold_order") {
          await holdWorkflowOrder(orderId, { reason: "On hold by store" });
          addToast("Order placed on hold", "success");
        } else if (action === "raise_material_request") {
          await raiseMaterialRequest(orderId, {});
          addToast("Material request raised", "success");
        }
      } else if (stage === "store") {
        if (action === "issue_materials" || action === "partial_issue") {
          await submitStoreIssue(orderId, {
            lines: issueLines.map((ln) => ({ id: ln.id, issued_qty: ln.issued_qty, store_location: ln.store_location })),
            partial: action === "partial_issue",
            send_to_production: false,
          });
          addToast("Material issue updated", "success");
        } else if (action === "send_to_production") {
          await submitStoreIssue(orderId, {
            lines: issueLines.map((ln) => ({ id: ln.id, issued_qty: ln.issued_qty || ln.required_qty, store_location: ln.store_location })),
            send_to_production: true,
          });
          addToast("Sent to production", "success");
          navigate(`/manufacturing/workflow/order/${orderId}/production`);
        } else if (action === "hold") {
          await holdWorkflowOrder(orderId, { reason: "Store hold" });
          addToast("Order on hold", "success");
        }
      } else if (stage === "production_manager" && woId) {
        if (action === "assign_operator" || action === "send_to_operator") {
          await assignOperator(woId, {
            operator_user_id: Number(assignForm.operator_user_id),
            machine_id: assignForm.machine_id ? Number(assignForm.machine_id) : undefined,
            planned_quantity: assignForm.planned_quantity ? Number(assignForm.planned_quantity) : undefined,
          });
          addToast("Operator assigned", "success");
          navigate(`/manufacturing/workflow/order/${orderId}/operator`);
        } else if (action === "hold") {
          await holdWorkflowOrder(orderId, { reason: "Production hold" });
          addToast("Order on hold", "success");
        }
      } else if (stage === "operator" && woId) {
        if (action === "start_work") {
          await startProduction(woId);
          addToast("Production started", "success");
        } else if (action === "pause") {
          await pauseProduction(woId);
          addToast("Production paused", "success");
        } else if (action === "resume") {
          await resumeProduction(woId);
          addToast("Production resumed", "success");
        } else if (action === "complete_production") {
          await completeProduction(woId, {
            produced_qty: productionForm.produced_qty ? Number(productionForm.produced_qty) : undefined,
            rejected_qty: productionForm.rejected_qty ? Number(productionForm.rejected_qty) : undefined,
            rework_qty: productionForm.rework_qty ? Number(productionForm.rework_qty) : undefined,
            notes: productionForm.notes,
          });
          addToast("Production completed and sent to Quality Check", "success");
          navigate(`/manufacturing/workflow/order/${orderId}/quality`);
        }
      } else if (stage === "quality" && inspectionId) {
        const resultMap = { approve: "pass", reject: "fail", hold: "hold", send_back_to_production: "fail" };
        await submitQualityCheck(inspectionId, {
          result: resultMap[action] || qualityForm.result,
          notes: qualityForm.notes,
          defects: qualityForm.defects,
        });
        addToast("Quality check submitted", "success");
        if (action === "approve") navigate(`/manufacturing/workflow/order/${orderId}/packing`);
      } else if (stage === "packing") {
        if (action === "start_packing") {
          await completePacking(orderId, { ...packingForm, packing_status: "in_progress" });
        } else if (action === "complete_packing" || action === "dispatch") {
          await completePacking(orderId, {
            ...packingForm,
            packing_status: action === "dispatch" ? "dispatched" : "packed",
          });
          addToast("Packing updated", "success");
          navigate(`/manufacturing/workflow/order/${orderId}/billing`);
        } else if (action === "hold") {
          await holdWorkflowOrder(orderId, { reason: "Packing hold" });
        }
      } else if (stage === "billing") {
        if (action === "create_invoice" || action === "confirm_billing") {
          await createBillingInvoice(orderId, { remarks: packingForm.remarks });
          addToast("Billing completed", "success");
        }
      }
      await load();
    } catch (err) {
      addToast(err?.response?.data?.detail || "Action failed", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const inventoryColumns = useMemo(
    () => [
      { key: "material_code", label: "Code" },
      { key: "material_name", label: "Material" },
      { key: "required_qty", label: "Required" },
      { key: "available_qty", label: "Available", editable: card?.editable, type: "number" },
      { key: "shortage_qty", label: "Shortage" },
      { key: "unit", label: "Unit" },
      { key: "stock_location", label: "Location", editable: card?.editable },
      { key: "availability_status", label: "Status" },
    ],
    [card?.editable]
  );

  const issueColumns = useMemo(
    () => [
      { key: "material_code", label: "Code" },
      { key: "material_name", label: "Material" },
      { key: "required_qty", label: "Required" },
      { key: "available_qty", label: "Available" },
      { key: "issued_qty", label: "Issued", editable: card?.editable, type: "number" },
      { key: "remaining_qty", label: "Remaining" },
      { key: "store_location", label: "Store", editable: card?.editable },
      { key: "issue_status", label: "Status" },
    ],
    [card?.editable]
  );

  const stageBody = () => {
    if (stage === "inventory_check") {
      return (
        <article className="ui-card overflow-hidden">
          <CardSectionHeader title="Required Materials" />
          <MaterialTable
            columns={inventoryColumns}
            rows={materialLines}
            editable={card?.editable}
            onChange={(id, key, val) =>
              setMaterialLines((rows) => rows.map((r) => (r.id === id ? { ...r, [key]: val } : r)))
            }
          />
          {card?.stock_status ? (
            <p className="border-t border-[var(--color-border-muted)] px-4 py-2 text-sm">
              Stock status: <strong>{card.stock_status}</strong>
            </p>
          ) : null}
          <JobCardActions
            actions={card?.allowed_actions}
            loading={submitting}
            onAction={runAction}
            labels={{
              confirm_inventory: "Confirm Materials",
              raise_material_request: "Report Shortage",
            }}
          />
        </article>
      );
    }
    if (stage === "store") {
      return (
        <article className="ui-card overflow-hidden">
          <CardSectionHeader title="Material Issue" />
          <MaterialTable
            columns={issueColumns}
            rows={issueLines}
            editable={card?.editable}
            onChange={(id, key, val) =>
              setIssueLines((rows) => rows.map((r) => (r.id === id ? { ...r, [key]: val } : r)))
            }
          />
          <JobCardActions actions={card?.allowed_actions} loading={submitting} onAction={runAction} />
        </article>
      );
    }
    if (stage === "production_manager") {
      const plan = card?.production_plan || {};
      return (
        <article className="ui-card overflow-hidden">
          <CardSectionHeader title="Production Planning" />
          <div className="grid gap-4 p-4 sm:grid-cols-2">
            <FormField label="Work Order">
              <Input value={plan.work_order_number || "—"} readOnly />
            </FormField>
            <FormField label="Planned Qty">
              <Input
                type="number"
                value={assignForm.planned_quantity}
                onChange={(e) => setAssignForm((f) => ({ ...f, planned_quantity: e.target.value }))}
                disabled={!card?.editable}
              />
            </FormField>
            <FormField label="Assign Operator">
              <Select
                value={assignForm.operator_user_id}
                onChange={(e) => setAssignForm((f) => ({ ...f, operator_user_id: e.target.value }))}
                disabled={!card?.editable}
              >
                <option value="">Select operator</option>
                {operators.map((op) => (
                  <option key={op.id} value={op.id}>
                    {op.full_name || op.email}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Machine">
              <Select
                value={assignForm.machine_id}
                onChange={(e) => setAssignForm((f) => ({ ...f, machine_id: e.target.value }))}
                disabled={!card?.editable}
              >
                <option value="">Select machine</option>
                {machines.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name || m.machine_name || m.id}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>
          <JobCardActions actions={card?.allowed_actions} loading={submitting} onAction={runAction} />
        </article>
      );
    }
    if (stage === "operator") {
      return (
        <OperatorJobCardBody
          card={card}
          form={productionForm}
          onChange={(key, value) => setProductionForm((f) => ({ ...f, [key]: value }))}
          submitting={submitting}
          onAction={runAction}
          onSaveProgress={saveOperatorProgress}
        />
      );
    }
    if (stage === "quality") {
      return (
        <article className="ui-card overflow-hidden">
          <CardSectionHeader title="Quality Inspection" />
          <div className="grid gap-4 p-4 sm:grid-cols-2">
            <FormField label="Result">
              <Select
                value={qualityForm.result}
                onChange={(e) => setQualityForm((f) => ({ ...f, result: e.target.value }))}
                disabled={!card?.editable}
              >
                <option value="pass">Pass</option>
                <option value="fail">Fail</option>
                <option value="hold">Hold</option>
              </Select>
            </FormField>
            <FormField label="Remarks" className="sm:col-span-2">
              <Textarea
                rows={3}
                value={qualityForm.notes}
                onChange={(e) => setQualityForm((f) => ({ ...f, notes: e.target.value }))}
                disabled={!card?.editable}
              />
            </FormField>
          </div>
          <JobCardActions actions={card?.allowed_actions} loading={submitting} onAction={runAction} />
        </article>
      );
    }
    if (stage === "packing") {
      return (
        <article className="ui-card overflow-hidden">
          <CardSectionHeader title="Packing & Dispatch" />
          <div className="grid gap-4 p-4 sm:grid-cols-2">
            <FormField label="Packed Qty">
              <Input
                type="number"
                value={packingForm.packed_quantity}
                onChange={(e) => setPackingForm((f) => ({ ...f, packed_quantity: e.target.value }))}
                disabled={!card?.editable}
              />
            </FormField>
            <FormField label="Transporter">
              <Input
                value={packingForm.courier}
                onChange={(e) => setPackingForm((f) => ({ ...f, courier: e.target.value }))}
                disabled={!card?.editable}
              />
            </FormField>
            <FormField label="LR / AWB No.">
              <Input
                value={packingForm.lr_number}
                onChange={(e) => setPackingForm((f) => ({ ...f, lr_number: e.target.value }))}
                disabled={!card?.editable}
              />
            </FormField>
          </div>
          <JobCardActions actions={card?.allowed_actions} loading={submitting} onAction={runAction} />
        </article>
      );
    }
    if (stage === "billing") {
      const bill = card?.billing || {};
      return (
        <article className="ui-card overflow-hidden">
          <CardSectionHeader title="Billing Information" />
          <div className="grid gap-4 p-4 sm:grid-cols-2">
            <FormField label="Invoice No.">
              <Input value={bill.invoice_no || "—"} readOnly />
            </FormField>
            <FormField label="Total Amount">
              <Input value={bill.total_amount != null ? `₹ ${bill.total_amount}` : "—"} readOnly className="ui-num" />
            </FormField>
          </div>
          <JobCardActions actions={card?.allowed_actions} loading={submitting} onAction={runAction} />
        </article>
      );
    }
    return null;
  };

  const operatorStatusVariant =
    card?.status_label === "Paused"
      ? "draft"
      : card?.status_label === "In Progress"
        ? "confirmed"
        : "draft";

  return (
    <JobCardLayout
      title={STAGE_TITLES[stage]}
      card={card}
      loading={loading}
      saving={submitting}
      editable={card?.editable}
      onBack={() => navigate("/manufacturing/workflow")}
      currentStage={stage}
      statusLabel={card?.status_label || card?.card_status?.replace(/_/g, " ") || "In Progress"}
      statusVariant={stage === "operator" ? operatorStatusVariant : "confirmed"}
      sidebarExtra={<StageNavLinks orderId={orderId} currentStage={stage === "inventory_check" ? "inventory" : routeStage} />}
      hideSummary={stage === "operator"}
    >
      {stageBody()}
    </JobCardLayout>
  );
}
