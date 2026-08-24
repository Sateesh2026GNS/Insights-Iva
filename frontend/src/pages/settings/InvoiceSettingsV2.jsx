import { useState } from "react";

import PageHeader from "../../components/common/PageHeader";
import { SettingsFeatureShell, SettingsSwitch } from "./settingsUi";

const STORAGE_KEY = "gns_invoice_settings_v2";

const SETTINGS = [
  {
    id: "autoSettlePayment",
    title: "Auto Settle Payment",
    description:
      "Automatically adjusts any available advance payments against the newly created invoice to reduce outstanding balances without manual entry.",
    defaultOn: false,
  },
  {
    id: "receivePaymentWhileCreating",
    title: "Receive Payment While Creating Invoice",
    description:
      "Allows you to directly record payment details at the time of invoice creation, so you don't need a separate payment step later.",
    defaultOn: true,
  },
  {
    id: "enableCashDiscount",
    title: "Enable Cash Discount",
    description:
      "Lets you apply a cash discount to invoices during creation, helping encourage early payments and flexible pricing.",
    defaultOn: true,
  },
  {
    id: "enableAdditionalCharges",
    title: "Enable Additional Charges",
    description:
      "Lets you add miscellaneous or additional charges (like packaging, transport, etc.) to invoices, ensuring all costs are covered.",
    defaultOn: true,
  },
  {
    id: "enableRoundOff",
    title: "Enable Round off",
    description:
      "Rounding off invoice totals to the nearest rupee or configurable value for simpler billing and accounting records.",
    defaultOn: true,
  },
  {
    id: "enablePartyBalance",
    title: "Enable Party Balance",
    description:
      "Shows and applies the current party balance during invoice workflows for faster reconciliation and payment tracking.",
    defaultOn: false,
  },
  {
    id: "autoGenerateEwaybill",
    title: "Auto Generate E-waybill",
    description:
      "Automatically creates an E-waybill along with the invoice, saving you an extra step during goods movement.",
    defaultOn: false,
  },
  {
    id: "enableTcsForAllBuyers",
    title: "Enable TCS For All Buyers",
    description:
      "Activates TCS (Tax Collected at Source) calculation on applicable invoices, ensuring compliance for buyers who fall under TCS rules.",
    defaultOn: false,
  },
  {
    id: "taxInclusiveRates",
    title: "Tax Inclusive Rates",
    description:
      "Control whether item rates in the invoice PDF are shown inclusive or exclusive of tax.",
    defaultOn: false,
  },
];

function defaultState() {
  const toggles = {};
  SETTINGS.forEach((s) => {
    toggles[s.id] = s.defaultOn;
  });
  return toggles;
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

export default function InvoiceSettingsV2() {
  const [state, setState] = useState(() => loadState());

  const setToggle = (id) => {
    const next = { ...state, [id]: !state[id] };
    setState(next);
    saveState(next);
  };

  return (
    <SettingsFeatureShell>
      <PageHeader
        title="Invoice Settings"
        subtitle="Manage default billing preferences, automated settlements, and tax calculation rules"
        backTo="/settings"
        backLabel="Back to Settings"
        showTitle
      />
      <div className="ui-card space-y-5 p-5 sm:p-6">
        {SETTINGS.map((item) => (
          <div key={item.id}>
            <div className="flex items-center justify-between gap-3 rounded-xl bg-[var(--color-surface-muted)] px-4 py-3">
              <span className="text-[15px] font-semibold text-[var(--color-text)]">{item.title}</span>
              <SettingsSwitch
                checked={!!state[item.id]}
                label={item.title}
                onChange={() => setToggle(item.id)}
              />
            </div>
            <p className="mt-2 px-1 text-[13px] leading-relaxed text-[var(--color-text-muted)]">
              {item.description}
            </p>
          </div>
        ))}
      </div>
    </SettingsFeatureShell>
  );
}
