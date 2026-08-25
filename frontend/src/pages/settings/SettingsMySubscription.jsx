import { useCallback, useEffect, useState } from "react";
import usePageRefresh from "../../hooks/usePageRefresh";
import { Info, Check, Eye, Phone, GitCompare, X } from "lucide-react";

import { useToast } from "../../context/ToastContext";
import {
  activateTrial,
  contactSales,
  getSubscription,
  getSubscriptionPlan,
} from "../../api/settingsApi";

const FALLBACK_PLANS = [
  { id: "free", name: "FREE", price: "₹0", billing: null },
  { id: "growth", name: "GROWTH", price: "₹36,000", billing: "Billed Quarterly Only" },
  { id: "scale", name: "SCALE", price: "₹1,50,000", billing: "Billed Annually Only" },
  { id: "dominate", name: "DOMINATE", price: "₹3,60,000", billing: "Billed Annually Only" },
];

const FREE_PLAN_FEATURES = [
  "Advanced Lead Management",
  "Inventory History",
  "30 Transaction/Month",
  "10+ Reports and Business Intelligence",
];

function formatExpiry(iso) {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return null;
  }
}

function getRemainingDays(expiryIso) {
  if (!expiryIso) return null;
  try {
    const expiry = new Date(expiryIso);
    if (Number.isNaN(expiry.getTime())) return null;
    const now = new Date();
    const diffMs = expiry.getTime() - now.getTime();
    return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  } catch {
    return null;
  }
}

function Modal({ open, title, onClose, children, wide }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <div
        className={`max-h-[90vh] w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-800 ${
          wide ? "max-w-3xl" : "max-w-lg"
        }`}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3 dark:border-slate-700">
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export default function SettingsMySubscription() {
  const { addToast } = useToast();
  const [showDetails, setShowDetails] = useState(true);
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState(false);
  const [submittingContact, setSubmittingContact] = useState(false);
  const [subscription, setSubscription] = useState(null);
  const [plans, setPlans] = useState(FALLBACK_PLANS);
  const [viewPlan, setViewPlan] = useState(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [showCompare, setShowCompare] = useState(false);
  const [showContact, setShowContact] = useState(false);
  const [contactMessage, setContactMessage] = useState("");
  const [contactPlan, setContactPlan] = useState("");

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const res = await getSubscription();
      const data = res.data;
      if (data) {
        setSubscription(data);
        if (Array.isArray(data.plans) && data.plans.length) {
          setPlans(data.plans);
        }
      }
    } catch (e) {
      if (!isRefresh) {
        addToast(e.response?.data?.detail || e.response?.data?.message || "Failed to load subscription", "error");
      }
      if (isRefresh) throw e;
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  usePageRefresh(() => load(true));

  useEffect(() => {
    load();
  }, [load]);

  const trialActive = Boolean(subscription?.trial_active);
  const canActivate = Boolean(subscription?.can_activate_trial);
  const activePlanName = subscription?.plan_name || subscription?.subscription_plan || "Free Plan";
  const activePrice = subscription?.price || "₹0";
  const activeBilling = subscription?.billing_label || "Free forever";
  const activeFeatures = subscription?.features?.length ? subscription.features : FREE_PLAN_FEATURES;
  const expiryLabel = formatExpiry(subscription?.trial_expires_at);

  // Trial day calculations
  const totalDays = subscription?.trial_days || 7;
  const remainingDays = trialActive ? getRemainingDays(subscription?.trial_expires_at) : null;
  const completedDays = remainingDays !== null ? Math.max(0, totalDays - remainingDays) : null;
  const progressPct = remainingDays !== null ? Math.min(100, Math.round((completedDays / totalDays) * 100)) : 0;
  const isExpiringSoon = trialActive && remainingDays !== null && remainingDays <= 2;

  const handleActivateTrial = async () => {
    if (!canActivate || activating) return;
    setActivating(true);
    try {
      const res = await activateTrial();
      if (res.data) setSubscription(res.data);
      addToast(res.message || "Trial activated successfully", "success");
      await load();
    } catch (e) {
      addToast(e.response?.data?.detail || e.response?.data?.message || "Failed to activate trial", "error");
    } finally {
      setActivating(false);
    }
  };

  const handleViewPlan = async (planId) => {
    setViewLoading(true);
    setViewPlan(null);
    try {
      const res = await getSubscriptionPlan(planId);
      setViewPlan(res.data || plans.find((p) => p.id === planId) || null);
    } catch (e) {
      const fallback = plans.find((p) => p.id === planId);
      if (fallback) setViewPlan(fallback);
      else addToast(e.response?.data?.detail || "Failed to load plan details", "error");
    } finally {
      setViewLoading(false);
    }
  };

  const handleContactSubmit = async (e) => {
    e.preventDefault();
    setSubmittingContact(true);
    try {
      const res = await contactSales({
        message: contactMessage.trim() || undefined,
        preferred_plan: contactPlan || undefined,
      });
      addToast(res.message || res.data?.message || "Your request was sent. Our team will contact you shortly.", "success");
      setShowContact(false);
      setContactMessage("");
      setContactPlan("");
    } catch (err) {
      addToast(err.response?.data?.detail || "Failed to submit request", "error");
    } finally {
      setSubmittingContact(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl">
      {/* Page header */}
      <div className="mb-6 flex items-center gap-2">
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
          My Subscription
        </h1>
        <Info className="h-4 w-4 text-slate-400" />
      </div>

      {/* Free Trial Banner */}
      <div
        className={`mb-6 rounded-xl border p-6 ${
          isExpiringSoon
            ? "border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/20"
            : "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20"
        }`}
      >
        {/* Expiring Soon Warning */}
        {isExpiringSoon && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-400 bg-amber-100 px-4 py-2.5 text-amber-800 dark:border-amber-600 dark:bg-amber-900/40 dark:text-amber-300">
            <span className="text-lg">⚠️</span>
            <span className="text-sm font-semibold">
              Expiring Soon — only {remainingDays} {remainingDays === 1 ? "day" : "days"} remaining!
            </span>
          </div>
        )}

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex-1">
            {/* Header */}
            <h2
              className={`text-lg font-semibold ${
                isExpiringSoon
                  ? "text-amber-800 dark:text-amber-400"
                  : "text-green-800 dark:text-green-400"
              }`}
            >
              Free Trial ({totalDays} days total)
            </h2>

            {/* Detail line */}
            {trialActive && expiryLabel ? (
              <p
                className={`mt-1 text-sm ${
                  isExpiringSoon
                    ? "text-amber-700 dark:text-amber-500"
                    : "text-green-700 dark:text-green-500"
                }`}
              >
                Trial is active: <strong>{completedDays}</strong> of <strong>{totalDays}</strong> days
                completed &mdash;&nbsp;
                <strong>
                  {remainingDays} {remainingDays === 1 ? "day" : "days"} remaining
                </strong>{" "}
                until expiry on <strong>{expiryLabel}</strong>.
              </p>
            ) : (
              <p className="mt-1 text-sm text-green-700 dark:text-green-500">
                Unlock all the features on Insights Iva with just one click!
              </p>
            )}

            {/* Progress Bar */}
            {trialActive && remainingDays !== null && (
              <div className="mt-4">
                <div className="mb-1 flex items-center justify-between text-xs font-medium">
                  <span className={isExpiringSoon ? "text-amber-700 dark:text-amber-400" : "text-green-700 dark:text-green-400"}>
                    {completedDays} {completedDays === 1 ? "day" : "days"} used
                  </span>
                  <span className={isExpiringSoon ? "text-amber-700 dark:text-amber-400" : "text-green-700 dark:text-green-400"}>
                    {remainingDays} {remainingDays === 1 ? "day" : "days"} left
                  </span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/60 ring-1 ring-black/5 dark:bg-black/20">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      isExpiringSoon ? "bg-amber-500" : "bg-green-500"
                    }`}
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <p className={`mt-1 text-right text-[11px] ${
                  isExpiringSoon ? "text-amber-600 dark:text-amber-400" : "text-green-600 dark:text-green-400"
                }`}>
                  {progressPct}% of trial period elapsed
                </p>
              </div>
            )}
          </div>

          {/* Button */}
          <button
            type="button"
            onClick={handleActivateTrial}
            disabled={!canActivate || activating || loading}
            className={`shrink-0 self-start rounded-lg px-5 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60 ${
              isExpiringSoon
                ? "bg-amber-600 hover:bg-amber-700"
                : "bg-green-600 hover:bg-green-700"
            }`}
          >
            {activating ? "Activating…" : trialActive ? "Trial Active" : "Activate Trial"}
          </button>
        </div>
      </div>

      {/* Currently Active Plan */}
      <div className="mb-8 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800/50">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Check className="h-5 w-5 text-green-600" />
            <span className="text-sm font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
              Currently Active
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowDetails(!showDetails)}
            className="text-sm text-teal-600 hover:underline dark:text-teal-400"
          >
            {showDetails ? "Hide Details" : "Show Details"}
          </button>
        </div>
        {showDetails && (
          <>
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {loading ? "Loading…" : `${activePlanName} (${activePrice}/year)`}
              </h3>
              <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700 dark:bg-green-900/40 dark:text-green-400">
                {activeBilling}
              </span>
            </div>
            <ul className="space-y-2">
              {activeFeatures.map((feature) => (
                <li key={feature} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                  <Check className="h-4 w-4 shrink-0 text-green-600" />
                  {feature}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {/* Compare Plans and Pricing */}
      <h2 id="compare-plans" className="mb-4 text-base font-semibold text-slate-800 dark:text-slate-100">
        Compare Plans and Pricing
      </h2>
      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {plans.map((plan) => (
          <div
            key={plan.id}
            className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800/50"
          >
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
              {plan.name}
            </p>
            <p className="mt-2 text-xl font-bold text-slate-900 dark:text-slate-100">
              {plan.price}
            </p>
            {(plan.billing || plan.billing_label) && (
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-500">
                {plan.billing || plan.billing_label}
              </p>
            )}
            <button
              type="button"
              onClick={() => handleViewPlan(plan.id)}
              disabled={viewLoading}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-700/50"
              title={`View ${plan.name} details`}
            >
              <Eye className="h-4 w-4" />
              View
            </button>
          </div>
        ))}
      </div>

      {/* Bottom action buttons */}
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => setShowContact(true)}
          className="flex items-center gap-2 rounded-lg bg-green-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-green-700"
        >
          <Phone className="h-4 w-4" />
          Talk to an expert
        </button>
        <button
          type="button"
          onClick={() => {
            setShowCompare(true);
            document.getElementById("compare-plans")?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
          className="flex items-center gap-2 rounded-lg bg-green-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-green-800"
        >
          <GitCompare className="h-4 w-4" />
          Compare All Plans
        </button>
      </div>

      {/* Plan details modal */}
      <Modal
        open={Boolean(viewPlan) || viewLoading}
        title={viewPlan ? `${viewPlan.name} plan` : "Plan details"}
        onClose={() => setViewPlan(null)}
      >
        {viewLoading && !viewPlan ? (
          <p className="text-sm text-slate-500">Loading plan…</p>
        ) : viewPlan ? (
          <div className="space-y-4">
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{viewPlan.price}</p>
              <p className="ui-subtitle">
                {viewPlan.billing_label || viewPlan.billing || (viewPlan.billing_cycle === "forever" ? "Free forever" : viewPlan.billing_cycle)}
              </p>
            </div>
            <ul className="space-y-2">
              {(viewPlan.features || []).map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                  <Check className="h-4 w-4 shrink-0 text-green-600" />
                  {f}
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setContactPlan(viewPlan.id);
                  setViewPlan(null);
                  setShowContact(true);
                }}
                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
              >
                Talk to an expert
              </button>
              <button
                type="button"
                onClick={() => setViewPlan(null)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300"
              >
                Close
              </button>
            </div>
          </div>
        ) : null}
      </Modal>

      {/* Compare all plans modal */}
      <Modal open={showCompare} title="Compare All Plans" onClose={() => setShowCompare(false)} wide>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="ui-table-head">
              <tr>
                <th className="px-3 py-2 font-semibold text-slate-700 dark:text-slate-200">Feature</th>
                {plans.map((p) => (
                  <th key={p.id} className="px-3 py-2 font-semibold text-slate-700 dark:text-slate-200">
                    {p.name}
                    <div className="text-xs font-normal text-slate-500">{p.price}</div>
                    <div className="text-[11px] font-normal text-slate-400">{p.billing || p.billing_label || "—"}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from(
                new Set(plans.flatMap((p) => p.features || []))
              ).map((feature) => (
                <tr key={feature} className="border-b border-slate-100 dark:border-slate-700">
                  <td className="px-3 py-2 text-slate-700 dark:text-slate-300">{feature}</td>
                  {plans.map((p) => (
                    <td key={p.id} className="px-3 py-2 text-center">
                      {(p.features || []).includes(feature) ? (
                        <Check className="mx-auto h-4 w-4 text-green-600" />
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Modal>

      {/* Contact sales dialog */}
      <Modal open={showContact} title="Talk to an expert" onClose={() => setShowContact(false)}>
        <form onSubmit={handleContactSubmit} className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Tell us what you need. We’ll reach out using your account email.
          </p>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Preferred plan</label>
            <select
              value={contactPlan}
              onChange={(e) => setContactPlan(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
            >
              <option value="">Any / not sure</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Message</label>
            <textarea
              value={contactMessage}
              onChange={(e) => setContactMessage(e.target.value)}
              rows={4}
              placeholder="I want to discuss upgrading my plan…"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
            />
          </div>
          <button
            type="submit"
            disabled={submittingContact}
            className="w-full rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60"
          >
            {submittingContact ? "Sending…" : "Submit request"}
          </button>
        </form>
      </Modal>
    </div>
  );
}
