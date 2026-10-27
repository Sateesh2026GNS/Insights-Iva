import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

import SalesJobCardDocumentPanel from "../../components/manufacturing/SalesJobCardDocumentPanel";
import SendJobCardModal from "../../components/manufacturing/SendJobCardModal";
import useAuth from "../../hooks/useAuth";
import { userCanAction, userCanCreateSalesJobCard } from "../../config/permissions";
import { jobCardManualEditUrl } from "../../utils/jobCardRoutes";
import "../../styles/my-job-cards-page.css";
import "../../styles/manufacturing-toolkit.css";
import "../../styles/sales-job-card-toolkit.css";

export default function ViewManualJobCardPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [sendTarget, setSendTarget] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const canEdit =
    userCanAction(user, "sales", "update") || userCanCreateSalesJobCard(user);
  const listPath = "/my-job-cards?dept=sales";

  return (
    <div className="sales-jc-toolkit mtk-root mtk-theme--green my-job-cards-page">
      <header className="mtk-hero">
        <div className="mtk-hero__row">
          <button
            type="button"
            onClick={() => navigate(listPath)}
            className="inline-flex items-center gap-1 text-white"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Sales · Job Cards
          </button>
        </div>
        <div className="mtk-hero__title">
          <h1>
            View <span className="mtk-accent">Sales Job Card</span>
          </h1>
        </div>
      </header>
      <div className="mtk-body">
      <SalesJobCardDocumentPanel
        key={`${id}-${reloadKey}`}
        jobCardId={id}
        listPath={listPath}
        canEdit={canEdit}
        onEdit={() => navigate(jobCardManualEditUrl(id))}
        onSend={(card) => setSendTarget({ ...card, job_card_id: card.job_card_id || id })}
        showToolbarSendButton={false}
        showEmptyShell={false}
      />
      <SendJobCardModal
        open={Boolean(sendTarget)}
        jobCard={sendTarget}
        onClose={() => setSendTarget(null)}
        onSent={() => setReloadKey((current) => current + 1)}
      />
      </div>
    </div>
  );
}
