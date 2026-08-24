import { useState } from "react";
import { Link } from "react-router-dom";
import { forgotPassword, getApiErrorMessage } from "../../api/authApi";
import BrandLogo from "../../components/common/BrandLogo";
import Button from "../../components/common/Button";
import { useToast } from "../../context/ToastContext";

const MailIcon = () => (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
    />
  </svg>
);

const Spinner = () => (
  <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
    />
  </svg>
);

export default function ForgotPassword() {
  const { addToast } = useToast();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [formError, setFormError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");
    setSuccessMessage("");
    setSent(false);

    if (!email.trim()) {
      const msg = "Company email address is required.";
      setFormError(msg);
      addToast(msg, "error");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      const msg = "Enter a valid company email address.";
      setFormError(msg);
      addToast(msg, "error");
      return;
    }

    setLoading(true);
    try {
      const data = await forgotPassword(email.trim());
      if (!data?.success) {
        const msg = data?.message || "Failed to send password reset email.";
        setFormError(msg);
        addToast(msg, "error");
        return;
      }
      setSent(true);
      setSuccessMessage(
        "Password reset link sent successfully.\nPlease check your email."
      );
      addToast("Password reset link sent successfully.", "success");
    } catch (err) {
      const raw = getApiErrorMessage(err, "Failed to send password reset email.");
      const msg = /smtp_|email server is not configured|failed to send/i.test(raw)
        ? `${raw}\nPlease try again later.`
        : raw;
      setFormError(msg);
      addToast(msg.replace(/\n/g, " "), "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-100 via-teal-50 to-slate-100 p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200/80 bg-white p-8 shadow-xl">
        <div className="mb-6 text-center">
          <div className="mb-3 flex justify-center">
            <BrandLogo size="lg" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Forgot Password</h1>
          <p className="mt-2 text-sm text-gray-600">
            Enter your company email address and we&apos;ll send a secure reset link.
          </p>
        </div>

        {sent && successMessage && (
          <div
            role="alert"
            className="mb-4 whitespace-pre-line rounded-lg border border-green-400 bg-green-50 p-3 text-sm text-green-800"
          >
            {successMessage}
          </div>
        )}

        {formError && (
          <div
            role="alert"
            className="mb-4 whitespace-pre-line rounded-lg border border-red-400 bg-red-50 p-3 text-sm text-red-700"
          >
            {formError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="relative">
            <label htmlFor="company-email" className="mb-1.5 block text-sm font-medium text-gray-700">
              Company Email Address
            </label>
            <div className="pointer-events-none absolute left-4 top-[2.55rem] text-gray-400">
              <MailIcon />
            </div>
            <input
              id="company-email"
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (formError) setFormError("");
              }}
              autoComplete="email"
              disabled={loading || sent}
              className="box-border h-12 w-full rounded-lg border border-slate-200 bg-gray-50 py-3 pl-12 pr-4 text-sm text-gray-700 placeholder-gray-500 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/30 disabled:opacity-60"
              required
            />
          </div>

          <Button
            type="submit"
            variant="primary"
            fullWidth
            disabled={loading || sent}
            loading={loading}
          >
            {loading ? "Sending…" : "Send Reset Link"}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-600">
          <Link to="/login" className="font-semibold text-teal-600 hover:text-[var(--color-success)]">
            Back to Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}
