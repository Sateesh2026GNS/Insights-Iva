import { useEffect, useState } from "react";
import { getFeatureSetting, putFeatureSetting } from "../../api/bizDocumentsApi";
import { useToast } from "../../context/ToastContext";
import Loader from "../../components/common/Loader";
import { apiErrorMessage } from "../../utils/apiError";

import Button from "../../components/common/Button";

const DEFAULT_FIELDS = [{ name: "value", label: "Value", type: "text" }];

export default function FeatureSettingsPage({
  title,
  settingKey,
  description,
  fields = DEFAULT_FIELDS,
}) {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({});

  useEffect(() => {
    let cancelled = false;
    getFeatureSetting(settingKey)
      .then((r) => {
        if (cancelled) return;
        const v = r.data?.value;
        if (v && typeof v === "object") setForm(v);
        else if (fields.length === 1) setForm({ [fields[0].name]: v ?? "" });
        else setForm({});
      })
      .catch(() => {
        if (!cancelled) setForm({});
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [settingKey]);

  const onSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const value = fields.length === 1 ? form[fields[0].name] : form;
      await putFeatureSetting(settingKey, value);
      addToast("Settings saved");
    } catch (err) {
      addToast(apiErrorMessage(err, "Save failed"), "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loader label="Loading…" />;

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-6">
      <div>
        <p className="ui-eyebrow">Settings</p>
        <h2 className="mt-0.5 ui-title">{title}</h2>
        {description ? <p className="ui-subtitle">{description}</p> : null}
      </div>
      <form onSubmit={onSave} className="space-y-4 ui-card p-5">
        {fields.map((f) => (
          <label key={f.name} className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">{f.label}</span>
            {f.type === "textarea" ? (
              <textarea
                rows={4}
                value={form[f.name] ?? ""}
                onChange={(e) => setForm((prev) => ({ ...prev, [f.name]: e.target.value }))}
                className="ui-input w-full"
              />
            ) : (
              <input
                type={f.type || "text"}
                value={form[f.name] ?? ""}
                onChange={(e) => setForm((prev) => ({ ...prev, [f.name]: e.target.value }))}
                className="ui-input w-full"
              />
            )}
          </label>
        ))}
        <Button variant="primary" type="submit" disabled={saving} className="disabled:opacity-60">
          {saving ? "Saving…" : "Save"}
        </Button>
      </form>
    </div>
  );
}
