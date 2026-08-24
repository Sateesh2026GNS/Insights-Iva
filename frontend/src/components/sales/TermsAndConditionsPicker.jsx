import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MoreVertical, Pencil, Plus, Search, Trash2, User, X } from "lucide-react";

import AddTermsAndConditionsModal from "./AddTermsAndConditionsModal";

const PRIMARY = "var(--color-primary)";
const STORAGE_KEY = "gns_invoice_terms_templates";

const DEFAULT_BODY =
  "1. This is an electronically generated document.\n2. All disputes are subject to seller city jurisdiction.";

function loadTemplates() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length) return parsed;
    }
  } catch {
    /* ignore */
  }
  return [{ id: "terms-default", body: DEFAULT_BODY, isDefault: true }];
}

function saveTemplates(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

/**
 * Screenshot-matching Terms & Conditions picker (modal).
 */
export default function TermsAndConditionsPicker({
  open,
  onClose,
  value,
  onChange,
  onRemove,
}) {
  const [templates, setTemplates] = useState(loadTemplates);
  const [search, setSearch] = useState("");
  const [highlightId, setHighlightId] = useState(null);
  const [menuId, setMenuId] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const menuRef = useRef(null);

  useEffect(() => {
    saveTemplates(templates);
  }, [templates]);

  useEffect(() => {
    if (!open) return;
    setSearch("");
    if (value) {
      const match = templates.find((t) => t.body === value);
      setHighlightId(match?.id || null);
    }
  }, [open, value, templates]);

  useEffect(() => {
    if (!menuId) return;
    const onDoc = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuId(null);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return templates;
    return templates.filter((t) => t.body.toLowerCase().includes(q));
  }, [templates, search]);

  if (!open) return null;

  const upsert = (item) => {
    setTemplates((prev) => {
      const exists = prev.some((t) => t.id === item.id);
      if (exists) return prev.map((t) => (t.id === item.id ? { ...t, ...item } : t));
      return [...prev, item];
    });
    setHighlightId(item.id);
  };

  const removeTemplate = (id) => {
    setTemplates((prev) => {
      const next = prev.filter((t) => t.id !== id);
      if (!next.length) {
        return [{ id: "terms-default", body: DEFAULT_BODY, isDefault: true }];
      }
      if (!next.some((t) => t.isDefault)) {
        next[0] = { ...next[0], isDefault: true };
      }
      return next;
    });
    setMenuId(null);
    if (highlightId === id) setHighlightId(null);
  };

  const setAsDefault = (id) => {
    setTemplates((prev) => prev.map((t) => ({ ...t, isDefault: t.id === id })));
    setMenuId(null);
  };

  const handleSelect = () => {
    const picked =
      templates.find((t) => t.id === highlightId) ||
      templates.find((t) => t.isDefault) ||
      templates[0];
    if (!picked) return;
    onChange?.(picked.body);
    onClose?.();
  };

  const panel = (
    <div className="w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl">
      <div className="p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9a9aa5]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search"
            className="w-full rounded-xl border border-[#dcdce3] bg-white py-2.5 pl-9 pr-3 text-[13px] text-[#1a1a1f] placeholder:text-[#a0a0ab] focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
          />
        </div>
      </div>

      <div className="max-h-56 space-y-2 overflow-y-auto px-3 pb-2">
        {filtered.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-[#8a8a95]">No terms found</p>
        ) : (
          filtered.map((t) => {
            const active = highlightId === t.id || (!highlightId && t.isDefault);
            return (
              <div
                key={t.id}
                role="button"
                tabIndex={0}
                onClick={() => setHighlightId(t.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setHighlightId(t.id);
                  }
                }}
                className={`relative flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-3 text-left transition ${
                  active
                    ? "border-[var(--color-primary)] bg-[var(--color-primary-soft)]"
                    : "border-[#ececf0] bg-white hover:border-[#d8d8e0]"
                }`}
              >
                <pre className="min-w-0 flex-1 whitespace-pre-wrap font-sans text-[13px] leading-relaxed text-[#1a1a1f]">
                  {t.body}
                </pre>
                <div className="flex shrink-0 items-center gap-1.5">
                  {t.isDefault ? (
                    <span className="rounded-full bg-[#dcfce7] px-2.5 py-1 text-[11px] font-semibold text-[#166534]">
                      Default
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setAsDefault(t.id);
                      }}
                      className="rounded-full bg-[#f0f0f4] px-2.5 py-1 text-[11px] font-semibold text-[#6b6b76] hover:bg-[#e4e4ea]"
                    >
                      Default
                    </button>
                  )}
                  <div className="relative" ref={menuId === t.id ? menuRef : null}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuId((id) => (id === t.id ? null : t.id));
                      }}
                      className="rounded-full p-1.5 text-[#6b6b76] hover:bg-[#f0f0f4]"
                      aria-label="More actions"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </button>
                    {menuId === t.id ? (
                      <div className="absolute right-0 top-full z-20 mt-1 min-w-[140px] overflow-hidden rounded-xl border border-[#ececf0] bg-white py-1 shadow-lg">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditing(t);
                            setAddOpen(true);
                            setMenuId(null);
                          }}
                          className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-[13px] font-medium text-[#1a1a1f] hover:bg-[#f7f7f9]"
                        >
                          <Pencil className="h-3.5 w-3.5" /> Edit
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeTemplate(t.id);
                          }}
                          className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-[13px] font-medium text-[#dc2626] hover:bg-[#fef2f2]"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Delete
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <button
        type="button"
        onClick={() => {
          setEditing(null);
          setAddOpen(true);
        }}
        className="flex w-full items-center justify-center gap-1.5 border-t border-[#ececf0] bg-[var(--color-primary-soft)] py-3 text-[13px] font-semibold text-[var(--color-primary)] hover:bg-[var(--color-primary-soft)]/80 transition-colors"
      >
        <Plus className="h-4 w-4" /> Add Terms and Conditions
      </button>

      <div className="grid grid-cols-2 gap-3 border-t border-[#ececf0] bg-white p-3">
        <button
          type="button"
          onClick={() => {
            setHighlightId(null);
            onRemove?.();
            onClose?.();
          }}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white py-3 text-[13px] font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
        >
          <X className="h-4 w-4" /> Remove
        </button>
        <button
          type="button"
          onClick={handleSelect}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[var(--color-primary)] py-3 text-[13px] font-semibold text-white hover:bg-[var(--color-primary-hover)] transition-colors shadow-sm"
        >
          <User className="h-4 w-4" /> Select Terms and Conditions
        </button>
      </div>

      <AddTermsAndConditionsModal
        open={addOpen}
        onClose={() => {
          setAddOpen(false);
          setEditing(null);
        }}
        initial={editing}
        onSave={upsert}
      />
    </div>
  );

  return createPortal(
    <div
      className="fixed inset-0 z-[95] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <div onMouseDown={(e) => e.stopPropagation()}>{panel}</div>
    </div>,
    document.body
  );
}

export { DEFAULT_BODY as DEFAULT_TERMS_BODY };
