import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Send, Share2, Users, X } from "lucide-react";
import api from "../../api/axiosConfig";
import { shareDocumentNotification } from "../../api/notificationService";
import { useToast } from "../../context/ToastContext";
import { apiErrorMessage } from "../../utils/apiError";

export default function ShareToSalesTeamModal({
  open,
  onClose,
  docType = "quotation",
  docNo = "",
  docId = "",
  buyerName = "",
  grandTotal = null,
}) {
  const { addToast } = useToast();
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [customMessage, setCustomMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [activeTab, setActiveTab] = useState("sales"); // "sales" | "all"

  const docLabel = docType === "quotation" ? "Quotation" : "Tax Invoice";
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const targetActionUrl = docType === "quotation"
    ? (docId ? `/sales/quotations/${docId}` : "/sales/quotations")
    : (docId ? `/sales/invoices/${docId}/copy` : "/sales/invoices");
  const documentUrl = `${origin}${targetActionUrl}`;

  // Fetch company users when modal opens
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoadingUsers(true);

    const loadUsers = async () => {
      try {
        let res = null;
        try {
          res = await api.get("/api/notifications/recipients");
        } catch {
          try {
            res = await api.get("/api/team-directory");
          } catch {
            res = await api.get("/team-directory");
          }
        }

        if (cancelled) return;
        const list = Array.isArray(res?.data)
          ? res.data
          : (res?.data?.data && Array.isArray(res.data.data) ? res.data.data : []);

        setUsers(list);
        setSelectedUserIds([]);
      } catch {
        if (!cancelled) setUsers([]);
      } finally {
        if (!cancelled) setLoadingUsers(false);
      }
    };

    loadUsers();

    return () => {
      cancelled = true;
    };
  }, [open]);

  // Filtered users according to active tab (excluding HR / HR Manager users)
  const displayedUsers = useMemo(() => {
    const nonHrUsers = users.filter((u) => {
      const role = String(u.role || "").toLowerCase().trim();
      const desig = String(u.designation || "").toLowerCase().trim();
      const dept = String(u.department || "").toLowerCase().trim();

      const isHr =
        role === "hr" ||
        role === "hr_manager" ||
        role.includes("hr_manager") ||
        role.includes("hr manager") ||
        role.includes("human resource") ||
        desig.includes("hr manager") ||
        desig.includes("human resource") ||
        desig === "hr" ||
        dept === "hr" ||
        dept === "human resources" ||
        dept.includes("human resource");

      return !isHr;
    });

    if (activeTab === "sales") {
      const salesFiltered = nonHrUsers.filter((u) => {
        const text = `${u.role || ""} ${u.designation || ""} ${u.department || ""}`.toLowerCase();
        return text.includes("sales");
      });
      return salesFiltered.length > 0 ? salesFiltered : nonHrUsers;
    }
    return nonHrUsers;
  }, [users, activeTab]);

  if (!open) return null;

  const defaultMsg =
    customMessage.trim() ||
    `Please review ${docLabel} ${docNo || ""}${buyerName ? ` for ${buyerName}` : ""}${
      grandTotal != null ? ` (Total: ₹${Number(grandTotal).toLocaleString("en-IN")})` : ""
    }.`;

  const toggleUser = (userId) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const selectAllDisplayed = () => {
    setSelectedUserIds(displayedUsers.map((u) => u.id));
  };

  const handleSend = async (e) => {
    e?.preventDefault?.();
    if (selectedUserIds.length === 0) {
      addToast("Please select at least one user.", "error");
      return;
    }
    setSending(true);
    try {
      await shareDocumentNotification({
        title: `${docLabel} ${docNo || ""} Shared`,
        message: defaultMsg,
        document_type: docType,
        document_number: docNo,
        action_url: targetActionUrl,
        recipient_role: "sales_manager",
        user_ids: selectedUserIds,
      });

      addToast(`${docLabel} ${docNo || ""} shared successfully with Sales Manager!`, "success");
      onClose();
    } catch (err) {
      addToast(apiErrorMessage(err, "Failed to share notification"), "error");
    } finally {
      setSending(false);
    }
  };

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs overflow-y-auto">
      <div className="relative my-auto flex max-h-[calc(100vh-2rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-emerald-50 via-teal-50 to-cyan-50 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm shrink-0">
              <Share2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 leading-tight">Share to Sales Manager</h3>
              <p className="text-xs text-slate-500 mt-0.5">Select Sales Manager or team to receive instant notification</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {/* Document Summary Card */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 text-xs text-emerald-950">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5 font-bold">
                <span className="text-emerald-700">{docLabel}:</span>
                <span className="text-slate-900">{docNo || "New Document"}</span>
              </div>
              {buyerName ? (
                <div className="text-[11px] text-emerald-800">
                  <span className="font-semibold">Buyer:</span> {buyerName}
                </div>
              ) : null}
            </div>
            {grandTotal != null ? (
              <div className="rounded-lg bg-emerald-600 px-2.5 py-1 font-bold text-white shadow-xs">
                ₹{Number(grandTotal).toLocaleString("en-IN")}
              </div>
            ) : null}
          </div>

          {/* User Checklist Selection */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab("sales")}
                  className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                    activeTab === "sales"
                      ? "bg-emerald-600 text-white shadow-xs"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  Sales Manager
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("all")}
                  className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                    activeTab === "all"
                      ? "bg-emerald-600 text-white shadow-xs"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  All Users
                </button>
              </div>

              <button
                type="button"
                onClick={selectAllDisplayed}
                className="text-[11px] font-semibold text-emerald-700 hover:underline"
              >
                Select All ({displayedUsers.length})
              </button>
            </div>

            {loadingUsers ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-xs text-slate-500">
                Loading Sales Managers...
              </div>
            ) : displayedUsers.length > 0 ? (
              <div className="max-h-48 space-y-1.5 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/50 p-2">
                {displayedUsers.map((u) => {
                  const isChecked = selectedUserIds.includes(u.id);
                  return (
                    <label
                      key={u.id}
                      onClick={() => toggleUser(u.id)}
                      className={`flex cursor-pointer items-center justify-between rounded-lg border px-3 py-2 text-xs transition ${
                        isChecked
                          ? "border-emerald-500 bg-emerald-50/80 text-emerald-950 font-medium shadow-xs"
                          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                        />
                        <div className="truncate">
                          <span className="font-bold text-slate-900">{u.full_name || u.name || u.email}</span>
                          {u.email && (
                            <span className="ml-1 text-[11px] text-slate-500 font-normal truncate">({u.email})</span>
                          )}
                        </div>
                      </div>
                      <span className="ml-2 shrink-0 rounded bg-emerald-100/70 text-emerald-900 px-2 py-0.5 text-[10px] font-bold border border-emerald-300 uppercase">
                        {u.role || u.designation || u.department || "Sales"}
                      </span>
                    </label>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center text-xs text-slate-500">
                No Sales Manager users found.
              </div>
            )}
          </div>

          {/* Custom Notification Note */}
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-600">
              Notification Message / Note
            </label>
            <textarea
              rows={2}
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              placeholder={`e.g. Please check and review ${docLabel} ${docNo || ""} for processing...`}
              className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-800 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 flex items-center justify-between border-t border-slate-100 bg-slate-50 px-5 py-3.5">
          <div className="text-[11px] text-slate-500">
            Selected: <span className="font-bold text-slate-800">{selectedUserIds.length} recipient(s)</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={sending}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSend}
              disabled={sending || selectedUserIds.length === 0}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 transition disabled:opacity-60"
            >
              <Send className="h-3.5 w-3.5" />
              {sending ? "Sending Notification…" : "Send Notification"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return typeof document !== "undefined" ? createPortal(modalContent, document.body) : modalContent;
}
