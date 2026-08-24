import { Link } from "react-router-dom";
import { Plus } from "lucide-react";

import Button from "../../components/common/Button";
import { getUserWorkflowTeams, TEAM_WORKFLOW_JOB_CARDS, userHasWorkflowTeam } from "../../config/manufacturingWorkflow";

export default function TeamWorkflowJobCards({ queue = [], user, activeTeam, onSelectTeam }) {
  const userTeams = getUserWorkflowTeams(user);
  const isAdmin = userTeams.includes("admin");

  const countForCard = (card) =>
    queue.filter((o) => {
      const ws = (o.workflow_status || o.status || "").toLowerCase();
      return card.statuses.some((s) => {
        if (s === "draft") return ws === "draft" || ws === "pending" || !o.workflow_status;
        return ws === s.toLowerCase();
      });
    }).length;

  const visibleCards = isAdmin
    ? TEAM_WORKFLOW_JOB_CARDS
    : TEAM_WORKFLOW_JOB_CARDS.filter((c) => userHasWorkflowTeam(user, c.team));

  if (!visibleCards.length) return null;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
            Team job cards
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Select a team card to filter orders, or click navigate to open the corresponding module.
          </p>
        </div>
        <Button
          to="/sales/orders/create"
          variant="add"
          leftIcon={<Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden />}
        >
          New sales order
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {visibleCards.map((card) => {
          const Icon = card.icon;
          const count = countForCard(card);
          const isMine = userHasWorkflowTeam(user, card.team);
          const isActive = activeTeam === card.team;
          const targetPath = card.path || `/manufacturing/workflow?status=${card.filterStatus}`;

          return (
            <Link
              key={card.id}
              to={targetPath}
              onClick={() => onSelectTeam?.(card)}
              className={`group flex flex-col justify-between rounded-xl border p-4 text-left transition cursor-pointer no-underline ${
                isActive
                  ? "border-[var(--color-primary)] bg-[var(--color-primary-soft)] ring-1 ring-[var(--color-primary)]/30"
                  : isMine
                    ? "border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-primary)]/40 hover:shadow-sm"
                    : "border-[var(--color-border-muted)] bg-[var(--color-surface-muted)]/80 opacity-90 hover:border-[var(--color-border)]"
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-sky-100 text-sky-600">
                      <Icon className="h-4 w-4" strokeWidth={1.9} />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-slate-900 group-hover:text-[var(--color-primary)] transition-colors">
                        {card.label}
                      </p>
                      <p className="text-xs text-slate-500">{card.role}</p>
                    </div>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-bold tabular-nums ${
                      count > 0 ? "bg-[var(--color-primary)] text-white" : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {count}
                  </span>
                </div>
                <p className="mt-2 text-[11px] font-medium uppercase tracking-wide text-slate-400">
                  When shown
                </p>
                <p className="text-xs text-slate-600">{card.whenShown}</p>
                <ul className="mt-2 space-y-0.5">
                  {card.actions.map((action) => (
                    <li key={action} className="flex gap-1.5 text-xs text-slate-600">
                      <span className="text-slate-400">•</span>
                      <span>{action}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
