import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { resendVerification, verifyEmail } from "../../api/authApi";
import Button from "../../components/common/Button";

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const [status, setStatus] = useState(token ? "verifying" : "idle");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [resendLoading, setResendLoading] = useState(false);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    verifyEmail(token)
      .then((data) => {
        if (cancelled) return;
        setStatus("success");
        setMessage(data.message || "Email verified successfully.");
      })
      .catch((err) => {
        if (cancelled) return;
        setStatus("error");
        const msg = err.response?.data?.detail;
        setMessage(typeof msg === "string" ? msg : "Verification failed or link expired.");
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleResend = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setResendLoading(true);
    try {
      const data = await resendVerification(email.trim());
      setMessage(data.message);
      setStatus("resent");
    } catch (err) {
      const msg = err.response?.data?.detail;
      setMessage(typeof msg === "string" ? msg : "Could not resend verification email.");
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Email Verification</h1>

        {status === "verifying" && <p className="text-gray-600">Verifying your email...</p>}

        {status === "success" && (
          <>
            <p className="text-green-700 mb-6">{message}</p>
            <Link to="/login" className="text-teal-600 font-semibold hover:text-[var(--color-success)]">
              Sign In
            </Link>
          </>
        )}

        {(status === "error" || status === "idle" || status === "resent") && (
          <>
            {message && <p className="text-gray-700 mb-4">{message}</p>}
            {!token && (
              <p className="text-sm text-gray-600 mb-4">
                Check your inbox for a verification link, or resend below.
              </p>
            )}
            <form onSubmit={handleResend} className="space-y-3 text-left">
              <input
                type="email"
                placeholder="Your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              <Button type="submit" variant="primary" fullWidth disabled={resendLoading} loading={resendLoading}>
                {resendLoading ? "Sending..." : "Resend Verification Email"}
              </Button>
            </form>
            <p className="mt-6">
              <Link to="/login" className="text-teal-600 font-semibold hover:text-[var(--color-success)]">
                Back to Sign In
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
