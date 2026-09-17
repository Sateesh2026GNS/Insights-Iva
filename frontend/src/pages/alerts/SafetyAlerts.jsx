import { useState } from "react";
import AlertsDashboard from "./AlertsDashboard";
import Button from "../../components/common/Button";
import useAuth from "../../hooks/useAuth";
import { isOperator } from "../../config/permissions";
import OperatorSafetyQuickModal from "../../components/operator/OperatorSafetyQuickModal";

export default function SafetyAlerts() {
  const { user } = useAuth();
  const operator = isOperator(user);
  const [quickOpen, setQuickOpen] = useState(false);

  return (
    <>
      {operator && (
        <div className="mb-4 flex justify-end px-4 md:px-0">
          <Button type="button" variant="primary" onClick={() => setQuickOpen(true)}>
            Quick safety report
          </Button>
        </div>
      )}
      <AlertsDashboard
        title="Safety & Incident"
        subtitle="Report incidents and review safety-related alerts."
        initialAlertType="safety"
      />
      <OperatorSafetyQuickModal open={quickOpen} onClose={() => setQuickOpen(false)} />
    </>
  );
}
