import { useCallback, useEffect, useState } from "react";
import { Factory, Gem, Package, Pill, Shirt, Smartphone, Store, Truck, UserRound, Warehouse, Plane, Settings2 } from "lucide-react";

import Loader from "../../components/common/Loader";
import { useToast } from "../../context/ToastContext";
import { getFeatureSetting, putFeatureSetting } from "../../api/bizDocumentsApi";
import { apiErrorMessage } from "../../utils/apiError";

const PAGE_BG = "var(--color-bg)";
const LABEL_GREEN = "#1B5E20";
const SETTING_KEY = "sector_settings";

const SECTORS = [
  {
    id: "manufacturing_trading",
    label: "Manufacturing and Trading",
    Icon: Factory,
    iconBg: "linear-gradient(145deg,#e0f2fe,#bae6fd)",
    iconColor: "#0369a1",
  },
  {
    id: "mobile_retailers",
    label: "Mobile Retailers",
    Icon: Smartphone,
    iconBg: "linear-gradient(145deg,#fce7f3,#fbcfe8)",
    iconColor: "#be185d",
  },
  {
    id: "pharma",
    label: "Pharma",
    Icon: Pill,
    iconBg: "linear-gradient(145deg,#dcfce7,#bbf7d0)",
    iconColor: "#15803d",
  },
  {
    id: "service_professionals",
    label: "Service professionals and freelancers",
    Icon: UserRound,
    iconBg: "linear-gradient(145deg,#e0e7ff,#c7d2fe)",
    iconColor: "#4338ca",
  },
  {
    id: "wholesalers_distributors",
    label: "Wholesalers and distributors",
    Icon: Warehouse,
    iconBg: "linear-gradient(145deg,#ffedd5,#fed7aa)",
    iconColor: "#c2410c",
  },
  {
    id: "tours_travels",
    label: "Tours and Travels",
    Icon: Plane,
    iconBg: "linear-gradient(145deg,#e0f2fe,#7dd3fc)",
    iconColor: "#0284c7",
  },
  {
    id: "retail",
    label: "Retail",
    Icon: Store,
    iconBg: "linear-gradient(145deg,#fef3c7,#fde68a)",
    iconColor: "#b45309",
  },
  {
    id: "garments_textile",
    label: "Garments and Textile",
    Icon: Shirt,
    iconBg: "linear-gradient(145deg,#f3e8ff,#e9d5ff)",
    iconColor: "#7e22ce",
  },
  {
    id: "jewellery",
    label: "Jewellery",
    Icon: Gem,
    iconBg: "linear-gradient(145deg,#ecfeff,#a5f3fc)",
    iconColor: "#0e7490",
  },
  {
    id: "transport",
    label: "Transport",
    Icon: Truck,
    iconBg: "linear-gradient(145deg,#fee2e2,#fecaca)",
    iconColor: "#b91c1c",
  },
  {
    id: "others",
    label: "Others",
    Icon: Package,
    iconBg: "linear-gradient(145deg,#f1f5f9,#e2e8f0)",
    iconColor: "#334155",
  },
];

export default function SectorSettingsV2() {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sector, setSector] = useState("manufacturing_trading");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await getFeatureSetting(SETTING_KEY);
        const value = res.data?.value;
        let next = "manufacturing_trading";
        if (typeof value === "string" && value) next = value;
        else if (value && typeof value === "object" && value.sector) next = value.sector;
        if (!SECTORS.some((s) => s.id === next)) next = "manufacturing_trading";
        if (!cancelled) setSector(next);
      } catch {
        if (!cancelled) setSector("manufacturing_trading");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const persist = useCallback(
    async (nextSector) => {
      setSaving(true);
      try {
        await putFeatureSetting(SETTING_KEY, {
          sector: nextSector,
          label: SECTORS.find((s) => s.id === nextSector)?.label || nextSector,
          updated_at: new Date().toISOString(),
        });
        addToast("Sector updated", "success");
      } catch (err) {
        addToast(apiErrorMessage(err, "Failed to save sector"), "error");
      } finally {
        setSaving(false);
      }
    },
    [addToast]
  );

  const onSelect = (id) => {
    if (id === sector || saving) return;
    setSector(id);
    persist(id);
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center" style={{ background: PAGE_BG }}>
        <Loader label="Loading sector settings…" />
      </div>
    );
  }

  return (
    <div className="min-h-full" style={{ background: PAGE_BG }}>
      <div className="mx-auto max-w-[1100px] px-4 py-5 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-[#d8d8de] bg-white px-4 py-6 shadow-sm sm:px-8 sm:py-8">
          <div className="mb-6 flex items-start gap-3">
            <span className="mt-0.5 grid h-9 w-9 place-items-center rounded-lg bg-[var(--color-success-soft)] text-[#6b4eff]">
              <Settings2 className="h-4.5 w-4.5 h-[18px] w-[18px]" />
            </span>
            <div>
              <p className="text-[15px] font-semibold text-[#1a1a1f]">
                Select your primary business sector
              </p>
              <p className="mt-0.5 text-[13px] text-[#6b6b76]">
                This helps tailor invoices, inventory defaults, and reports for your industry.
              </p>
            </div>
          </div>

          <div
            className="grid gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-4"
            role="radiogroup"
            aria-label="Business sector"
          >
            {SECTORS.map(({ id, label, Icon, iconBg, iconColor }) => {
              const selected = sector === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  disabled={saving}
                  onClick={() => onSelect(id)}
                  className="relative flex flex-col items-center px-1 text-center outline-none disabled:opacity-60"
                >
                  <span className="absolute left-0 top-0 flex items-center">
                    <span
                      className={`grid h-[18px] w-[18px] place-items-center rounded-full border-2 ${
                        selected
                          ? "border-[#0f6d84] bg-[#0f6d84]"
                          : "border-[#c4c4cc] bg-white"
                      }`}
                    >
                      {selected ? (
                        <span className="h-2 w-2 rounded-full bg-[#1a1a1f]" />
                      ) : null}
                    </span>
                  </span>
                  <span
                    className="mb-3 mt-1 grid h-[100px] w-[100px] place-items-center rounded-2xl"
                    style={{ background: iconBg }}
                  >
                    <Icon className="h-11 w-11" style={{ color: iconColor }} strokeWidth={1.5} />
                  </span>
                  <span
                    className="max-w-[150px] text-[13px] font-semibold leading-snug"
                    style={{ color: LABEL_GREEN }}
                  >
                    {label}
                  </span>
                </button>
              );
            })}
          </div>

          {saving ? (
            <p className="mt-6 text-center text-[12px] font-medium text-[#6b6b76]">Saving…</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
