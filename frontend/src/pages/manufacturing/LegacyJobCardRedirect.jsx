import { Navigate, useSearchParams } from "react-router-dom";
import { useEffect, useState } from "react";

import Loader from "../../components/common/Loader";
import { getJobCard } from "../../api/productionApi";

/**
 * Legacy /production/job-card → unified manufacturing workflow.
 * Resolves ?id= work-order links to the operator stage when a sales order is linked.
 */
export default function LegacyJobCardRedirect() {
  const [searchParams] = useSearchParams();
  const woId = searchParams.get("id");
  const [target, setTarget] = useState(null);

  useEffect(() => {
    if (!woId) {
      setTarget("/manufacturing/workflow");
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await getJobCard(woId);
        const data = res?.data ?? res;
        const soId =
          data?.sales_order_id ??
          data?.header?.sales_order_id ??
          data?.summary?.sales_order_id;
        if (!cancelled) {
          if (soId) {
            setTarget(`/manufacturing/workflow/order/${soId}/operator`);
          } else {
            setTarget("/production/operator-jobs");
          }
        }
      } catch {
        if (!cancelled) setTarget("/manufacturing/workflow");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [woId]);

  if (!target) return <Loader label="Redirecting to workflow…" />;
  return <Navigate to={target} replace />;
}
