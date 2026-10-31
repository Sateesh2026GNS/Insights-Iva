import { useCallback, useEffect, useState } from "react";

import { toolkitError } from "../../api/godownToolkitApi";
import { useToast } from "../../context/ToastContext";

export function ToolkitPage({ title, subtitle, children }) {
  return (
    <div className="gsp">
      <header className="gsp-hero">
        <div className="gsp-hero__title">
          <h1>{title}</h1>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
      </header>
      <p className="gsp-kicker">SPACE · STOCK · REORDER · RENT · HAMALI · DISPATCH</p>
      <div className="gsp-live">{children}</div>
    </div>
  );
}

export function asRows(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.results)) return payload.results;
  return [];
}

export function formatQty(value, digits = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "Not configured";
  return number.toLocaleString("en-IN", { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

export function formatMoney(value) {
  if (value === null || value === undefined || value === "") return "Not configured";
  const number = Number(value);
  if (!Number.isFinite(number)) return "Not configured";
  return `₹${formatQty(number, Number.isInteger(number) ? 0 : 2)}`;
}

export function useToolkitLoad(loader) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await loader();
      setData(response.data);
    } catch (err) {
      setData(null);
      setError(toolkitError(err));
    } finally {
      setLoading(false);
    }
  }, [loader]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { loading, error, data, reload };
}

export function ToolkitBanner({ loading, error, onRetry }) {
  if (loading) return <p role="status" className="gsp-banner">Loading records…</p>;
  if (error) {
    return (
      <div role="alert" className="gsp-banner is-error">
        <p>{error}</p>
        <div className="gsp-actions">
          <button type="button" onClick={onRetry}>Retry</button>
        </div>
      </div>
    );
  }
  return null;
}

export function LoadState({ loading, error, onRetry, children }) {
  if (loading) return <p role="status">Loading records…</p>;
  if (error) {
    return (
      <div role="alert" className="gsp-banner is-error">
        <p>{error}</p>
        <div className="gsp-actions">
          <button type="button" onClick={onRetry}>Retry</button>
        </div>
      </div>
    );
  }
  return children;
}

export function showKnown(metric) {
  if (!metric || metric.known === false || metric.value === null || metric.value === undefined) return null;
  return metric.value;
}

export function useSaveAction() {
  const { addToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const run = async (action, successMessage) => {
    if (saving) return null;
    setSaving(true);
    setFormError("");
    try {
      const result = await action();
      addToast(successMessage);
      return result;
    } catch (err) {
      const message = toolkitError(err);
      setFormError(message);
      addToast(message, "error");
      return null;
    } finally {
      setSaving(false);
    }
  };

  return { saving, formError, run };
}
