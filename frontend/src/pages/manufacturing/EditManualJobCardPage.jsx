import { useParams } from "react-router-dom";

import ManualSalesJobCardForm from "../../components/manufacturing/ManualSalesJobCardForm";

/** Manual Sales Job Card edit. */
export default function EditManualJobCardPage() {
  const { id } = useParams();
  return <ManualSalesJobCardForm jobCardId={id} backTo="/my-job-cards?dept=sales" />;
}
