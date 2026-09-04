import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { login as loginApi, getLoginErrorMessage } from "../../api/authApi";
import useAuth from "../../hooks/useAuth";
import AuthSlider from "../../components/auth/AuthSlider";
import LoginBackdrop from "../../components/auth/LoginBackdrop";
import PasswordInput from "../../components/auth/PasswordInput";
import BrandLogo from "../../components/common/BrandLogo";
import Button from "../../components/common/Button";
import LoginSuccessOverlay from "../../components/common/LoginSuccessOverlay";
import { ROLES } from "../../config/permissions";
import { getDashboardPathForRole } from "../../utils/roleRedirect";

const LOGIN_SUCCESS_MS = 1800;

const LOGIN_ROLES = ROLES.map((r) => r.name);

const EnvelopeIcon = () => (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
    />
  </svg>
);

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

const RoleIcon = () => (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
    />
  </svg>
);

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);
  const [redirectPath, setRedirectPath] = useState("/");
  const redirectTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
    };
  }, []);

  const completeLogin = (data) => {
    login({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      user: data.user,
    });

    const resolvedRole = data.user?.role_name || data.user?.role || role;
    const path = getDashboardPathForRole(resolvedRole);
    setRedirectPath(path);
    setShowSuccess(true);
    setLoading(false);

    redirectTimerRef.current = setTimeout(() => {
      navigate(path, { replace: true });
    }, LOGIN_SUCCESS_MS);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!email.trim() || !password || !role) {
      setError("Company email, password, and role are required.");
      return;
    }
    setLoading(true);
    try {
      const data = await loginApi(email.trim(), password, role);
      completeLogin(data);
    } catch (err) {
      setError(getLoginErrorMessage(err, "Login failed. Is the API running?"));
    } finally {
      setLoading(false);
    }
  };

  const fieldClass =
    "box-border h-11 w-full min-w-0 rounded-lg border-none bg-gray-100 py-2.5 pl-11 pr-4 text-sm text-gray-700 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500";

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-3 sm:p-4">
      <LoginSuccessOverlay open={showSuccess} />
      <LoginBackdrop />
      <div className="relative z-10 w-full max-w-3xl">
        <div
          className="relative overflow-hidden rounded-3xl bg-white shadow-2xl"
          style={{ minHeight: "420px" }}
        >
          <div className="flex min-h-[420px] flex-col md:flex-row">
            <div className="flex w-full flex-col items-center justify-center bg-white px-6 py-8 sm:px-8 md:w-1/2 md:py-9 lg:px-10">
              <div className="mb-5 w-full text-center">
                <div className="mb-3 flex justify-center">
                  <BrandLogo size="xl" imageClassName="h-[4.5rem]" />
                </div>
                <h1 className="mb-1.5 text-3xl font-bold text-gray-900">Insights Iva</h1>
                <p className="text-sm text-gray-600">Business Intelligence • Analytics • AI</p>
              </div>

              {error && (
                <div className="mb-3 w-full rounded-lg border border-red-400 bg-red-100 p-2.5 text-sm text-red-700">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="w-full space-y-3">
                <div className="relative">
                  <div className="pointer-events-none absolute left-3.5 top-1/2 z-10 -translate-y-1/2 text-gray-400">
                    <RoleIcon />
                  </div>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    required
                    aria-label="Role"
                    className={`${fieldClass} appearance-none cursor-pointer pr-10`}
                  >
                    <option value="" disabled>
                      Select Role *
                    </option>
                    {LOGIN_ROLES.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </div>
                </div>

                <div className="relative">
                  <div className="pointer-events-none absolute left-3.5 top-1/2 z-10 -translate-y-1/2 text-gray-400">
                    <EnvelopeIcon />
                  </div>
                  <input
                    type="email"
                    placeholder="Company Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="username"
                    className={fieldClass}
                    required
                  />
                </div>

                <PasswordInput
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  leftIcon={<LockIcon />}
                  autoComplete="current-password"
                  inputClassName="!h-11 !py-2.5 !pl-11"
                  required
                />

                <div className="flex items-center justify-between text-xs">
                  <Link to="/forgot-password" className="text-gray-600 hover:text-teal-600">
                    Forgot Your Password?
                  </Link>
                  <Link
                    to="/gns-admin/login"
                    className="font-medium text-teal-600 hover:text-teal-700 hover:underline"
                  >
                    Super Admin
                  </Link>
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  fullWidth
                  disabled={loading}
                  loading={loading}
                  className="uppercase tracking-wider"
                >
                  {loading ? "Signing in..." : "SIGN IN"}
                </Button>
              </form>
            </div>

            <AuthSlider
              className="min-h-[220px] w-full md:min-h-0 md:w-1/2"
              contentClassName="p-8 lg:p-10"
            >
              <h2 className="mb-3 text-3xl font-bold">Welcome</h2>
              <p className="mb-5 max-w-xs text-center text-sm text-teal-50/90">
                Sign in with your company email, password, and role to open your dashboard.
              </p>
            </AuthSlider>
          </div>
        </div>
      </div>
    </div>
  );
}