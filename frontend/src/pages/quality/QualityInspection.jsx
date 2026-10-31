import { Link, useSearchParams } from "react-router-dom";
import ResourcePage from "../../components/common/ResourcePage";
import InventoryPlanningShell from "../../components/inventory/InventoryPlanningShell";
import { StatusBadge } from "../../components/common/Table";
import { getInspections, createInspection } from "../../api/qualityApi";

const INSPECTION_RESULT_FILTERS = ["pass", "fail", "rework"];

export default function QualityInspection() {
  const [params] = useSearchParams();
  const result = params.get("result") || "";
  const initialFilterValues = INSPECTION_RESULT_FILTERS.includes(result) ? { result } : null;

  return (
    <InventoryPlanningShell theme="orange" kicker="Inspect · Record · Release" title="INSPECTION" accent="RECORDS">
    <ResourcePage
      title="Quality Inspection"
      subtitle="Perform and record quality inspections."
      headerAction={(
        <Link
          to="/my-job-cards?dept=quality"
          className="inline-flex min-h-7 items-center justify-center rounded-sm border border-[#c5d0dc] bg-white px-3 text-[11px] font-bold text-[#1a1a1a] hover:bg-[#fff7ed] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#c2410c]"
        >
          Open Quality Check Queue
        </Link>
      )}
      fetcher={getInspections}
      createFn={createInspection}
      createLabel="+ New Inspection"
      openCreateOnMount={params.get("new") === "1"}
      initialFilterValues={initialFilterValues}
      emptyTitle="No inspections yet"
      emptyDescription="Record your first quality inspection."
      tableToolbarClassName="quality-inspection-toolbar"
      searchKeys={["inspection_number", "inspector", "result"]}
      filters={[
        {
          key: "result",
          label: "",
          placeholder: "All results",
          options: [
            { value: "pass", label: "Pass" },
            { value: "fail", label: "Fail" },
            { value: "rework", label: "Rework" },
          ],
        },
      ]}
      columns={[
        { key: "inspection_number", label: "Inspection #" },
        { key: "inspection_date", label: "Date" },
        {
          key: "result",
          label: "Result",
          render: (r) => <StatusBadge status={r.result} />,
        },
        { key: "inspector", label: "Inspector" },
        { key: "notes", label: "Notes" },
      ]}
      fields={[
        { name: "inspection_number", label: "Inspection Number", required: true },
        { name: "inspection_date", label: "Inspection Date", type: "date", required: true },
        {
          name: "result",
          label: "Result",
          type: "select",
          required: true,
          options: [
            { value: "pass", label: "Pass" },
            { value: "fail", label: "Fail" },
            { value: "rework", label: "Rework" },
          ],
        },
        { name: "inspector", label: "Inspector" },
        { name: "product_id", label: "Product ID", type: "number" },
        { name: "batch_id", label: "Batch ID", type: "number" },
        { name: "notes", label: "Notes", type: "textarea", full: true },
      ]}
    />
    </InventoryPlanningShell>
  );
}
