import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import Loader from "../../components/common/Loader";
import PageHeader from "../../components/common/PageHeader";
import { useToast } from "../../context/ToastContext";
import { getFeatureSetting, putFeatureSetting } from "../../api/bizDocumentsApi";
import { apiErrorMessage } from "../../utils/apiError";

import { SettingsFeatureShell } from "./settingsUi";

const SETTING_KEY = "sequence_reset";

/** Indian FY options: previous + current (Apr–Mar). */
function buildFyOptions(date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const currentStart = month >= 3 ? year : year - 1;
  return [currentStart - 1, currentStart].map((startYear) => {
    const endYear = startYear + 1;
    const id = `${startYear}-${String(endYear).slice(-2)}`;
    return {
      id,
      label: `FY ${id}`,
      range: `1 April ${startYear} - 31 March ${endYear}`,
    };
  });
}

function ConfirmFyModal({ open, fy, busy, onCancel, onConfirm }) {
  const titleId = useId();
  const confirmRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape" && !busy) onCancel?.();
    };
    document.addEventListener("keydown", onKey);
    confirmRef.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [open, busy, onCancel]);

  if (!open || !fy || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/40 p-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel?.();
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-[420px] rounded-2xl bg-white px-8 py-8 shadow-2xl dark:bg-slate-800 dark:border dark:border-slate-700"
      >
        <h2 id={titleId} className="text-[22px] font-bold leading-snug text-slate-900 dark:text-white">
          Change sequence number to {fy.label}?
        </h2>
        <p className="mt-3 text-[14px] leading-relaxed text-slate-600 dark:text-slate-300">
          The updated sequence number will apply to all new documents. Existing or old documents
          will not be changed.
        </p>
        <div className="mt-8 flex flex-col gap-3">
          <button
            ref={confirmRef}
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className="w-full rounded-xl px-4 py-3.5 text-[15px] font-semibold text-white hover:brightness-95 disabled:opacity-60 bg-[var(--color-primary)] dark:bg-teal-600"
          >
            {busy ? "Saving…" : `Change to ${fy.label}`}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="w-full rounded-xl bg-slate-100 px-4 py-3.5 text-[15px] font-semibold text-slate-700 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600 disabled:opacity-60"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function SequenceResetSettingV2() {
  const { addToast } = useToast();
  const fyOptions = useMemo(() => buildFyOptions(), []);
  const defaultFy = fyOptions[fyOptions.length - 1]?.id || "2026-27";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedFy, setSelectedFy] = useState(defaultFy);
  const [pendingFy, setPendingFy] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await getFeatureSetting(SETTING_KEY);
        const value = res.data?.value;
        let next = defaultFy;
        if (typeof value === "string" && value) next = value;
        else if (value && typeof value === "object") {
          next = value.financial_year || value.fy || defaultFy;
        }
        if (!fyOptions.some((f) => f.id === next)) next = defaultFy;
        if (!cancelled) setSelectedFy(next);
      } catch {
        if (!cancelled) setSelectedFy(defaultFy);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [defaultFy, fyOptions]);

  const persist = useCallback(
    async (fyId) => {
      const fy = fyOptions.find((f) => f.id === fyId);
      setSaving(true);
      try {
        await putFeatureSetting(SETTING_KEY, {
          financial_year: fyId,
          label: fy?.label || `FY ${fyId}`,
          range: fy?.range || "",
          updated_at: new Date().toISOString(),
        });
        setSelectedFy(fyId);
        setPendingFy(null);
        addToast("Sequence reset successfully", "success");
      } catch (err) {
        addToast(apiErrorMessage(err, "Failed to reset sequence"), "error");
      } finally {
        setSaving(false);
      }
    },
    [addToast, fyOptions]
  );

  const onPick = (fy) => {
    if (saving) return;
    if (fy.id === selectedFy) return;
    setPendingFy(fy);
  };

  if (loading) {
    return (
      <SettingsFeatureShell>
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader label="Loading sequence settings…" />
        </div>
      </SettingsFeatureShell>
    );
  }

  return (
    <SettingsFeatureShell>
      <PageHeader
        title="Sequence Reset Setting"
        subtitle="Set the active financial year sequence for generating new document numbers"
        backTo="/settings"
        backLabel="Back to Settings"
        showTitle
      />
      <div className="ui-card px-5 py-6 sm:px-8 sm:py-7">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 max-w-md">
            <h2 className="text-[17px] font-bold text-[var(--color-text)]">Reset sequence number</h2>
            <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--color-text-muted)]">
              Pick the financial year whose sequence number new documents should follow.
            </p>
          </div>

          <div className="flex flex-wrap gap-3" role="radiogroup" aria-label="Financial year for sequence">
            {fyOptions.map((fy) => {
              const selected = selectedFy === fy.id;
              return (
                <button
                  key={fy.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  disabled={saving}
                  onClick={() => onPick(fy)}
                  className={`min-w-[200px] rounded-xl border bg-[var(--color-surface)] px-5 py-4 text-left transition-colors disabled:opacity-60 ${
                    selected
                      ? "border-[var(--color-primary)] shadow-sm ring-1 ring-[var(--color-primary)]"
                      : "border-[var(--color-border)] hover:border-[var(--color-primary)]/40"
                  }`}
                >
                  <div className="text-[15px] font-bold text-[var(--color-text)]">{fy.label}</div>
                  <div className="mt-1 text-[12px] text-[var(--color-text-muted)]">{fy.range}</div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <ConfirmFyModal
        open={Boolean(pendingFy)}
        fy={pendingFy}
        busy={saving}
        onCancel={() => !saving && setPendingFy(null)}
        onConfirm={() => pendingFy && persist(pendingFy.id)}
      />
    </SettingsFeatureShell>
  );
}
