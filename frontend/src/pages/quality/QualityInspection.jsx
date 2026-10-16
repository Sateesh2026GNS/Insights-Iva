import { Link } from "react-router-dom";
import ResourcePage from "../../components/common/ResourcePage";
import { StatusBadge } from "../../components/common/Table";
import { getInspections, createInspection } from "../../api/qualityApi";

export default function QualityInspection() {
  return (
    <ResourcePage
      title="Quality Inspection"
      subtitle="Perform and record quality inspections."
      headerAction={(
        <Link
          to="/my-job-cards?dept=quality"
          className="inline-flex min-h-10 items-center justify-center rounded-lg border border-white/70 bg-white/10 px-4 text-sm font-semibold text-white transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          Open Quality Check Queue
        </Link>
      )}
      fetcher={getInspections}
      createFn={createInspection}
      createLabel="+ New Inspection"
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
  );
}
