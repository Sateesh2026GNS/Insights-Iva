import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, ChevronRight, Search, X } from "lucide-react";

import Button from "../common/Button";
import {
  ROLE_ACCESS_MODULES,
  ROLE_TYPE_OPTIONS,
  PERMISSION_COLUMNS,
  buildEmptyGrants,
  emptyGrantRow,
  fullGrantRow,
  getMorePermissions,
  grantsToPermissionCodes,
  isRowFullyGranted,
  permissionCodesToGrants,
  rowHasExtraGrants,
  sectionHasAnyGrant,
  sectionIsFullAccess,
} from "../../config/roleAccessModules";

const inputClass =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]";

function FieldLabel({ children, required = false }) {
  return (
    <label className="mb-1 block text-sm font-medium text-[var(--color-danger)]">
      {children}
      {required ? <span>*</span> : null}
    </label>
  );
}

function Stepper({ step }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className={`inline-flex items-center gap-2 ${step >= 1 ? "font-semibold text-[var(--color-info)]" : "text-slate-500"}`}>
        <span
          className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
            step > 1
              ? "bg-[var(--color-info)] text-white"
              : step === 1
                ? "bg-[var(--color-info)] text-white"
                : "border border-slate-300 text-slate-500"
          }`}
        >
          {step > 1 ? <Check className="h-3.5 w-3.5" /> : "1"}
        </span>
        General
      </span>
      <ChevronRight className="h-4 w-4 text-slate-400" />
      <span className={`inline-flex items-center gap-2 ${step === 2 ? "font-semibold text-[var(--color-info)]" : "text-slate-500"}`}>
        <span
          className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
            step === 2 ? "bg-[var(--color-info)] text-white" : "border border-slate-300 text-slate-500"
          }`}
        >
          2
        </span>
        Segmented Access Control
      </span>
    </div>
  );
}

function MorePermissionsPopover({
  open,
  anchorEl,
  permissions,
  extras = {},
  disabled,
  onToggle,
  onClose,
}) {
  const popoverRef = useRef(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!open || !anchorEl) return undefined;
    const rect = anchorEl.getBoundingClientRect();
    setPosition({
      top: rect.bottom + 6,
      left: Math.max(12, rect.right - 224),
    });
    const handlePointerDown = (event) => {
      if (popoverRef.current?.contains(event.target) || anchorEl.contains(event.target)) {
        return;
      }
      onClose?.();
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, anchorEl, onClose]);

  if (!open || !permissions.length || !anchorEl) return null;

  return createPortal(
    <div
      ref={popoverRef}
      className="fixed z-[200] w-56 rounded-md border border-slate-200 bg-white p-3 shadow-lg"
      style={{ top: position.top, left: position.left }}
      role="dialog"
      aria-label="More permissions"
    >
      <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">More Permissions</p>
      <div className="space-y-2">
        {permissions.map((perm) => (
          <label key={perm.key} className="flex items-center gap-2 text-sm text-slate-800">
            <input
              type="checkbox"
              disabled={disabled}
              checked={Boolean(extras[perm.key])}
              onChange={(e) => onToggle(perm.key, e.target.checked)}
              className="rounded border-slate-300 text-[var(--color-info)]"
            />
            {perm.label}
          </label>
        ))}
      </div>
    </div>,
    document.body
  );
}

function PermissionTable({ mod, grants, disabled, onToggle, onToggleExtra, morePopover, onOpenMore, onCloseMore }) {
  const anchorRefs = useRef({});

  return (
    <table className="w-full min-w-[680px] text-left text-sm">
      <thead className="bg-white text-[10px] font-bold uppercase tracking-wide text-slate-500">
        <tr className="border-b border-slate-200">
          <th className="px-4 py-2.5">Particulars</th>
          {PERMISSION_COLUMNS.map((col) => (
            <th key={col.key} className="px-2 py-2.5 text-center">{col.label}</th>
          ))}
          <th className="px-2 py-2.5 text-center">Others</th>
        </tr>
      </thead>
      <tbody>
        {mod.particulars.map((particular) => {
          const row = grants[mod.id]?.[particular.key] || {};
          const partialFull =
            row.view || row.create || row.edit || row.delete || row.approve || rowHasExtraGrants(row);
          const indeterminate = partialFull && !row.full;
          const morePermissions = particular.morePermissions
            ? getMorePermissions(mod.id, particular.key)
            : [];
          const extraCount = morePermissions.filter((perm) => row.extras?.[perm.key]).length;
          const popoverOpen =
            morePopover?.modId === mod.id && morePopover?.particularKey === particular.key;

          return (
            <tr key={particular.key} className="border-b border-slate-100">
              <td className="px-4 py-2.5 font-medium text-slate-800">{particular.label}</td>
              {PERMISSION_COLUMNS.map((col) => (
                <td key={col.key} className="px-2 py-2.5 text-center">
                  {col.key === "full" && indeterminate ? (
                    <span className="inline-block h-4 w-4 rounded border border-[var(--color-info)] bg-[var(--color-info-soft)] text-[10px] leading-4 text-[var(--color-info)]">
                      −
                    </span>
                  ) : (
                    <input
                      type="checkbox"
                      disabled={disabled}
                      checked={Boolean(row[col.key])}
                      onChange={(e) => onToggle(mod.id, particular.key, col.key, e.target.checked)}
                      className="rounded border-slate-300 text-[var(--color-info)]"
                    />
                  )}
                </td>
              ))}
              <td className="relative px-2 py-2.5 text-center">
                {particular.morePermissions ? (
                  <>
                    <button
                      ref={(el) => {
                        anchorRefs.current[`${mod.id}.${particular.key}`] = el;
                      }}
                      type="button"
                      disabled={disabled}
                      onClick={() => {
                        if (popoverOpen) onCloseMore?.();
                        else onOpenMore?.(mod.id, particular.key);
                      }}
                      className={`text-xs font-medium hover:underline ${
                        extraCount ? "text-[var(--color-info)]" : "text-[var(--color-info)]"
                      }`}
                    >
                      More Permissions{extraCount ? ` (${extraCount})` : ""}
                    </button>
                    <MorePermissionsPopover
                      open={popoverOpen}
                      anchorEl={anchorRefs.current[`${mod.id}.${particular.key}`]}
                      permissions={morePermissions}
                      extras={row.extras}
                      disabled={disabled}
                      onToggle={(extraKey, checked) => onToggleExtra(mod.id, particular.key, extraKey, checked)}
                      onClose={onCloseMore}
                    />
                  </>
                ) : null}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function ListPermissions({ mod, grants, disabled, onToggleList, onFullAccess }) {
  const full = sectionIsFullAccess(mod, grants[mod.id]);
  return (
    <div>
      <div className="flex items-center justify-end border-b border-slate-100 px-4 py-2">
        <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
          <input
            type="checkbox"
            disabled={disabled}
            checked={full}
            onChange={(e) => onFullAccess(mod.id, e.target.checked)}
            className="rounded border-slate-300 text-[var(--color-info)]"
          />
          Full Access
        </label>
      </div>
      <p className="px-4 pt-3 text-[10px] font-bold uppercase tracking-wide text-slate-400">Permissions</p>
      <div className="space-y-2 px-4 py-3">
        {mod.listPermissions.map((perm) => (
          <label key={perm.key} className="flex items-center gap-2 text-sm text-slate-800">
            <input
              type="checkbox"
              disabled={disabled}
              checked={Boolean(grants[mod.id]?.[perm.key])}
              onChange={(e) => onToggleList(mod.id, perm.key, e.target.checked)}
              className="rounded border-slate-300 text-[var(--color-info)]"
            />
            {perm.label}
          </label>
        ))}
      </div>
    </div>
  );
}

function SimplePermissions({ mod, grants, disabled, onToggleList, onFullAccess }) {
  const full = sectionIsFullAccess(mod, grants[mod.id]);
  return (
    <div>
      <div className="flex items-center justify-end border-b border-slate-100 px-4 py-2">
        <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
          <input
            type="checkbox"
            disabled={disabled}
            checked={full}
            onChange={(e) => onFullAccess(mod.id, e.target.checked)}
            className="rounded border-slate-300 text-[var(--color-info)]"
          />
          Full Access
        </label>
      </div>
      <p className="px-4 pt-3 text-[10px] font-bold uppercase tracking-wide text-slate-400">Permissions</p>
      <div className="space-y-2 px-4 py-3">
        {mod.particulars.map((perm) => (
          <label key={perm.key} className="flex items-center gap-2 text-sm text-slate-800">
            <input
              type="checkbox"
              disabled={disabled}
              checked={Boolean(grants[mod.id]?.[perm.key]?.view || grants[mod.id]?.[perm.key]?.full)}
              onChange={(e) => onToggleList(mod.id, perm.key, e.target.checked, true)}
              className="rounded border-slate-300 text-[var(--color-info)]"
            />
            {perm.label}
          </label>
        ))}
      </div>
    </div>
  );
}

export default function NewRoleModal({
  open,
  onClose,
  onSubmit,
  saving = false,
  editing = null,
  isSystemRole = false,
}) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    name: "",
    role_type: "user",
    description: "",
    api_only: false,
  });
  const [grants, setGrants] = useState(() => buildEmptyGrants());
  const [errors, setErrors] = useState({});
  const [moduleSearch, setModuleSearch] = useState("");
  const [activeModule, setActiveModule] = useState(ROLE_ACCESS_MODULES[0]?.id || "contacts");
  const [expanded, setExpanded] = useState(() => new Set([ROLE_ACCESS_MODULES[0]?.id]));
  const [morePopover, setMorePopover] = useState(null);
  const sectionRefs = useRef({});

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setModuleSearch("");
    setActiveModule(ROLE_ACCESS_MODULES[0]?.id || "contacts");
    setExpanded(new Set([ROLE_ACCESS_MODULES[0]?.id]));
    setMorePopover(null);
    setErrors({});
    if (editing) {
      setForm({
        name: editing.name || "",
        role_type: editing.is_system ? "system" : "user",
        description: (editing.description || "").replace(/^\[api-only\]\s*/i, ""),
        api_only: /^\[api-only\]/i.test(editing.description || ""),
      });
      setGrants(permissionCodesToGrants(editing.permissions || []));
    } else {
      setForm({ name: "", role_type: "user", description: "", api_only: false });
      setGrants(buildEmptyGrants());
    }
  }, [open, editing]);

  const filteredModules = useMemo(() => {
    const q = moduleSearch.trim().toLowerCase();
    if (!q) return ROLE_ACCESS_MODULES;
    return ROLE_ACCESS_MODULES.filter(
      (m) => m.label.toLowerCase().includes(q) || m.id.toLowerCase().includes(q)
    );
  }, [moduleSearch]);

  const scrollToModule = (modId) => {
    setActiveModule(modId);
    setExpanded((prev) => new Set([...prev, modId]));
    sectionRefs.current[modId]?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const validateStep1 = () => {
    const next = {};
    if (!form.name.trim()) next.name = "Role name is required";
    if (!form.role_type) next.role_type = "Role type is required";
    if (form.description.length > 500) next.description = "Description must be 500 characters or less";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleProceed = () => {
    if (step === 1) {
      if (!validateStep1()) return;
      setStep(2);
      return;
    }
    const description = [form.api_only ? "[api-only]" : "", form.description.trim()]
      .filter(Boolean)
      .join(" ")
      .trim();
    onSubmit?.({
      name: form.name.trim(),
      description: description || null,
      permissions: isSystemRole ? editing?.permissions || [] : grantsToPermissionCodes(grants),
    });
  };

  const applyFullRow = (row, full, morePermissions = []) => {
    row.view = full;
    row.create = full;
    row.edit = full;
    row.delete = full;
    row.approve = full;
    row.extras = { ...(row.extras || {}) };
    morePermissions.forEach((perm) => {
      row.extras[perm.key] = full;
    });
    row.full = full ? true : isRowFullyGranted(row, morePermissions);
    return row;
  };

  const toggleGrant = (modId, particularKey, colKey, checked) => {
    if (isSystemRole) return;
    const morePermissions = getMorePermissions(modId, particularKey);
    setGrants((prev) => {
      const next = { ...prev };
      const mod = { ...next[modId] };
      const row = { ...mod[particularKey], extras: { ...(mod[particularKey]?.extras || {}) } };
      if (colKey === "full") {
        applyFullRow(row, checked, morePermissions);
      } else {
        row[colKey] = checked;
        row.full = isRowFullyGranted(row, morePermissions);
      }
      mod[particularKey] = row;
      next[modId] = mod;
      return next;
    });
  };

  const toggleExtraGrant = (modId, particularKey, extraKey, checked) => {
    if (isSystemRole) return;
    const morePermissions = getMorePermissions(modId, particularKey);
    setGrants((prev) => {
      const next = { ...prev };
      const mod = { ...next[modId] };
      const row = { ...mod[particularKey], extras: { ...(mod[particularKey]?.extras || {}) } };
      row.extras[extraKey] = checked;
      row.full = isRowFullyGranted(row, morePermissions);
      mod[particularKey] = row;
      next[modId] = mod;
      return next;
    });
  };

  const toggleListPerm = (modId, permKey, checked, asRow = false) => {
    if (isSystemRole) return;
    setGrants((prev) => {
      const next = { ...prev };
      const mod = { ...next[modId] };
      if (asRow) {
        mod[permKey] = checked ? fullGrantRow() : emptyGrantRow();
      } else {
        mod[permKey] = checked;
      }
      next[modId] = mod;
      return next;
    });
  };

  const setFullAccess = (modId, checked) => {
    if (isSystemRole) return;
    const mod = ROLE_ACCESS_MODULES.find((m) => m.id === modId);
    if (!mod) return;
    setGrants((prev) => {
      const next = { ...prev };
      const section = { ...next[modId] };
      if (mod.layout === "list") {
        mod.listPermissions.forEach((p) => {
          section[p.key] = checked;
        });
      } else if (mod.layout === "simple") {
        mod.particulars.forEach((p) => {
          section[p.key] = checked ? fullGrantRow() : emptyGrantRow();
        });
      } else {
        mod.particulars.forEach((p) => {
          const more = p.morePermissions ? getMorePermissions(modId, p.key) : [];
          section[p.key] = checked
            ? applyFullRow(emptyGrantRow(more), true, more)
            : emptyGrantRow(more);
        });
      }
      next[modId] = section;
      return next;
    });
  };

  const toggleExpanded = (modId) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(modId)) next.delete(modId);
      else next.add(modId);
      return next;
    });
  };

  if (!open) return null;

  const title = editing ? "Edit Role" : "New Role";

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 p-4"
      onMouseDown={(e) => e.target === e.currentTarget && !saving && onClose?.()}
    >
      <div
        className={`flex max-h-[92vh] w-full flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl ${
          step === 2 ? "max-w-6xl" : "max-w-2xl"
        }`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-role-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
          <div className="space-y-3">
            <h2 id="new-role-title" className="text-base font-bold text-slate-900">{title}</h2>
            <Stepper step={step} />
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded p-1 text-rose-500 hover:bg-rose-50"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          {step === 1 ? (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-[140px_1fr] sm:items-center">
                <FieldLabel required>Role Name</FieldLabel>
                <div>
                  <input
                    type="text"
                    value={form.name}
                    disabled={isSystemRole}
                    onChange={(e) => {
                      setForm((prev) => ({ ...prev, name: e.target.value }));
                      if (errors.name) setErrors((prev) => ({ ...prev, name: null }));
                    }}
                    className={inputClass}
                  />
                  {errors.name ? <p className="mt-1 text-xs text-rose-600">{errors.name}</p> : null}
                </div>

                <FieldLabel required>Role Type</FieldLabel>
                <select
                  value={form.role_type}
                  onChange={(e) => setForm((prev) => ({ ...prev, role_type: e.target.value }))}
                  className={inputClass}
                  disabled={isSystemRole}
                >
                  {ROLE_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>

                <label className="self-start pt-2 text-sm font-medium text-slate-700">Description</label>
                <div>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                    rows={4}
                    maxLength={500}
                    placeholder="Max. 500 characters"
                    className={`${inputClass} resize-y`}
                  />
                </div>
              </div>

              <div className="border-t border-dashed border-slate-200 pt-4">
                <label className="flex items-start gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.api_only}
                    onChange={(e) => setForm((prev) => ({ ...prev, api_only: e.target.checked }))}
                    className="mt-0.5 rounded border-slate-300 text-[var(--color-info)]"
                  />
                  <span>Users in this role can access Insights Iva only via API.</span>
                </label>
              </div>
            </div>
          ) : (
            <div className="grid min-h-[480px] gap-0 overflow-hidden rounded-lg border border-slate-200 lg:grid-cols-[200px_1fr]">
              <aside className="border-b border-slate-200 bg-slate-50 lg:border-b-0 lg:border-r">
                <div className="border-b border-slate-200 p-3">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={moduleSearch}
                      onChange={(e) => setModuleSearch(e.target.value)}
                      placeholder="Search"
                      className="w-full rounded-md border border-slate-300 bg-white py-2 pl-8 pr-3 text-sm"
                    />
                  </div>
                </div>
                <div className="max-h-[420px] overflow-y-auto p-2">
                  <p className="px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">Modules</p>
                  {filteredModules.map((mod) => (
                    <button
                      key={mod.id}
                      type="button"
                      onClick={() => scrollToModule(mod.id)}
                      className={`mb-0.5 block w-full rounded-md px-3 py-2 text-left text-sm ${
                        activeModule === mod.id
                          ? "bg-[var(--color-info-soft)] font-semibold text-[var(--color-info)]"
                          : "text-slate-700 hover:bg-white"
                      }`}
                    >
                      {mod.label}
                    </button>
                  ))}
                </div>
              </aside>

              <div
                className="max-h-[480px] overflow-y-auto p-4"
                onScroll={() => morePopover && setMorePopover(null)}
              >
                <h3 className="mb-3 text-sm font-bold text-slate-800">Define Role Permission</h3>
                {isSystemRole ? (
                  <div className="rounded-lg border border-teal-200 bg-[var(--color-success-soft)] p-4 text-sm text-[var(--color-success)]">
                    The Admin role always has full access to every module and cannot be restricted.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {ROLE_ACCESS_MODULES.map((mod) => {
                      const isOpen = expanded.has(mod.id);
                      const hasGrant = sectionHasAnyGrant(mod, grants[mod.id]);
                      const fullAccess = sectionIsFullAccess(mod, grants[mod.id]);
                      return (
                        <section
                          key={mod.id}
                          ref={(el) => {
                            sectionRefs.current[mod.id] = el;
                          }}
                          className="overflow-hidden rounded-lg border border-slate-200 bg-white"
                        >
                          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-4 py-2.5">
                            <button
                              type="button"
                              onClick={() => toggleExpanded(mod.id)}
                              className="flex flex-1 items-center gap-2 text-left text-sm font-semibold text-slate-800"
                            >
                              {isOpen ? (
                                <ChevronDown className="h-4 w-4 text-slate-500" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-slate-500" />
                              )}
                              {mod.label}
                              {hasGrant && !isOpen ? (
                                <span className="ml-1 text-[10px] font-normal text-[var(--color-info)]">(configured)</span>
                              ) : null}
                            </button>
                            {(mod.layout === "list" || mod.layout === "simple") && !isOpen ? (
                              <label className="flex items-center gap-2 text-xs text-slate-600">
                                <input
                                  type="checkbox"
                                  checked={fullAccess}
                                  onChange={(e) => setFullAccess(mod.id, e.target.checked)}
                                  className="rounded border-slate-300 text-[var(--color-info)]"
                                />
                                Full Access
                              </label>
                            ) : null}
                          </div>
                          {isOpen ? (
                            <div className="overflow-x-auto">
                              {mod.layout === "table" ? (
                                <PermissionTable
                                  mod={mod}
                                  grants={grants}
                                  disabled={isSystemRole}
                                  onToggle={toggleGrant}
                                  onToggleExtra={toggleExtraGrant}
                                  morePopover={morePopover}
                                  onOpenMore={(modId, particularKey) =>
                                    setMorePopover({ modId, particularKey })
                                  }
                                  onCloseMore={() => setMorePopover(null)}
                                />
                              ) : mod.layout === "list" ? (
                                <ListPermissions
                                  mod={mod}
                                  grants={grants}
                                  disabled={isSystemRole}
                                  onToggleList={toggleListPerm}
                                  onFullAccess={setFullAccess}
                                />
                              ) : (
                                <SimplePermissions
                                  mod={mod}
                                  grants={grants}
                                  disabled={isSystemRole}
                                  onToggleList={toggleListPerm}
                                  onFullAccess={setFullAccess}
                                />
                              )}
                            </div>
                          ) : null}
                        </section>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2 border-t border-slate-200 px-5 py-4">
          {step === 2 ? (
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setMorePopover(null);
                setStep(1);
              }}
              disabled={saving}
            >
              Back
            </Button>
          ) : null}
          <Button type="button" variant="primary" onClick={handleProceed} disabled={saving} loading={saving}>
            {step === 1 ? "Proceed" : "Save"}
          </Button>
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
