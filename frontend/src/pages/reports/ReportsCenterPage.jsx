import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  ArrowUp,
  Clock,
  Folder,
  Home,
  MoreVertical,
  Search,
  Share2,
  Star,
  User,
} from "lucide-react";

import Button from "../../components/common/Button";
import EmptyState from "../../components/common/EmptyState";
import Pagination from "../../components/common/Pagination";
import AsyncPageBody from "../../components/common/states/AsyncPageBody";
import NoResultsState from "../../components/common/states/NoResultsState";
import ReportScheduleFormModal from "../../components/reports/ReportScheduleFormModal";
import { userHasReportsAction } from "../../config/permissions";
import { useNetworkStatus } from "../../context/NetworkStatusContext";
import { useToast } from "../../context/ToastContext";
import useAuth from "../../hooks/useAuth";
import {
  favoriteReport,
  getReportsCatalog,
  listCustomReports,
  listReportSchedules,
  unfavoriteReport,
} from "../../api/reportsApi";
import { apiErrorMessage, classifyApiError } from "../../utils/apiError";
import {
  REPORT_CENTER_CATEGORIES,
  formatReportLastVisited,
} from "../../utils/storeReportsCenter";
import "../../styles/store-reports-center.css";

const SIDEBAR_VIEWS = [
  { id: "all", icon: Home, labelKey: "reportsCenter.nav.home" },
  { id: "favorites", icon: Star, labelKey: "reportsCenter.nav.favorites" },
  { id: "shared", icon: Share2, labelKey: "reportsCenter.nav.shared" },
  { id: "mine", icon: User, labelKey: "reportsCenter.nav.mine" },
  { id: "scheduled", icon: Clock, labelKey: "reportsCenter.nav.scheduled" },
];

function useDebounced(value, ms = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return debounced;
}

export default function ReportsCenterPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { addToast } = useToast();
  const { online } = useNetworkStatus();
  const canCreate = userHasReportsAction(user, "create");
  const canSchedule = userHasReportsAction(user, "schedule");
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") || "");
  const debouncedQ = useDebounced(query, 300);
  const section = searchParams.get("section") || "all";
  const category = searchParams.get("category") || "";
  const page = Number(searchParams.get("page") || 1);
  const sortBy = searchParams.get("sort_by") || "title";
  const sortDir = searchParams.get("sort_dir") || "asc";

  const [items, setItems] = useState([]);
  const [categoryCounts, setCategoryCounts] = useState({});
  const [pagination, setPagination] = useState({ page: 1, page_size: 50, total_rows: 0, total_pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [errorObj, setErrorObj] = useState(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const moreRef = useRef(null);
  const tableWrapRef = useRef(null);

  const patchParams = useCallback(
    (patch) => {
      const next = new URLSearchParams(searchParams);
      Object.entries(patch).forEach(([k, v]) => {
        if (v === "" || v == null) next.delete(k);
        else next.set(k, String(v));
      });
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setErrorObj(null);
    setPermissionDenied(false);
    try {
      if (section === "mine" || section === "shared") {
        const res = await listCustomReports(section === "shared" ? "shared" : "mine");
        let rows = res?.data ?? res;
        rows = Array.isArray(rows) ? rows : [];
        const q = (debouncedQ || "").trim().toLowerCase();
        if (q) {
          rows = rows.filter(
            (r) =>
              String(r.name || "").toLowerCase().includes(q) ||
              String(r.category || "").toLowerCase().includes(q)
          );
        }
        setItems(
          rows.map((r) => ({
            slug: `custom-${r.id}`,
            title: r.name,
            category: r.category || "Custom",
            created_by: r.shared_with_me ? t("reportsCenter.sharedWithMe") : t("reportsCenter.createdByMe"),
            is_favorite: false,
            last_visited_at: null,
            href: `/reports/custom/${r.id}`,
          }))
        );
        setPagination({ page: 1, page_size: rows.length || 50, total_rows: rows.length, total_pages: 1 });
        return;
      }
      if (section === "scheduled") {
        const res = await listReportSchedules();
        let rows = res?.data ?? res;
        rows = Array.isArray(rows) ? rows : [];
        const q = (debouncedQ || "").trim().toLowerCase();
        if (q) rows = rows.filter((r) => String(r.name || "").toLowerCase().includes(q));
        setItems(
          rows.map((r) => ({
            slug: `schedule-${r.id}`,
            title: r.name,
            category: r.frequency,
            created_by: r.worker_enabled
              ? t("reportsCenter.scheduleActiveWorker")
              : t("reportsCenter.scheduleNeedsWorker"),
            is_favorite: false,
            last_visited_at: r.last_run_at || r.next_run_at || null,
            href: `/reports/schedules/${r.id}`,
          }))
        );
        setPagination({ page: 1, page_size: rows.length || 50, total_rows: rows.length, total_pages: 1 });
        return;
      }
      const res = await getReportsCatalog({
        q: debouncedQ || undefined,
        category: category || undefined,
        section,
        sort_by: sortBy,
        sort_dir: sortDir,
        page,
        page_size: 50,
      });
      const body = res?.data ?? res;
      setItems(body.items || []);
      setCategoryCounts(body.category_counts || {});
      setPagination(body.pagination || { page: 1, page_size: 50, total_rows: 0, total_pages: 1 });
    } catch (err) {
      const classified = classifyApiError(err);
      if (classified?.type === "permission") setPermissionDenied(true);
      setErrorObj(err);
      setError(apiErrorMessage(err, t("reportsCenter.loadError")));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [debouncedQ, category, section, sortBy, sortDir, page, t]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    patchParams({ q: debouncedQ || "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ]);

  useEffect(() => {
    if (!moreOpen) return undefined;
    const close = (e) => {
      if (moreRef.current && !moreRef.current.contains(e.target)) setMoreOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [moreOpen]);

  useEffect(() => {
    const el = tableWrapRef.current;
    if (!el) return undefined;
    const onScroll = () => setShowScrollTop(el.scrollTop > 240);
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  const heading = useMemo(() => {
    if (category) return category;
    const view = SIDEBAR_VIEWS.find((v) => v.id === section);
    if (view && section !== "all") return t(view.labelKey);
    return t("reportsCenter.allReports");
  }, [category, section, t]);

  const toggleSort = (col) => {
    if (sortBy === col) {
      patchParams({ sort_dir: sortDir === "asc" ? "desc" : "asc", page: 1 });
    } else {
      patchParams({ sort_by: col, sort_dir: "asc", page: 1 });
    }
  };

  const onToggleFavorite = async (row, e) => {
    e.preventDefault();
    e.stopPropagation();
    const prev = row.is_favorite;
    setItems((list) =>
      list.map((r) => (r.slug === row.slug ? { ...r, is_favorite: !prev } : r))
    );
    try {
      if (prev) await unfavoriteReport(row.slug);
      else await favoriteReport(row.slug);
    } catch (err) {
      setItems((list) =>
        list.map((r) => (r.slug === row.slug ? { ...r, is_favorite: prev } : r))
      );
      addToast(apiErrorMessage(err, t("reportsCenter.favoriteError")), "error");
    }
  };

  const emptySection = ["favorites", "shared", "mine", "scheduled"].includes(section) && !debouncedQ;

  const sidebar = (
    <aside className="store-reports-center__sidebar" aria-label={t("reportsCenter.sidebarAria")}>
      <nav className="store-reports-center__nav" aria-label={t("reportsCenter.nav.label")}>
        {SIDEBAR_VIEWS.map(({ id, icon: Icon, labelKey }) => {
          const active = section === id && !category;
          return (
            <button
              key={id}
              type="button"
              className={`store-reports-center__nav-btn ${active ? "store-reports-center__nav-btn--active" : ""}`}
              onClick={() => {
                patchParams({ section: id, category: "", page: 1 });
                setDrawerOpen(false);
              }}
            >
              <Icon className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
              <span className="truncate">{t(labelKey)}</span>
            </button>
          );
        })}
      </nav>
      <div className="store-reports-center__sidebar-divider" role="presentation" />
      <p className="store-reports-center__sidebar-label">{t("reportsCenter.categoryLabel")}</p>
      {REPORT_CENTER_CATEGORIES.map((cat) => (
        <button
          key={cat}
          type="button"
          className={`store-reports-center__cat-btn ${category === cat ? "store-reports-center__cat-btn--active" : ""}`}
          onClick={() => {
            patchParams({ category: cat, section: "all", page: 1 });
            setDrawerOpen(false);
          }}
        >
          <Folder className="store-reports-center__folder-icon h-4 w-4 shrink-0" aria-hidden />
          <span className="truncate flex-1 text-left">{cat}</span>
          <span className="store-reports-center__count">{categoryCounts[cat] ?? 0}</span>
        </button>
      ))}
    </aside>
  );

  return (
    <div className="store-reports-center min-w-0 w-full px-3 py-4 sm:px-4">
      <div className="store-reports-center__top-band">
        <div className="store-reports-center__hero px-1">
          <h1 className="store-reports-center__title">{t("reportsCenter.title")}</h1>
          <div className="store-reports-center__search-wrap">
            <Search className="store-reports-center__search-icon" aria-hidden />
            <input
              type="search"
              className="store-reports-center__search"
              placeholder={t("reportsCenter.searchPlaceholder")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label={t("reportsCenter.searchPlaceholder")}
            />
          </div>
          <div className="store-reports-center__hero-actions">
            {canCreate ? (
              <Button variant="primary" size="sm" type="button" to="/reports/builder">
                {t("reportsCenter.createNew")}
              </Button>
            ) : null}
            {canSchedule ? (
              <Button variant="outline" size="sm" type="button" onClick={() => setScheduleOpen(true)}>
                {t("reportsCenter.schedule.create")}
              </Button>
            ) : null}
            <div className="store-reports-center__more-wrap" ref={moreRef}>
              <button
                type="button"
                className="store-reports-center__more-btn"
                aria-label={t("reportsCenter.moreAria")}
                aria-expanded={moreOpen}
                onClick={() => setMoreOpen((v) => !v)}
              >
                <MoreVertical className="h-5 w-5" aria-hidden />
              </button>
              {moreOpen ? (
                <div className="store-reports-center__more-menu" role="menu">
                  <button
                    type="button"
                    role="menuitem"
                    className="store-reports-center__more-item"
                    onClick={() => {
                      setMoreOpen(false);
                      addToast(t("reportsCenter.importSoon"), "info");
                    }}
                  >
                    {t("reportsCenter.import")}
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="store-reports-center__more-item"
                    onClick={() => {
                      setMoreOpen(false);
                      addToast(t("reportsCenter.manageCatsSoon"), "info");
                    }}
                  >
                    {t("reportsCenter.manageCategories")}
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="store-reports-center__more-item"
                    onClick={() => {
                      setMoreOpen(false);
                      addToast(t("reportsCenter.exportListSoon"), "info");
                    }}
                  >
                    {t("reportsCenter.exportList")}
                  </button>
                </div>
              ) : null}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="md:hidden"
              type="button"
              onClick={() => setDrawerOpen(true)}
            >
              {t("reportsCenter.categories")}
            </Button>
          </div>
        </div>
      </div>

      {drawerOpen ? (
        <div className="store-reports-center__drawer" role="dialog" aria-modal="true">
          <button
            type="button"
            className="store-reports-center__drawer-backdrop"
            aria-label={t("reportsCenter.closeDrawer")}
            onClick={() => setDrawerOpen(false)}
          />
          <div className="store-reports-center__drawer-panel">{sidebar}</div>
        </div>
      ) : null}

      <div className="store-reports-center__shell">
        <div className="hidden md:block">{sidebar}</div>
        <div className="store-reports-center__main">
          <div className="store-reports-center__main-head">
            {heading}
            <span className="store-reports-center__count">{pagination.total_rows}</span>
          </div>
          <div className="store-reports-center__table-wrap" ref={tableWrapRef}>
            <AsyncPageBody
              loading={loading}
              error={error}
              errorObj={errorObj}
              online={online}
              permissionDenied={permissionDenied}
              onRetry={load}
              skeletonRows={8}
              skeletonCols={4}
            >
              {!items.length ? (
                emptySection ? (
                  <EmptyState
                    title={t("reportsCenter.emptySectionTitle")}
                    description={t("reportsCenter.emptySectionDesc")}
                  />
                ) : debouncedQ ? (
                  <NoResultsState
                    title={t("reportsCenter.noResultsTitle")}
                    description={t("reportsCenter.noResultsDesc")}
                  />
                ) : (
                  <EmptyState
                    title={t("reportsCenter.emptyTitle")}
                    description={t("reportsCenter.emptyDesc")}
                  />
                )
              ) : (
                <>
                  <table className="store-reports-center__table">
                    <thead>
                      <tr>
                        <th>
                          <button type="button" className="store-reports-center__sort" onClick={() => toggleSort("title")}>
                            {t("reportsCenter.colName")}
                          </button>
                        </th>
                        <th>
                          <button type="button" className="store-reports-center__sort" onClick={() => toggleSort("category")}>
                            {t("reportsCenter.colCategory")}
                          </button>
                        </th>
                        <th>{t("reportsCenter.colCreatedBy")}</th>
                        <th>
                          <button type="button" className="store-reports-center__sort" onClick={() => toggleSort("last_visited_at")}>
                            {t("reportsCenter.colLastVisited")}
                          </button>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((row) => {
                        const visited = formatReportLastVisited(row.last_visited_at);
                        return (
                          <tr key={row.slug}>
                            <td>
                              <div className="store-reports-center__name-cell">
                                <button
                                  type="button"
                                  className={`store-reports-center__star ${row.is_favorite ? "store-reports-center__star--on" : ""}`}
                                  aria-label={t("reportsCenter.favoriteAria")}
                                  aria-pressed={!!row.is_favorite}
                                  onClick={(e) => onToggleFavorite(row, e)}
                                >
                                  <Star className={`h-4 w-4 ${row.is_favorite ? "fill-current" : ""}`} aria-hidden />
                                </button>
                                <Link
                                  to={row.href || `/reports/${encodeURIComponent(row.slug)}`}
                                  className="store-reports-center__report-link"
                                >
                                  {row.title}
                                </Link>
                              </div>
                            </td>
                            <td>{row.category}</td>
                            <td>{row.created_by || t("reportsCenter.systemGenerated")}</td>
                            <td>{visited || t("reportsCenter.noVisit")}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <div className="border-t border-[var(--color-border-soft)] p-3">
                    <Pagination
                      page={pagination.page}
                      pageSize={pagination.page_size}
                      total={pagination.total_rows}
                      onPageChange={(p) => patchParams({ page: p })}
                    />
                  </div>
                </>
              )}
            </AsyncPageBody>
          </div>
        </div>
      </div>

      {showScrollTop ? (
        <button
          type="button"
          className="store-reports-center__scroll-top"
          aria-label={t("reportsCenter.scrollTop")}
          onClick={() => tableWrapRef.current?.scrollTo({ top: 0, behavior: "smooth" })}
        >
          <ArrowUp className="h-5 w-5" aria-hidden />
        </button>
      ) : null}

      <ReportScheduleFormModal
        open={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
        onSaved={() => {
          if (section === "scheduled") load();
          else patchParams({ section: "scheduled", page: 1 });
        }}
      />
    </div>
  );
}
