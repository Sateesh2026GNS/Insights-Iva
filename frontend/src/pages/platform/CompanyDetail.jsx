import { useCallback, useEffect, useState } from "react";
import usePageRefresh from "../../hooks/usePageRefresh";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Building2, CreditCard, Users } from "lucide-react";

import PlatformProtectedRoute from "../../components/layout/PlatformProtectedRoute";
import BrandLogo from "../../components/common/BrandLogo";
import "./AdminPortal.css";
import {
  getCompany,
  getCompanySubscription,
  listCompanyUsers,
  resetCompanyPassword,
} from "../../api/platformApi";

function PortalDecorations() {
  useEffect(() => {
    const bubbles = Array.from(document.querySelectorAll(".ap-bubble"));
    const factors = [0.06, 0.04, 0.08, 0.05, 0.045, 0.055];
    let raf = null;

    function onMove(e) {
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      const nx = (e.clientX - cx) / cx;
      const ny = (e.clientY - cy) / cy;
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        bubbles.forEach((b, i) => {
          const f = factors[i] || 0.05;
          const tx = Math.round(nx * f * window.innerWidth);
          const ty = Math.round(ny * f * window.innerHeight * -0.35);
          b.style.transform = `translate3d(${tx}px, ${ty}px, 0) scale(${1 + f * 0.6})`;
        });
      });
    }

    function onLeave() {
      bubbles.forEach((b) => { b.style.transform = "translate3d(0px, 0px, 0) scale(1)"; });
    }

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseleave", onLeave);
    window.addEventListener("blur", onLeave);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseleave", onLeave);
      window.removeEventListener("blur", onLeave);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <>
      <div className="ap-bg" />
      <div className="ap-orb-tl" />
      <div className="ap-orb-tr" />
      <div className="ap-wave" aria-hidden="true">
        <svg viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
          <path d="M0,900 L0,560 C60,530 130,490 220,468 C340,440 460,448 570,430 C680,412 760,370 860,355 C960,340 1060,352 1160,368 C1260,384 1360,404 1440,415 L1440,900 Z" fill="#173b72" />
          <path d="M0,900 L0,620 C80,595 170,568 270,552 C390,533 510,538 620,522 C730,506 810,468 910,455 C1010,442 1110,452 1210,466 C1310,480 1390,498 1440,508 L1440,900 Z" fill="#1a4280" opacity="0.55" />
          <path d="M0,562 C60,532 130,492 220,470 C340,442 460,450 570,432 C680,414 760,372 860,357 C960,342 1060,354 1160,370 C1260,386 1360,406 1440,417" fill="none" stroke="#e8c96a" strokeWidth="2.5" opacity="0.90" />
        </svg>
      </div>
    </>
  );
}

function CompanyDetailContent() {
  const { tenantId } = useParams();
  const [company, setCompany] = useState(null);
  const [users, setUsers] = useState([]);
  const [subscription, setSubscription] = useState(null);
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const [c, u, s] = await Promise.all([
        getCompany(tenantId),
        listCompanyUsers(tenantId),
        getCompanySubscription(tenantId),
      ]);
      setCompany(c);
      setUsers(Array.isArray(u) ? u : []);
      setSubscription(s);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  usePageRefresh(() => load(true));

  useEffect(() => {
    load();
  }, [load]);

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 8) return;
    const res = await resetCompanyPassword(tenantId, newPassword);
    setMessage(res.message);
    setNewPassword("");
  };

  if (loading) return (
    <div className="ap-root"><PortalDecorations />
      <div className="ap-content ap-loading">Loading company…</div>
    </div>
  );

  if (!company) return (
    <div className="ap-root"><PortalDecorations />
      <div className="ap-content ap-loading" style={{color:"#dc2626"}}>Company not found.</div>
    </div>
  );

  return (
    <div className="ap-root">
      <PortalDecorations />
      <div className="ap-bubble ap-bubble-1" />
      <div className="ap-bubble ap-bubble-2" />
      <div className="ap-bubble ap-bubble-3" />
      <div className="ap-bubble ap-bubble-4" />
      <div className="ap-bubble ap-bubble-5" />
      <div className="ap-bubble ap-bubble-6" />
      <div className="ap-curve ap-curve--white" />
      <div className="ap-curve ap-curve--gold" />
      <div className="ap-content">
        <header className="ap-header">
          <div className="ap-header__inner">
            <div className="ap-header__brand">
              <BrandLogo size="md" imageClassName="h-10 w-auto" />
              <div>
                <div className="ap-header__title">Insights Iva Admin Portal</div>
                <div className="ap-header__sub">Company Detail</div>
              </div>
            </div>
          </div>
        </header>

        <main className="ap-main">
          <Link to="/gns-admin" className="ap-back">
            <ArrowLeft size={14} /> Back to companies
          </Link>

          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

            {/* Company Info */}
            <div className="ap-card">
              <div className="ap-section-head">
                <div className="ap-section-head__icon"><Building2 size={16} /></div>
                <div>
                  <div className="ap-section-head__title">{company.company_name}</div>
                  <div className="ap-section-head__sub" style={{fontFamily:"monospace"}}>{company.company_code}</div>
                </div>
              </div>
              <div className="ap-section-body">
                <dl className="ap-detail-grid">
                  <Item label="Email" value={company.company_email} />
                  <Item label="Phone" value={company.mobile_number} />
                  <Item label="Status" value={company.status} />
                  <Item label="Plan" value={company.subscription_plan} />
                  <Item label="GST" value={company.gst_number || "—"} />
                  <Item label="Trial Expires" value={company.trial_expires_at ? new Date(company.trial_expires_at).toLocaleDateString() : "—"} />
                  <Item label="Address" value={`${company.address || ""}, ${company.city || ""}, ${company.state || ""}`} />
                </dl>
              </div>
            </div>

            {/* Subscription */}
            {subscription && (
              <div className="ap-card">
                <div className="ap-section-head">
                  <div className="ap-section-head__icon"><CreditCard size={16} /></div>
                  <div>
                    <div className="ap-section-head__title">Subscription & License</div>
                  </div>
                </div>
                <div className="ap-section-body">
                  <dl className="ap-detail-grid">
                    <Item label="License Status" value={subscription.license_status} />
                    <Item label="Trial Status" value={subscription.trial_status ? "Active" : "Inactive"} />
                    {subscription.license && (
                      <>
                        <Item label="Max Users" value={subscription.license.max_users} />
                        <Item label="Expires" value={subscription.license.expires_at ? new Date(subscription.license.expires_at).toLocaleDateString() : "—"} />
                      </>
                    )}
                  </dl>
                </div>
              </div>
            )}

            {/* Reset Password */}
            <div className="ap-card">
              <div className="ap-section-head">
                <div className="ap-section-head__icon"><Users size={16} /></div>
                <div><div className="ap-section-head__title">Reset Company Admin Password</div></div>
              </div>
              <div className="ap-section-body">
                {message && <div className="ap-alert ap-alert--success" style={{marginBottom:"0.75rem"}}>{message}</div>}
                <form onSubmit={handleResetPassword} style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
                  <input
                    type="password" value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="New password (min 8 chars)"
                    className="ap-input" style={{ minWidth: "200px", flex: 1 }}
                    minLength={8} required
                  />
                  <button type="submit" className="ap-btn ap-btn--primary">Reset Password</button>
                </form>
              </div>
            </div>

            {/* Users Table */}
            <div className="ap-card">
              <div className="ap-section-head">
                <div className="ap-section-head__icon"><Users size={16} /></div>
                <div><div className="ap-section-head__title">Company Users ({users.length})</div></div>
              </div>
              <div className="ap-table-wrap">
                <table className="ap-table">
                  <thead>
                    <tr>
                      <th>Name</th><th>Email</th><th>Role</th><th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id}>
                        <td>{u.full_name}</td>
                        <td>{u.email}</td>
                        <td>{u.role}</td>
                        <td>
                          <span className={`ap-badge ${u.is_active ? "ap-badge--active" : "ap-badge--suspended"}`}>
                            {u.is_active ? "Active" : "Inactive"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </main>
      </div>
    </div>
  );
}

function Item({ label, value }) {
  return (
    <div className="ap-detail-item">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

export default function CompanyDetail() {

  return (
    <PlatformProtectedRoute>
      <CompanyDetailContent />
    </PlatformProtectedRoute>
  );
}
