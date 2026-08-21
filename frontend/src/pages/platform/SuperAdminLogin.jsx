import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Eye, EyeOff, Lock, Mail } from "lucide-react";
import { superAdminLogin } from "../../api/platformApi";
import "./SuperAdminLogin.css";

/* ── inline SVG icons ── */
const MailIcon = () => (
  <svg className="sa-input-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 7l9 6 9-6" />
  </svg>
);

const LockIcon = () => (
  <svg className="sa-input-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <rect x="5" y="11" width="14" height="10" rx="2" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M8 11V7a4 4 0 018 0v4" />
  </svg>
);

const EyeIcon = () => (
  <svg className="sa-eye-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const EyeOffIcon = () => (
  <svg className="sa-eye-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

const ArrowIcon = () => (
  <svg className="sa-btn-arrow" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

export default function SuperAdminLogin() {
  const navigate = useNavigate();
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd]   = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await superAdminLogin(email.trim(), password);
      navigate("/gns-admin/verify-otp", {
        replace: true,
        state: {
          challengeToken:      data.challenge_token,
          maskedMobile:        data.masked_mobile,
          mobile:              data.mobile || data.masked_mobile,
          expiresInSeconds:    data.expires_in_seconds,
          resendAfterSeconds:  data.resend_after_seconds,
          devOtp:              data.dev_otp || null,
        },
      });
    } catch (err) {
      if (!err.response) {
        setError("Cannot reach the API server. Make sure the backend is running on http://localhost:8000, then try again.");
      } else {
        const detail = err.response?.data?.detail;
        setError(typeof detail === "string" ? detail : "Login failed.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="sa-root">
      {/* ── 1. base gradient ── */}
      <div className="sa-bg-base" />

      {/* ── 2. soft blurred shape behind the card ── */}
      <div className="sa-hero-wave" />

      {/* ── 3. top-left large glassy orb ── */}
      <div className="sa-orb-tl" />

      {/* ── 4. left-center softer glass orb ── */}
      <div className="sa-orb-tr" />

      {/* ── 5. bottom-left small curved wave ── */}
      <div className="sa-wave" aria-hidden="true">
        <svg
          viewBox="0 0 560 180"
          preserveAspectRatio="xMinYMin meet"
          xmlns="http://www.w3.org/2000/svg"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
        >
          {/* exact small left-side curve */}
          <path
            d="M0,180 L0,150 C28,145 60,142 100,140 C145,138 190,139 240,143
               C290,148 340,155 390,165 C450,175 500,180 560,182 L560,180 Z"
            fill="#173b72"
          />
          <path
            d="M0,150 C28,147 60,145 100,143 C145,141 190,142 240,146
               C290,150 340,156 390,164 C450,172 500,178 560,181"
            fill="none"
            stroke="#e8c96a"
            strokeWidth="2"
            opacity="0.95"
          />
        </svg>
      </div>

      {/* ── card ── */}
      <div className="sa-center">
        <div className="sa-card">

          {/* logo + heading */}
          <div className="sa-card__header">
            <h1 className="sa-card__title">Insights Iva Admin Portal</h1>
            <p className="sa-card__subtitle">Super Admin sign in</p>
          </div>

          {/* error */}
          {error && (
            <div className="sa-error">{error}</div>
          )}

          {/* form */}
          <form onSubmit={handleSubmit} className="sa-form">

            {/* email */}
            <div className="sa-field">
              <label htmlFor="sa-email" className="sa-label">Company Email</label>
              <div className="sa-input-wrap">
                <MailIcon />
                <input
                  id="sa-email"
                  name="email"
                  type="email"
                  placeholder="Enter your company email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="sa-input"
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            {/* password */}
            <div className="sa-field">
              <label htmlFor="sa-password" className="sa-label">Password</label>
              <div className="sa-input-wrap">
                <LockIcon />
                <input
                  id="sa-password"
                  name="password"
                  type={showPwd ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="sa-input sa-input--pwd"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="sa-eye-btn"
                  onClick={() => setShowPwd((v) => !v)}
                  tabIndex={-1}
                  aria-label={showPwd ? "Hide password" : "Show password"}
                >
                  {showPwd ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
            </div>

            {/* submit */}
            <button
              type="submit"
              disabled={loading}
              className="sa-btn"
            >
              <span>{loading ? "Verifying…" : "Continue"}</span>
              <ArrowIcon />
            </button>
          </form>

          {/* footer link */}
          <p className="sa-footer">
            Company users?{" "}
            <Link to="/login" className="sa-footer__link">Sign in here</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
