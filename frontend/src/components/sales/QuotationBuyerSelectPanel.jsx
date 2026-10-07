import {
  CircleMinus,
  MoreVertical,
  Pencil,
  Star,
  Trash2,
} from "lucide-react";

import { SearchBar } from "../common/SearchFilter";
import { ERP_PRIMARY, ERP_PRIMARY_SOFT } from "../../design-system/erpFormControls";

function partyBalanceLabel(customer) {
  const raw =
    customer?.balance ??
    customer?.opening_balance ??
    customer?.outstanding_balance ??
    0;
  const n = Number(raw);
  const val = Number.isFinite(n) ? n : 0;
  return `₹ ${val.toFixed(0)}`;
}

function isInactive(customer) {
  if (customer?.is_active === false) return true;
  const s = String(customer?.status || "active").toLowerCase();
  return s === "inactive";
}

export default function QuotationBuyerSelectPanel({
  search,
  onSearchChange,
  customers,
  selectedCustomerId,
  onSelect,
  onAddNew,
  partyMenuId,
  onPartyMenuIdChange,
  favoriteIds,
  onToggleFavorite,
  onEditParty,
  onMarkInactive,
  onMarkActive,
  onDeleteParty,
}) {
  const sorted = [...customers].sort((a, b) => {
    const af = favoriteIds.has(String(a.id)) ? 1 : 0;
    const bf = favoriteIds.has(String(b.id)) ? 1 : 0;
    return bf - af;
  });

  return (
    <div className="mb-3 overflow-hidden rounded-xl border border-[#e4e4ea] bg-white shadow-sm">
      <div className="border-b border-[#ececf0] p-2.5">
        <SearchBar
          size="compact"
          value={search}
          onChange={onSearchChange}
          placeholder="Search"
          autoFocus
          className="w-full"
        />
      </div>

      <div className="max-h-52 overflow-y-auto">
        {sorted.length === 0 ? (
          <p className="px-3 py-6 text-center text-[13px] text-[#8a8a95]">No Party found</p>
        ) : (
          sorted.map((c) => {
            const id = String(c.id);
            const fav = favoriteIds.has(id);
            const inactive = isInactive(c);
            return (
              <div
                key={c.id}
                role="button"
                tabIndex={0}
                onClick={() => onSelect?.(c.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelect?.(c.id);
                  }
                }}
                className={`flex cursor-pointer items-start gap-2 border-b border-[#f3f3f6] px-3 py-2.5 hover:bg-[#fafafa] ${
                  String(selectedCustomerId) === id ? "bg-[#f7f7fb]" : ""
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-[#1a1a1f]">
                    {c.name || c.company}
                    {inactive ? (
                      <span className="ml-2 text-[11px] font-medium text-[#b45309]">
                        (Inactive)
                      </span>
                    ) : null}
                  </p>
                  {(c.gstin || c.city) && (
                    <p className="text-[11px] text-[#8a8a95]">
                      {[c.gstin ? `GSTIN: ${c.gstin}` : null, c.city ? `City: ${c.city}` : null]
                        .filter(Boolean)
                        .join(" | ")}
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFavorite?.(c.id);
                  }}
                  className="mt-0.5 shrink-0 rounded p-0.5"
                  aria-label={fav ? "Remove favorite" : "Mark favorite"}
                >
                  <Star
                    className={`h-4 w-4 ${
                      fav
                        ? "fill-[var(--color-primary)] text-[var(--color-primary)]"
                        : "text-[#c4c4cc]"
                    }`}
                  />
                </button>

                <span className="mt-0.5 shrink-0 rounded-full bg-[#e6f4ea] px-2 py-0.5 text-[11px] font-semibold text-[#166534]">
                  {partyBalanceLabel(c)}
                </span>

                <div className="relative shrink-0">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onPartyMenuIdChange?.(partyMenuId === c.id ? null : c.id);
                    }}
                    className="rounded-full bg-[#f0f0f4] p-1"
                    aria-label="Party actions"
                  >
                    <MoreVertical className="h-3.5 w-3.5" />
                  </button>
                  {partyMenuId === c.id ? (
                    <div
                      className="absolute right-0 z-40 mt-1 w-44 overflow-hidden rounded-xl border border-[#ececf0] bg-white py-1 shadow-lg"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] hover:bg-[#f7f7f9]"
                        onClick={() => {
                          onPartyMenuIdChange?.(null);
                          onEditParty?.(c);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" /> Edit Party
                      </button>
                      {inactive ? (
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-[#b45309] hover:bg-[#f7f7f9]"
                          onClick={() => {
                            onPartyMenuIdChange?.(null);
                            onMarkActive?.(c);
                          }}
                        >
                          <CircleMinus className="h-3.5 w-3.5" /> Mark as active
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-[#b45309] hover:bg-[#f7f7f9]"
                          onClick={() => {
                            onPartyMenuIdChange?.(null);
                            onMarkInactive?.(c);
                          }}
                        >
                          <CircleMinus className="h-3.5 w-3.5" /> Mark as inactive
                        </button>
                      )}
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-[#dc2626] hover:bg-[#f7f7f9]"
                        onClick={() => {
                          onPartyMenuIdChange?.(null);
                          onDeleteParty?.(c);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Delete Party
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })
        )}
      </div>

      <button
        type="button"
        onClick={onAddNew}
        className="flex w-full items-center justify-center gap-1 border-t border-[#ececf0] py-3 text-[13px] font-semibold"
        style={{ background: ERP_PRIMARY_SOFT, color: ERP_PRIMARY }}
      >
        + Add New Party
      </button>
    </div>
  );
}
