import ResourcePage from "../../components/common/ResourcePage";
import InventoryPlanningShell from "../../components/inventory/InventoryPlanningShell";
import { StatusBadge } from "../../components/common/Table";
import { getComplianceLogs, createComplianceLog } from "../../api/qualityApi";

export default function ComplianceLogs() {
  return (
    <InventoryPlanningShell theme="orange" kicker="Audit · Certify · Record" title="COMPLIANCE" accent="LOGS">
    <ResourcePage
      title="Compliance Logs"
      subtitle="Track audits, certifications, and regulatory checks."
      fetcher={getComplianceLogs}
      createFn={createComplianceLog}
      createLabel="+ New Log"
      emptyTitle="No compliance logs"
      emptyDescription="Record compliance events and audits here."
      searchKeys={["log_type", "reference", "description"]}
      filters={[
        {
          key: "status",
          label: "Status",
          placeholder: "All statuses",
          options: [
            { value: "completed", label: "Completed" },
            { value: "pending", label: "Pending" },
            { value: "failed", label: "Failed" },
          ],
        },
      ]}
      columns={[
        { key: "log_type", label: "Type" },
        { key: "reference", label: "Reference" },
        { key: "logged_at", label: "Logged At" },
        {
          key: "status",
          label: "Status",
          render: (r) => <StatusBadge status={r.status} />,
        },
        { key: "description", label: "Description" },
      ]}
      fields={[
        { name: "log_type", label: "Log Type", required: true },
        { name: "reference", label: "Reference" },
        { name: "logged_at", label: "Logged At", type: "datetime", required: true },
        {
          name: "status",
          label: "Status",
          type: "select",
          default: "completed",
          options: [
            { value: "completed", label: "Completed" },
            { value: "pending", label: "Pending" },
            { value: "failed", label: "Failed" },
          ],
        },
        { name: "description", label: "Description", type: "textarea", full: true },
      ]}
    />
    </InventoryPlanningShell>
  );
}
