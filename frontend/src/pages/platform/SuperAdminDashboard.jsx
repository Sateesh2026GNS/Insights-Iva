import { useCallback, useEffect, useState } from "react";
import usePageRefresh from "../../hooks/usePageRefresh";
import { Link, useNavigate } from "react-router-dom";
import { Building2, Loader2, LogOut, PauseCircle, PlayCircle, Plus, Trash2, Users } from "lucide-react";

import BrandLogo from "../../components/common/BrandLogo";
import { SerialNumberCell, SerialNumberHeader } from "../../components/common/SerialNumberCell";
import PlatformProtectedRoute from "../../components/layout/PlatformProtectedRoute";
import {
  activateCompany, clearPlatformSession, deleteCompany,
  listCompanies, suspendCompany,
} from "../../api/platformApi";
import "./AdminPortal.css";

function StatusBadge({ status }) {
  const key = (status || "").toLowerCase();
  return (
    <span className={`ap-badge ap-badge--${key || "cancelled"}`}>
      {status || "unknown"}
    </span>
  );
}

/* ── Wave decoration (shared) ── */
function PortalDecorations() {
  useEffect(() => {
    const bubbles = Array.from(document.querySelectorAll(".ap-bubble"));
    const factors = [0.06, 0.04, 0.08, 0.05, 0.045, 0.055];
    let raf = null;

    function onMove(e) {
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      const nx = (e.clientX - cx) / cx; // -1 .. 1
      const ny = (e.clientY - cy) / cy; // -1 .. 1

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
      bubbles.forEach((b) => {
        b.style.transform = "translate3d(0px, 0px, 0) scale(1)";
      });
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
      {/* glass bubbles */}
      <div className="ap-bubble ap-bubble-1" />
      <div className="ap-bubble ap-bubble-2" />
      <div className="ap-bubble ap-bubble-3" />
      <div className="ap-bubble ap-bubble-4" />
      <div className="ap-bubble ap-bubble-5" />
      <div className="ap-bubble ap-bubble-6" />
      {/* white curve accents */}
      <div className="ap-curve ap-curve--white" />
      <div className="ap-curve ap-curve--gold" />
      <div className="ap-wave" aria-hidden="true">
        <svg viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M0,900 L0,560 C60,530 130,490 220,468 C340,440 460,448 570,430
               C680,412 760,370 860,355 C960,340 1060,352 1160,368
               C1260,384 1360,404 1440,415 L1440,900 Z"
            fill="#173b72"
          />
          <path
            d="M0,900 L0,620 C80,595 170,568 270,552 C390,533 510,538 620,522
               C730,506 810,468 910,455 C1010,442 1110,452 1210,466
               C1310,480 1390,498 1440,508 L1440,900 Z"
            fill="#1a4280" opacity="0.55"
          />
          <path
            d="M0,562 C60,532 130,492 220,470 C340,442 460,450 570,432
               C680,414 760,372 860,357 C960,342 1060,354 1160,370
               C1260,386 1360,406 1440,417"
            fill="none" stroke="#e8c96a" strokeWidth="2.5" opacity="0.90"
          />
        </svg>
      </div>
    </>
  );
}

function SuperAdminDashboardContent() {
  const navigate = useNavigate();
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionId, setActionId] = useState(null);
  const [actionError, setActionError] = useState("");

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    setError("");
    try {
      const data = await listCompanies();
      const list = Array.isArray(data) ? data : [];
      setCompanies(list.filter((c) => (c.status || "").toLowerCase() !== "deleted"));
    } catch (err) {
      if (!isRefresh) setError("Failed to load companies.");
      if (isRefresh) throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  usePageRefresh(() => load(true));

  useEffect(() => { load(); }, [load]);

  const handleLogout = () => {
    clearPlatformSession();
    navigate("/gns-admin/login", { replace: true });
  };

  const runAction = async (id, action) => {
    setActionError("");
    setActionId(id);
    try {
      await action(id);
      await load();
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setActionError(typeof detail === "string" ? detail : "Action failed. Please try again.");
    } finally {
      setActionId(null);
    }
  };

  const handleActivate = (id) => runAction(id, activateCompany);
  const handleSuspend  = (id) => runAction(id, suspendCompany);
  const handleDelete   = async (id, name) => {
    if (!window.confirm(`Delete company "${name}"? This cannot be undone.`)) return;
    await runAction(id, deleteCompany);
  };

  return (
    <div className="ap-root">
      <PortalDecorations />
      <div className="ap-content">

        {/* Header */}
        <header className="ap-header">
          <div className="ap-header__inner">
            <div className="ap-header__brand">
              <BrandLogo size="md" imageClassName="h-10 w-auto" />
              <div>
                <div className="ap-header__title">Insights Iva Admin Portal</div>
                <div className="ap-header__sub">Super Admin — Company Management</div>
              </div>
            </div>
            <button type="button" onClick={handleLogout} className="ap-header__logout">
              <LogOut size={14} /> Logout
            </button>
          </div>
        </header>

        {/* Main */}
        <main className="ap-main">
          <div className="ap-title-row">
            <div>
              <h2>Companies</h2>
              <p>Provision and manage tenant companies</p>
            </div>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <Link to="/gns-admin/companies/new" className="ap-btn ap-btn--primary">
                <Plus size={14} /> Create Company
              </Link>
            </div>
          </div>

          {error       && <div className="ap-alert ap-alert--error">{error}</div>}
          {actionError && <div className="ap-alert ap-alert--warn">{actionError}</div>}

          <div className="ap-card">
            <div className="ap-table-wrap">
              <table className="ap-table">
                <thead>
                  <tr>
                    <SerialNumberHeader />
                    <th>Company ID</th>
                    <th>Company</th>
                    <th>Admin</th>
                    <th>Plan</th>
                    <th>Users</th>
                    <th>Status</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="ap-loading">
                        <Loader2 size={16} className="animate-spin" /> Loading companies…
                      </td>
                    </tr>
                  ) : companies.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="ap-empty">
                        No companies yet. Create your first company.
                      </td>
                    </tr>
                  ) : (
                    companies.map((c, rowIndex) => {
                      const busy   = actionId === c.id;
                      const status = (c.status || "").toLowerCase();
                      return (
                        <tr key={c.id}>
                          <SerialNumberCell rowIndex={rowIndex} />
                          <td style={{ fontFamily: "monospace", fontSize: "0.75rem" }}>
                            {c.company_code}
                          </td>
                          <td>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                              <Building2 size={15} style={{ color: "#1a4280", flexShrink: 0 }} />
                              <div>
                                <div style={{ fontWeight: 600, color: "#0f172a" }}>{c.company_name}</div>
                                <div style={{ fontSize: "0.75rem", color: "#64748b" }}>{c.company_email}</div>
                              </div>
                            </div>
                          </td>
                          <td>
                            <div>{c.admin_name || "—"}</div>
                            <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>{c.admin_email}</div>
                          </td>
                          <td style={{ textTransform: "capitalize" }}>{c.subscription_plan || "—"}</td>
                          <td>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
                              <Users size={13} /> {c.user_count}
                            </span>
                          </td>
                          <td><StatusBadge status={c.status} /></td>
                          <td>
                            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.25rem" }}>
                              {busy ? (
                                <span style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem", fontSize: "0.75rem", color: "#64748b", padding: "0.25rem 0.5rem" }}>
                                  <Loader2 size={13} className="animate-spin" /> Working…
                                </span>
                              ) : (
                                <>
                                  <Link
                                    to={`/gns-admin/companies/${c.id}`}
                                    style={{ borderRadius: "0.5rem", padding: "0.25rem 0.6rem", fontSize: "0.75rem", fontWeight: 600, color: "#1a4280", textDecoration: "none" }}
                                    className="ap-btn"
                                  >
                                    View
                                  </Link>
                                  {status === "suspended" || status === "cancelled" ? (
                                    <button type="button" onClick={() => handleActivate(c.id)} disabled={actionId != null}
                                      style={{ borderRadius: "0.5rem", padding: "0.25rem", background: "transparent", border: "none", cursor: "pointer", color: "#16a34a" }}
                                      title="Activate"
                                    >
                                      <PlayCircle size={16} />
                                    </button>
                                  ) : status !== "deleted" ? (
                                    <button type="button" onClick={() => handleSuspend(c.id)} disabled={actionId != null}
                                      style={{ borderRadius: "0.5rem", padding: "0.25rem", background: "transparent", border: "none", cursor: "pointer", color: "#d97706" }}
                                      title="Suspend"
                                    >
                                      <PauseCircle size={16} />
                                    </button>
                                  ) : null}
                                  {c.id !== 1 && status !== "deleted" ? (
                                    <button type="button" onClick={() => handleDelete(c.id, c.company_name)} disabled={actionId != null}
                                      style={{ borderRadius: "0.5rem", padding: "0.25rem", background: "transparent", border: "none", cursor: "pointer", color: "#dc2626" }}
                                      title="Delete"
                                    >
                                      <Trash2 size={16} />
                                    </button>
                                  ) : null}
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default function SuperAdminDashboard() {
  return (
    <PlatformProtectedRoute>
      <SuperAdminDashboardContent />
    </PlatformProtectedRoute>
  );
}
