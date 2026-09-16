import { useNavigate, useSearchParams } from "react-router-dom";
import CreateProductionOrderModal from "../../components/production/CreateProductionOrderModal";

export default function CreateProduction() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const editId = searchParams.get("id");
  const initialOrder = editId
    ? {
        id: editId,
        product_no: searchParams.get("order_number") || searchParams.get("product_id") || "",
        operator_name: searchParams.get("operator_name") || "",
        operator_id: searchParams.get("operator_id") || "",
        planned_quantity: searchParams.get("planned_quantity") || "",
        size: searchParams.get("size") || "",
        priority: searchParams.get("priority") || "medium",
        shift: searchParams.get("shift") || "General Shift (9:00 AM – 6:00 PM)",
        status: searchParams.get("status") || "planned",
        machine_id: searchParams.get("machine_id") || "",
        start_date: searchParams.get("start_date") || "",
        due_date: searchParams.get("due_date") || "",
      }
    : null;

  return (
    <CreateProductionOrderModal
      open={true}
      onClose={() => navigate("/production/planning")}
      initialOrder={initialOrder}
      onSaved={(newOrder, meta) => {
        navigate("/production/planning", {
          state: meta?.isEdit ? {} : { createdOrder: newOrder },
        });
      }}
    />
  );
}