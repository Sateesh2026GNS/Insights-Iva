import { useState } from "react";
import { CheckCircle2, MessageSquare, RotateCcw } from "lucide-react";

import Button from "../common/Button";
import ConfirmDialog from "../admin/ConfirmDialog";
import {
  acknowledgeManualJobCard,
  addManualStoreComment,
  returnManualJobCardToSales,
} from "../../api/workflowApi";
import { apiErrorMessage } from "../../utils/apiError";
import { useToast } from "../../context/ToastContext";

export default function StoreManualJobCardActions({
  jobCardId,
  card,
  onUpdated,
  allowedActions = [],
}) {
  const { addToast } = useToast();
  const [ackLoading, setAckLoading] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [returnRemarks, setReturnRemarks] = useState("");
  const [returnLoading, setReturnLoading] = useState(false);
  const [commentOpen, setCommentOpen] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [commentLoading, setCommentLoading] = useState(false);

  const actions = new Set(allowedActions);
  const storeWf = card?.store_workflow || {};
  const acknowledged = Boolean(storeWf.acknowledged);
  const comments = Array.isArray(storeWf.store_comments) ? storeWf.store_comments : [];
  const materialReqs = Array.isArray(card?.material_requirements) ? card.material_requirements : [];

  const handleAcknowledge = async () => {
    if (!jobCardId || ackLoading) return;
    setAckLoading(true);
    try {
      await acknowledgeManualJobCard(jobCardId);
      addToast("Job card acknowledged", "success");
      onUpdated?.();
    } catch (err) {
      addToast(apiErrorMessage(err, "Could not acknowledge job card."), "error");
    } finally {
      setAckLoading(false);
    }
  };

  const handleReturn = async () => {
    if (!jobCardId || returnLoading) return;
    setReturnLoading(true);
    try {
      await returnManualJobCardToSales(jobCardId, { remarks: returnRemarks });
      addToast("Job card returned to Sales", "success");
      setReturnOpen(false);
      setReturnRemarks("");
      onUpdated?.();
    } catch (err) {
      addToast(apiErrorMessage(err, "Could not return job card to Sales."), "error");
    } finally {
      setReturnLoading(false);
    }
  };

  const handleComment = async () => {
    if (!jobCardId || commentLoading || !commentText.trim()) return;
    setCommentLoading(true);
    try {
      await addManualStoreComment(jobCardId, { comment: commentText.trim() });
      addToast("Store comment added", "success");
      setCommentOpen(false);
      setCommentText("");
      onUpdated?.();
    } catch (err) {
      addToast(apiErrorMessage(err, "Could not add comment."), "error");
    } finally {
      setCommentLoading(false);
    }
  };

  if (!jobCardId) return null;

  return (
    <div className="store-manual-jc-actions">
      <div className="store-manual-jc-actions__toolbar">
        {actions.has("acknowledge") && !acknowledged ? (
          <Button
            variant="primary"
            size="sm"
            loading={ackLoading}
            onClick={handleAcknowledge}
            leftIcon={<CheckCircle2 className="h-4 w-4" aria-hidden />}
          >
            Acknowledge
          </Button>
        ) : null}
        {acknowledged ? (
          <span className="store-manual-jc-actions__reviewed">
            Reviewed by {storeWf.acknowledged_by || "—"}
            {storeWf.acknowledged_at ? ` · ${new Date(storeWf.acknowledged_at).toLocaleString()}` : ""}
          </span>
        ) : null}
        {actions.has("add_store_comments") ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCommentOpen(true)}
            leftIcon={<MessageSquare className="h-4 w-4" aria-hidden />}
          >
            Add Store Comment
          </Button>
        ) : null}
        {actions.has("return_to_sales") ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setReturnOpen(true)}
            leftIcon={<RotateCcw className="h-4 w-4" aria-hidden />}
          >
            Return to Sales
          </Button>
        ) : null}
      </div>

      {actions.has("view_material_requirement") && materialReqs.length > 0 ? (
        <div className="store-manual-jc-actions__materials">
          <h3 className="store-manual-jc-actions__subtitle">Material / Production Information</h3>
          <div className="ui-table-wrap">
            <table className="ui-table ui-table--compact">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Quantity</th>
                  <th>UOM</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                {materialReqs.map((row) => (
                  <tr key={row.line_no}>
                    <td>{row.product_name || "—"}</td>
                    <td>{row.quantity ?? "—"}</td>
                    <td>{row.uom || "—"}</td>
                    <td>{row.description || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="store-manual-jc-actions__hint">
            Inventory is not deducted automatically. Use Material Issue when stock is confirmed.
          </p>
        </div>
      ) : null}

      {comments.length > 0 ? (
        <div className="store-manual-jc-actions__comments">
          <h3 className="store-manual-jc-actions__subtitle">Store Comments</h3>
          <ul className="store-manual-jc-actions__comment-list">
            {comments.map((c, i) => (
              <li key={`${c.at}-${i}`}>
                <strong>{c.by || "Store"}</strong>
                {c.at ? ` · ${new Date(c.at).toLocaleString()}` : ""}
                <p>{c.text}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <ConfirmDialog
        open={returnOpen}
        title="Return to Sales"
        description="Sales-originated information will remain unchanged. Sales can correct and resubmit."
        confirmLabel="Return to Sales"
        confirmVariant="danger"
        loading={returnLoading}
        onConfirm={handleReturn}
        onCancel={() => setReturnOpen(false)}
      >
        <label className="ui-field">
          <span className="ui-field__label">Remarks for Sales</span>
          <textarea
            className="ui-input"
            rows={3}
            value={returnRemarks}
            onChange={(e) => setReturnRemarks(e.target.value)}
            placeholder="Describe what needs correction…"
          />
        </label>
      </ConfirmDialog>

      <ConfirmDialog
        open={commentOpen}
        title="Add Store Comment"
        description="Internal note for store / production planning."
        confirmLabel="Save Comment"
        loading={commentLoading}
        onConfirm={handleComment}
        onCancel={() => setCommentOpen(false)}
      >
        <label className="ui-field">
          <span className="ui-field__label">Comment</span>
          <textarea
            className="ui-input"
            rows={3}
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="Material availability, handling notes…"
          />
        </label>
      </ConfirmDialog>
    </div>
  );
}
