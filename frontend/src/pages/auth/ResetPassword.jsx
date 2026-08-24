import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  getApiErrorMessage,
  resetPassword,
  validateResetToken,
} from "../../api/authApi";
import PasswordInput from "../../components/auth/PasswordInput";
import BrandLogo from "../../components/common/BrandLogo";
import Button from "../../components/common/Button";
import { useToast } from "../../context/ToastContext";
import { passwordRuleStatus, validatePasswordStrength } from "../../utils/passwordValidation";

const LockIcon = () => (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
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

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const token = searchParams.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(Boolean(token));
  const [tokenError, setTokenError] = useState("");
  const [success, setSuccess] = useState(false);
  const [formError, setFormError] = useState("");

  const rules = useMemo(() => passwordRuleStatus(password), [password]);
  const tokenValid = Boolean(token) && !tokenError && !validating;

  useEffect(() => {
    let cancelled = false;
    async function checkToken() {
      if (!token) {
        setTokenError("The password reset link is invalid.");
        setValidating(false);
        return;
      }
      setValidating(true);
      try {
        await validateResetToken(token);
        if (!cancelled) setTokenError("");
      } catch (err) {
        if (cancelled) return;
        const msg = getApiErrorMessage(err, "The password reset link is invalid.");
        if (/expired/i.test(msg)) {
          setTokenError("Reset link has expired.\nRequest a new password reset.");
        } else {
          setTokenError(msg);
        }
      } finally {
        if (!cancelled) setValidating(false);
      }
    }
    checkToken();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");
    if (!tokenValid) {
      const msg = tokenError || "The password reset link is invalid.";
      setFormError(msg);
      addToast(msg.replace("\n", " "), "error");
      return;
    }
    const policyError = validatePasswordStrength(password);
    if (policyError) {
      setFormError(policyError);
      addToast(policyError, "error");
      return;
    }
    if (password !== confirmPassword) {
      const msg = "Passwords must match.";
      setFormError(msg);
      addToast(msg, "error");
      return;
    }

    setLoading(true);
    try {
      const data = await resetPassword(token, password);
      const message = data?.message || "Password changed successfully.";
      setSuccess(true);
      setFormError("");
      addToast(message, "success");
      window.setTimeout(() => navigate("/login", { replace: true }), 3000);
    } catch (err) {
      const msg = getApiErrorMessage(err, "Unable to reset password. Request a new link.");
      if (/expired/i.test(msg)) {
        setTokenError("Reset link has expired.\nRequest a new password reset.");
        setFormError("");
      } else {
        setFormError(msg);
      }
      addToast(msg.replace("\n", " "), "error");
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
          <h1 className="text-2xl font-bold text-gray-900">Reset Password</h1>
          <p className="mt-2 text-sm text-gray-600">
            Choose a strong new password for your account.
          </p>
        </div>

        {validating && (
          <div className="mb-4 flex items-center justify-center gap-2 text-sm text-gray-600">
            <Spinner />
            Validating reset link…
          </div>
        )}

        {!validating && tokenError && (
          <div
            role="alert"
            className="mb-4 whitespace-pre-line rounded-lg border border-red-400 bg-red-50 p-3 text-sm text-red-700"
          >
            {tokenError}{" "}
            <Link to="/forgot-password" className="font-semibold underline">
              Request a new password reset
            </Link>
          </div>
        )}

        {success && (
          <div
            role="alert"
            className="mb-4 rounded-lg border border-green-400 bg-green-50 p-3 text-sm text-green-800"
          >
            Password changed successfully.
            <br />
            Redirecting to Login Page…
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {formError && (
            <div
              role="alert"
              className="whitespace-pre-line rounded-lg border border-red-400 bg-red-50 p-3 text-sm text-red-700"
            >
              {formError}
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">New Password</label>
            <PasswordInput
              placeholder="New Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              leftIcon={<LockIcon />}
              autoComplete="new-password"
              disabled={success || !tokenValid || loading}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Confirm Password
            </label>
            <PasswordInput
              placeholder="Confirm Password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              leftIcon={<LockIcon />}
              autoComplete="new-password"
              disabled={success || !tokenValid || loading}
            />
          </div>

          {password && (
            <ul className="space-y-1 rounded-lg bg-gray-50 p-3 text-xs text-gray-600">
              {rules.map((rule) => (
                <li
                  key={rule.id}
                  className={rule.met ? "text-green-700" : "text-gray-500"}
                >
                  {rule.met ? "✓" : "○"} {rule.label}
                </li>
              ))}
            </ul>
          )}

          <Button
            type="submit"
            variant="primary"
            fullWidth
            disabled={loading || success || !tokenValid}
            loading={loading}
          >
            {loading ? "Resetting…" : "Reset Password"}
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
