import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  ChevronUp,
  ChevronDown,
  Pencil,
  Trash2,
  Shield,
  Users,
} from "lucide-react";

import useAuth from "../../hooks/useAuth";
import usePageRefresh from "../../hooks/usePageRefresh";
import { getRoles } from "../../api/adminApi";
import { SearchBar } from "../../components/common/SearchFilter";
import { useToast } from "../../context/ToastContext";
import Button from "../../components/common/Button";
import RowActionMenu from "../../components/common/RowActionMenu";

const ROWS_PER_PAGE_OPTIONS = [5, 7, 10, 25, 50];

export default function SettingsTeams() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { user } = useAuth();
  const tenantId = user?.tenant_id ?? 1;
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState({
    name: "",
    description: "",
  });
  const [sort, setSort] = useState({ key: "name", dir: "asc" });
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(7);
  const [openMenu, setOpenMenu] = useState(null);

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const r = await getRoles(tenantId);
      setTeams(r.data || []);
    } catch (err) {
      if (!isRefresh) setTeams([]);
      if (isRefresh) throw err;
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  usePageRefresh(() => load(true));

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    let list = [...teams];
    if (search.name) {
      const q = search.name.toLowerCase();
      list = list.filter((t) =>
        (t.name || "").toLowerCase().includes(q)
      );
    }
    if (search.description) {
      const q = search.description.toLowerCase();
      list = list.filter((t) =>
        (t.description || "").toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => {
      const av = a[sort.key] ?? "";
      const bv = b[sort.key] ?? "";
      const cmp = String(av).localeCompare(String(bv));
      return sort.dir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [teams, search, sort]);

  const total = filtered.length;
  const start = page * rowsPerPage;
  const paginated = filtered.slice(start, start + rowsPerPage);
  const totalPages = Math.max(1, Math.ceil(total / rowsPerPage));

  const SortHeader = ({ colKey, label }) => (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={() =>
          setSort((s) => ({
            key: colKey,
            dir: s.key === colKey && s.dir === "asc" ? "desc" : "asc",
          }))
        }
        className="flex items-center gap-1 text-left font-semibold text-slate-700 dark:text-slate-300"
      >
        {label}
        <span className="flex">
          <ChevronUp
            className={`h-3.5 w-3.5 ${
              sort.key === colKey && sort.dir === "asc"
                ? "text-teal-600"
                : "text-slate-400"
            }`}
          />
          <ChevronDown
            className={`-ml-2 h-3.5 w-3.5 ${
              sort.key === colKey && sort.dir === "desc"
                ? "text-teal-600"
                : "text-slate-400"
            }`}
          />
        </span>
      </button>
      <SearchBar
        value={search[colKey] ?? ""}
        onChange={(v) => setSearch((s) => ({ ...s, [colKey]: v }))}
        placeholder="Search"
        size="compact"
        className="min-w-0 w-full flex-none"
      />
    </div>
  );

  return (
    <div className="mx-auto max-w-6xl">
      {/* Page header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            Teams
          </h1>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            Manage teams of your company
          </p>
        </div>
        <Button variant="add" type="button" onClick={() => navigate("/admin/roles")} leftIcon={<Plus className="h-4 w-4" aria-hidden />}>
          Add Team
        </Button>
      </div>

      {/* Table */}
      <div className="ui-table-wrap ui-table-wrap--scroll overflow-hidden">
        <table className="ui-table w-full border-collapse">
          <thead className="ui-table-head">
            <tr>
              <th className="border-b border-slate-200 px-4 py-3 text-left dark:border-slate-700">
                <SortHeader colKey="name" label="Team" />
              </th>
              <th className="border-b border-slate-200 px-4 py-3 text-left dark:border-slate-700">
                <SortHeader colKey="description" label="Description" />
              </th>
              <th className="border-b border-slate-200 px-4 py-3 text-left dark:border-slate-700">
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  Users
                </span>
              </th>
              <th className="border-b border-slate-200 px-4 py-3 text-left dark:border-slate-700">
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  Actions
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                  Loading...
                </td>
              </tr>
            ) : paginated.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                  No teams found
                </td>
              </tr>
            ) : (
              paginated.map((t) => (
                <tr
                  key={t.id}
                  className="border-b border-slate-100 hover:bg-slate-50/50 last:border-b-0 dark:border-slate-700/50 dark:hover:bg-slate-800/30"
                >
                  <td className="px-4 py-3 text-sm font-medium text-slate-800 dark:text-slate-200">
                    {t.name}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300">
                    {t.description || "—"}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300">
                    {t.user_count != null && t.user_count > 0
                      ? t.user_count
                      : "—"}
                  </td>
                  <td className="px-4 py-2" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end">
                      <RowActionMenu
                        rowId={t.id}
                        openMenu={openMenu}
                        setOpenMenu={setOpenMenu}
                        items={[
                          {
                            label: "Edit Team",
                            icon: <Pencil className="h-4 w-4" />,
                            onClick: () => navigate("/admin/roles"),
                          },
                          {
                            label: "Permissions (PRO)",
                            icon: <Shield className="h-4 w-4" />,
                            onClick: () => navigate("/admin/roles"),
                          },
                          {
                            label: "View Users",
                            icon: <Users className="h-4 w-4" />,
                            onClick: () => navigate("/admin/users"),
                          },
                          { divider: true },
                          {
                            label: "Delete",
                            icon: <Trash2 className="h-4 w-4" />,
                            danger: true,
                            onClick: () => {
                              if (!window.confirm(`Remove team "${t.name}" from this list?`)) return;
                              setTeams((rows) => rows.filter((row) => row.id !== t.id));
                              addToast(`Team "${t.name}" removed from list`, "success");
                            },
                          },
                        ]}
                      />
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="mt-4 ui-pagination justify-between border-t border-[var(--color-border-soft)] pt-4">
        <div className="flex items-center gap-2.5 flex-nowrap whitespace-nowrap text-[13px] text-[#596b82]">
          <span>Rows per page:</span>
          <select
            value={rowsPerPage}
            onChange={(e) => {
              setRowsPerPage(Number(e.target.value));
              setPage(0);
            }}
            className="ui-pagination-select"
          >
            {ROWS_PER_PAGE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <span>
            {total === 0
              ? "0–0 of 0"
              : `${start + 1}–${Math.min(start + rowsPerPage, total)} of ${total}`}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="ui-page-btn"
            aria-label="Previous page"
          >
            ‹
          </button>
          <button
            type="button"
            className="ui-page-btn ui-page-btn--active"
          >
            {page + 1}
          </button>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="ui-page-btn"
            aria-label="Next page"
          >
            ›
          </button>
        </div>
      </div>
    </div>
  );
}
