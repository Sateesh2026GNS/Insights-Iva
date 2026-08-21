import { useMemo, useState } from "react";

import useSettings from "../../context/SettingsContext";
import PageHeader from "../../components/common/PageHeader";

const ACCENT = "#0f6d84";
const PAGE_BG = "var(--color-bg)";
const SECTION_BG = "#DBE2F0";
const LABEL_GREEN = "#2D6A4F";
const STORAGE_KEY = "gns_format_settings_v2";

const COMMA_OPTIONS = [
  { id: "indian", label: "10,00,000" },
  { id: "western", label: "1,000,000" },
];

const CURRENCY_OPTIONS = [
  { id: "₹", label: "₹" },
  { id: "INR", label: "INR" },
  { id: "Rs.", label: "Rs." },
  { id: "$", label: "$" },
  { id: "€", label: "€" },
  { id: "AED", label: "AED" },
  { id: "QR", label: "QR" },
];

const DATE_OPTIONS = [
  "30-07-2026",
  "07-30-2026",
  "30/07/2026",
  "07/30/2026",
  "2026/07/30",
  "2026-30-07",
  "2026/30/07",
  "2026-07-30",
  "30-Jul-2026",
  "Jul-30-2026",
  "30/Jul/2026",
  "Jul/30/2026",
];

function defaultState() {
  return {
    commaFormat: "indian",
    currencyFormat: "₹",
    dateFormat: "30-07-2026",
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    return { ...defaultState(), ...JSON.parse(raw) };
  } catch {
    return defaultState();
  }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function RadioOption({ checked, label, onChange, name }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2.5">
      <span
        className={`grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full border-2 ${
          checked ? "border-[var(--color-primary)] dark:border-teal-400" : "border-slate-400 dark:border-slate-600"
        }`}
      >
        {checked ? (
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--color-primary)] dark:bg-teal-400" />
        ) : null}
      </span>
      <input
        type="radio"
        name={name}
        className="sr-only"
        checked={checked}
        onChange={onChange}
      />
      <span className="text-[15px] font-medium text-slate-900 dark:text-white">
        {label}
      </span>
    </label>
  );
}

function Section({ title, children }) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
      <div
        className="px-4 py-2.5 text-[15px] font-semibold text-slate-900 bg-slate-100 dark:bg-slate-700/80 dark:text-white"
      >
        {title}
      </div>
      <div className="bg-white px-4 py-4 sm:px-5 sm:py-5 dark:bg-slate-800 dark:text-white">{children}</div>
    </div>
  );
}

export default function FormatSettingsV2() {
  const { updateCurrency, updateDateFormat } = useSettings();
  const [state, setState] = useState(() => loadState());

  const persist = (next) => {
    setState(next);
    saveState(next);
  };

  const setComma = (id) => persist({ ...state, commaFormat: id });

  const setCurrency = (id) => {
    persist({ ...state, currencyFormat: id });
    try {
      updateCurrency(id === "₹" || id === "Rs." ? "INR" : id === "$" ? "USD" : id === "€" ? "EUR" : id);
    } catch {
      /* ignore if settings unavailable */
    }
  };

  const setDate = (label) => {
    persist({ ...state, dateFormat: label });
    try {
      const map = {
        "30-07-2026": "DD-MM-YYYY",
        "07-30-2026": "MM-DD-YYYY",
        "30/07/2026": "DD/MM/YYYY",
        "07/30/2026": "MM/DD/YYYY",
        "2026/07/30": "YYYY/MM/DD",
        "2026-07-30": "YYYY-MM-DD",
        "30-Jul-2026": "DD-MMM-YYYY",
        "Jul-30-2026": "MMM-DD-YYYY",
        "30/Jul/2026": "DD/MMM/YYYY",
        "Jul/30/2026": "MMM/DD/YYYY",
      };
      updateDateFormat(map[label] || label);
    } catch {
      /* ignore */
    }
  };

  const dateRows = useMemo(() => {
    const row1 = DATE_OPTIONS.slice(0, 9);
    const row2 = DATE_OPTIONS.slice(9);
    return [row1, row2];
  }, []);

  return (
    <div className="min-h-full" style={{ background: PAGE_BG }}>
      <div className="mx-auto max-w-[1400px] px-4 py-5 sm:px-6 lg:px-8 space-y-5">
        <PageHeader
          title="Change Format"
          subtitle="Configure number formatting, currency symbol, and date display preferences"
          backTo="/settings"
          backLabel="Back to Settings"
          showTitle
        />
        <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 dark:border-slate-700 dark:bg-slate-800">
          <Section title="Comma Format">
            <div className="flex flex-wrap gap-x-10 gap-y-3">
              {COMMA_OPTIONS.map((opt) => (
                <RadioOption
                  key={opt.id}
                  name="comma-format"
                  label={opt.label}
                  checked={state.commaFormat === opt.id}
                  onChange={() => setComma(opt.id)}
                />
              ))}
            </div>
          </Section>

          <Section title="Currency Format">
            <div className="flex flex-wrap gap-x-10 gap-y-3">
              {CURRENCY_OPTIONS.map((opt) => (
                <RadioOption
                  key={opt.id}
                  name="currency-format"
                  label={opt.label}
                  checked={state.currencyFormat === opt.id}
                  onChange={() => setCurrency(opt.id)}
                />
              ))}
            </div>
          </Section>

          <Section title="Date Format">
            <div className="space-y-4">
              {dateRows.map((row, i) => (
                <div key={i} className="flex flex-wrap gap-x-8 gap-y-3">
                  {row.map((label) => (
                    <RadioOption
                      key={label}
                      name="date-format"
                      label={label}
                      checked={state.dateFormat === label}
                      onChange={() => setDate(label)}
                    />
                  ))}
                </div>
              ))}
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}
