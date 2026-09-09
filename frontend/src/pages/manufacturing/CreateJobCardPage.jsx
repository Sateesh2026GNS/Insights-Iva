import ManualSalesJobCardForm from "../../components/manufacturing/ManualSalesJobCardForm";

/** Manual Sales Job Card create — fully user-entered form. */
export default function CreateJobCardPage() {
  return <ManualSalesJobCardForm backTo="/my-job-cards?dept=sales" />;
}
