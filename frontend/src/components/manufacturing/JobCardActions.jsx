import Button from "../common/Button";

export default function JobCardActions({ actions = [], loading, onAction, labels: labelOverrides = {} }) {
  const visible = (actions || []).filter((a) => a && a !== "view");
  if (!visible.length) return null;

  const labels = {
    confirm_inventory: "Check Stock / Confirm Materials",
    hold_order: "Hold Order",
    raise_material_request: "Record Shortage",
    issue_materials: "Issue Material",
    partial_issue: "Partial Issue",
    hold: "Hold",
    send_to_production: "Send to Production",
    create_production_plan: "Create Production Plan",
    assign_operator: "Assign Operator",
    send_to_operator: "Assign to Operator",
    start_work: "Start Production",
    pause: "Pause",
    resume: "Resume",
    complete_production: "Complete Production",
    report_issue: "Report Issue",
    approve: "Approve",
    reject: "Reject",
    send_back_to_production: "Send for Rework",
    start_packing: "Start Packing",
    complete_packing: "Complete Packing",
    dispatch: "Create Dispatch",
    create_invoice: "Create Invoice",
    save_draft: "Save Draft",
    confirm_billing: "Mark as Billed",
    ...labelOverrides,
  };

  const variants = {
    reject: "danger",
    hold: "outline",
    hold_order: "outline",
    report_issue: "danger",
    send_back_to_production: "warning",
  };

  return (
    <div className="flex flex-wrap gap-2 border-t border-[var(--color-border-muted)] bg-[var(--color-surface-muted)]/50 px-4 py-3">
      {visible.map((action) => (
        <Button
          key={action}
          variant={variants[action] || "primary"}
          size="sm"
          loading={loading}
          onClick={() => onAction?.(action)}
        >
          {labels[action] || action}
        </Button>
      ))}
    </div>
  );
}
