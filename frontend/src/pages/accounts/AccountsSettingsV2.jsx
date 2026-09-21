import { Link } from "react-router-dom";
import { ChevronRight, Receipt, Settings } from "lucide-react";

import {
  AccountsCard,
  AccountsPageShell,
  ACCOUNTS_TEXT,
  ACCOUNTS_TEXT_MUTED,
} from "../../components/accounts/accountsDesignSystem";
import PageHeader from "../../components/common/PageHeader";

const LINKS = [
  {
    title: "Expense categories",
    description: "Manage expense categories used in vouchers and the expense module.",
    to: "/accounts/expenses/settings",
    icon: Receipt,
  },
];

export default function AccountsSettingsV2() {
  return (
    <AccountsPageShell>
      <PageHeader
        title="Accounts Settings"
        subtitle="Accounting configuration supported by your company workspace."
      />

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {LINKS.map((item) => {
          const Icon = item.icon;
          return (
            <AccountsCard key={item.to} className="p-5">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="text-[15px] font-bold" style={{ color: ACCOUNTS_TEXT }}>
                    {item.title}
                  </h2>
                  <p className="mt-1 text-[13px]" style={{ color: ACCOUNTS_TEXT_MUTED }}>
                    {item.description}
                  </p>
                  <Link
                    to={item.to}
                    className="mt-3 inline-flex items-center gap-1 text-[13px] font-semibold text-[var(--color-action-teal)] hover:underline"
                  >
                    Open
                    <ChevronRight className="h-4 w-4" aria-hidden />
                  </Link>
                </div>
              </div>
            </AccountsCard>
          );
        })}
      </div>

      <AccountsCard className="mt-6 p-5">
        <div className="flex items-start gap-3">
          <Settings className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" aria-hidden />
          <p className="text-[13px]" style={{ color: ACCOUNTS_TEXT_MUTED }}>
            Company-wide invoice format, tax registration, and document templates are managed under
            Administration settings by users with admin access. This page only lists accounting
            settings backed by the Accounts module APIs.
          </p>
        </div>
      </AccountsCard>
    </AccountsPageShell>
  );
}
