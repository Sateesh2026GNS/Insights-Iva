import { useEffect, useState } from "react";
import usePageRefresh from "../../hooks/usePageRefresh";
import { Check, Info, ScrollText } from "lucide-react";

import Loader from "../../components/common/Loader";
import Button from "../../components/common/Button";
import {
  getDigitalSignatureStatus,
  setupDigitalSignature,
} from "../../api/bizDocumentsApi";
import { useToast } from "../../context/ToastContext";

export default function DigitalSignatureSetup() {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null);
  const [form, setForm] = useState({ signatory_name: "", aadhaar_last4: "" });
  const [showForm, setShowForm] = useState(false);

  const load = (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    return getDigitalSignatureStatus()
      .then((r) => setStatus(r.data))
      .catch((err) => {
        setStatus({ is_setup: false, promo_credits: 3 });
        if (isRefresh) throw err;
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  usePageRefresh(() => load(true));

  const onSetup = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await setupDigitalSignature(form);
      setStatus(res.data);
      setShowForm(false);
      addToast("Digital signature set up successfully");
    } catch (err) {
      addToast(err.response?.data?.detail || "Setup failed", "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loader label="Loading…" />;


  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-b from-[#fff8e1] via-white to-white px-4 py-6">
      <header className="mb-8 flex items-center gap-2">
      </header>

      <div className="mx-auto max-w-lg rounded-2xl border border-slate-100 bg-white p-8 shadow-lg">
        <div className="mb-4 flex justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
            <ScrollText className="h-8 w-8" />
          </div>
        </div>

        <p className="mb-2 text-center text-sm font-semibold text-slate-800">
          🎉 Enjoy {status?.promo_credits ?? 3} Free Promo Credits
        </p>
        <h2 className="mb-1 text-center text-2xl font-bold text-slate-900">
          {status?.is_setup ? "Digital Signature Ready" : "Set Up Your Digital Signature"}
        </h2>
        <p className="mb-5 text-center text-sm font-semibold text-slate-700">Why Digital Signature?</p>

        <div className="mb-5 rounded-xl border border-dashed border-[var(--color-primary-light)] bg-[var(--color-primary-soft)]/80 p-4 text-center">
          <p className="text-sm font-semibold text-slate-800">
            Signed by {status?.signatory_name || "Gimbooks User"}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Date: {new Date().toISOString().slice(0, 19).replace("T", " ")}
          </p>
          <p className="mt-2 text-xs font-bold tracking-wide text-red-600">AADHAAR</p>
          <p className="text-xs text-slate-600">
            {status?.aadhaar_masked || "Authorised Signatory"}
          </p>
        </div>

        <ul className="mb-6 space-y-3 text-sm text-slate-700">
          {[
            ["Enhanced Security", "They protect documents from unauthorized alterations."],
            ["Fraud Prevention", "Digital signatures use unique identities for security, reducing forgery risk."],
            ["Legal validity", "Digital signatures hold legal validity and are widely accepted."],
          ].map(([t, d]) => (
            <li key={t} className="flex gap-2">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
              <span>
                <strong>{t}</strong>: {d}
              </span>
            </li>
          ))}
        </ul>

        {!showForm ? (
          <Button type="button" variant="primary" fullWidth onClick={() => setShowForm(true)}>
            {status?.is_setup ? "Update Digital Signature" : "Set Up Digital Signature"}
          </Button>
        ) : (
          <form onSubmit={onSetup} className="space-y-3">
            <input
              required
              placeholder="Signatory name"
              value={form.signatory_name}
              onChange={(e) => setForm((f) => ({ ...f, signatory_name: e.target.value }))}
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
            />
            <input
              required
              maxLength={4}
              pattern="\d{4}"
              placeholder="Aadhaar last 4 digits"
              value={form.aadhaar_last4}
              onChange={(e) =>
                setForm((f) => ({ ...f, aadhaar_last4: e.target.value.replace(/\D/g, "").slice(0, 4) }))
              }
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
            />
            <div className="flex gap-2">
              <Button type="button" variant="secondary" className="flex-1" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" className="flex-1" disabled={saving} loading={saving}>
                {saving ? "Saving…" : "Confirm"}
              </Button>
            </div>
          </form>
        )}

        <p className="mt-4 flex items-start gap-2 text-xs text-slate-500">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Always use your own Aadhaar details when performing a digital signature.
        </p>
      </div>
    </div>
  );
}
