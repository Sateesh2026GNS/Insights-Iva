import React, { useState, useCallback, useEffect, useRef } from "react";
import { useNavigate, useLocation, Navigate, Link } from "react-router-dom";
import {
  superAdminVerifyOtp,
  superAdminResendOtp,
  setPlatformSession,
} from "../../api/platformApi";
import BrandLogo from "../../components/common/BrandLogo";
import "./SuperAdminLogin.css";

export default function SuperAdminVerifyOtp() {
  const navigate = useNavigate();
  const location = useLocation();
  const initialToken = location.state?.challengeToken || "";
  const initialMaskedMobile = location.state?.maskedMobile || "+91 XXXXXXX***";
  const initialMobile = location.state?.mobile || "";

  const [challengeToken, setChallengeToken] = useState(initialToken);
  const [maskedMobile, setMaskedMobile] = useState(initialMaskedMobile);
  const [mobileNumber, setMobileNumber] = useState(initialMobile);
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("OTP sent to your mobile.");
  const [countdown, setCountdown] = useState(60);

  const inputRefs = useRef([]);

  // Countdown timer for Resend OTP
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const otpCode = digits.join("");

  const handleVerify = useCallback(
    async (codeToVerify) => {
      const code = (codeToVerify ?? otpCode).trim();
      if (code.length !== 6 || loading || !challengeToken) return;
      setError("");
      setSuccess("");
      setLoading(true);
      try {
        const data = await superAdminVerifyOtp(challengeToken, code);
        setPlatformSession(data);
        try {
          sessionStorage.setItem("smrt_login_welcome", "GNS Insights Platform");
          window.dispatchEvent(
            new CustomEvent("smrt_login_welcome", { detail: { companyName: "GNS Insights Platform" } })
          );
        } catch {}
        setSuccess("OTP verified successfully. Redirecting…");
        const path = data.dashboard_path || "/gns-admin";
        setTimeout(() => navigate(path, { replace: true }), 400);
      } catch (err) {
        const detail = err.response?.data?.detail || err.response?.data?.message;
        const msg =
          typeof detail === "string"
            ? detail
            : err.message || "Invalid OTP. Please check your SMS/WhatsApp and try again.";
        setError(msg);
        setDigits(["", "", "", "", "", ""]);
        inputRefs.current[0]?.focus();
      } finally {
        setLoading(false);
      }
    },
    [challengeToken, otpCode, loading, navigate]
  );

  const handleDigitChange = (index, value) => {
    const char = value.replace(/\D/g, "").slice(-1);
    const newDigits = [...digits];
    newDigits[index] = char;
    setDigits(newDigits);
    setError("");

    if (char && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    const fullCode = newDigits.join("");
    if (fullCode.length === 6 && !newDigits.includes("")) {
      setTimeout(() => handleVerify(fullCode), 50);
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    const newDigits = ["", "", "", "", "", ""];
    for (let i = 0; i < pasted.length; i++) {
      newDigits[i] = pasted[i];
    }
    setDigits(newDigits);
    setError("");
    const nextIndex = Math.min(pasted.length, 5);
    inputRefs.current[nextIndex]?.focus();
    if (pasted.length === 6) {
      setTimeout(() => handleVerify(pasted), 50);
    }
  };

  const handleResend = async () => {
    if (resending || loading || !challengeToken || countdown > 0) return;
    setError("");
    setSuccess("");
    setResending(true);
    try {
      const data = await superAdminResendOtp(challengeToken);
      setChallengeToken(data.challenge_token);
      setMaskedMobile(data.masked_mobile || maskedMobile);
      const targetPhone = data.mobile || mobileNumber || initialMobile;
      setMobileNumber(targetPhone);
      setDigits(["", "", "", "", "", ""]);
      setSuccess("A new live OTP has been sent to your mobile.");
      setCountdown(60);
      inputRefs.current[0]?.focus();
    } catch (err) {
      const msg =
        err.message ||
        err.response?.data?.detail ||
        "Could not resend OTP. Please try again.";
      setError(typeof msg === "string" ? msg : "Could not resend OTP.");
    } finally {
      setResending(false);
    }
  };

  if (!challengeToken) {
    return <Navigate to="/gns-admin/login" replace />;
  }

  return (
    <div className="sa-root">
      <div className="sa-bg-base" />
      <div className="sa-orb-tl" />
      <div className="sa-orb-tr" />
      <div className="sa-wave" aria-hidden="true">
        <svg
          viewBox="0 0 1440 900"
          preserveAspectRatio="xMidYMid slice"
          xmlns="http://www.w3.org/2000/svg"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
        >
          <path
            d="M0,900 L0,560 C60,530 130,490 220,468 C340,440 460,448 570,430 C680,412 760,370 860,355 C960,340 1060,352 1160,368 C1260,384 1360,404 1440,415 L1440,900 Z"
            fill="#173b72"
          />
          <path
            d="M0,900 L0,620 C80,595 170,568 270,552 C390,533 510,538 620,522 C730,506 810,468 910,455 C1010,442 1110,452 1210,466 C1310,480 1390,498 1440,508 L1440,900 Z"
            fill="#1a4280"
            opacity="0.55"
          />
          <path
            d="M0,562 C60,532 130,492 220,470 C340,442 460,450 570,432 C680,414 760,372 860,357 C960,342 1060,354 1160,370 C1260,386 1360,406 1440,417"
            fill="none"
            stroke="#e8c96a"
            strokeWidth="2.5"
            opacity="0.90"
          />
        </svg>
      </div>

      <div className="sa-center">
        <div className="sa-card">
          <div className="mb-6 flex flex-col items-center text-center">
            <BrandLogo size="lg" />
            <h1 className="mt-4 text-[28px] font-bold tracking-tight text-[#002C66]">
              OTP Verification
            </h1>
            <p className="mt-2 text-sm text-slate-500">Enter the 6-digit code sent to</p>
            <p className="mt-1 font-mono text-sm font-semibold tracking-wide text-[#0E2F5C]">
              {maskedMobile}
            </p>
          </div>

          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 text-center font-medium">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700 text-center font-medium">
              {success}
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleVerify(otpCode);
            }}
            className="space-y-6"
          >
            <div className="flex justify-center gap-2 sm:gap-3" onPaste={handlePaste}>
              {digits.map((digit, idx) => (
                <input
                  key={idx}
                  ref={(el) => (inputRefs.current[idx] = el)}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  disabled={loading}
                  onChange={(e) => handleDigitChange(idx, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(idx, e)}
                  className={`h-12 w-11 sm:h-14 sm:w-12 rounded-xl border text-center text-xl sm:text-2xl font-bold transition-all focus:outline-none focus:ring-2 ${
                    error
                      ? "border-red-400 bg-red-50/50 text-red-800 focus:border-red-500 focus:ring-red-200"
                      : "border-slate-300 bg-white text-[#0E2F5C] focus:border-[#002C66] focus:ring-blue-100"
                  }`}
                />
              ))}
            </div>

            {loading && (
              <div className="flex justify-center items-center gap-2 text-sm font-medium text-[#002C66]">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#002C66] border-t-transparent" />
                Verifying…
              </div>
            )}
          </form>

          <div className="mt-4 flex flex-col items-center gap-3 text-xs text-slate-500">
            {countdown > 0 ? (
              <p>Resend OTP in <span className="font-semibold text-[#002C66]">{`00:${String(countdown).padStart(2, "0")}`}</span></p>
            ) : (
              <button
                type="button"
                onClick={handleResend}
                disabled={resending || loading}
                className="font-medium text-[#002C66] hover:underline"
              >
                {resending ? "Sending…" : "Resend OTP"}
              </button>
            )}

            <Link
              to="/gns-admin/login"
              className="font-medium text-[#002C66] hover:underline"
            >
              Back to login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
