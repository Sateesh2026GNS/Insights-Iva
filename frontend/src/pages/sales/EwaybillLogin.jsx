import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { ewaybillLogin, getEwaybillStatus } from "../../api/bizDocumentsApi";
import { useToast } from "../../context/ToastContext";
import Loader from "../../components/common/Loader";
import Button from "../../components/common/Button";

export default function EwaybillLogin() {
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState(null);
  const [form, setForm] = useState({ gstin: "", username: "", password: "" });

  useEffect(() => {
    getEwaybillStatus()
      .then((r) => {
        setStatus(r.data);
        if (r.data?.gstin) setForm((f) => ({ ...f, gstin: r.data.gstin, username: r.data.username || "" }));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const onSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await ewaybillLogin(form);
      setStatus({ connected: true, gstin: res.data.gstin, username: form.username });
      addToast(res.data.message || "Logged in");
    } catch (err) {
      addToast(err.response?.data?.detail || "Login failed", "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loader label="Loading…" />;

  return (
    <div className="relative flex min-h-[calc(100vh-4rem)] items-center justify-center overflow-hidden bg-[#3b3887] px-4 py-10">
      <div className="pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-[#6e67ce]/40" style={{ borderRadius: "0 50% 50% 0 / 0 40% 40% 0" }} />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-1/3 bg-[#6e67ce]/40" style={{ borderRadius: "50% 0 0 50% / 40% 0 0 40%" }} />

      <form
        onSubmit={onSubmit}
        className="relative z-10 w-full max-w-md rounded-2xl bg-white px-8 py-10 shadow-xl"
      >
        <div className="mb-6 flex flex-col items-center text-center">
          <img
            src="/images/india-emblem.png"
            alt="State Emblem of India — सत्यमेव जयते"
            className="mb-4 h-20 w-auto object-contain"
          />
          {status?.connected && (
            <p className="mt-2 text-sm font-medium text-emerald-600">Connected · {status.gstin}</p>
          )}
        </div>

        <label className="mb-4 block text-left">
          <span className="mb-1.5 block text-sm font-bold text-slate-900">GSTIN</span>
          <input
            value={form.gstin}
            onChange={(e) => setForm((f) => ({ ...f, gstin: e.target.value.toUpperCase() }))}
            placeholder="Enter GSTIN"
            required
            className="w-full rounded-lg border-0 bg-slate-100 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </label>

        <label className="mb-4 block text-left">
          <span className="mb-1.5 block text-sm font-bold text-slate-900">Username</span>
          <input
            value={form.username}
            onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
            placeholder="Enter Username"
            required
            className="w-full rounded-lg border-0 bg-slate-100 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </label>

        <label className="mb-6 block text-left">
          <span className="mb-1.5 block text-sm font-bold text-slate-900">Password</span>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              placeholder="Enter Password"
              required
              className="w-full rounded-lg border-0 bg-slate-100 px-4 py-3 pr-10 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </label>

        <Button type="submit" variant="primary" fullWidth disabled={saving} loading={saving}>
          {saving ? "Logging in…" : "Login"}
        </Button>

        <button
          type="button"
          onClick={() => navigate("/sales/invoices")}
          className="mt-3 w-full text-center text-sm text-slate-500 hover:underline"
        >
          Back to Invoices
        </button>
      </form>
    </div>
  );
}
