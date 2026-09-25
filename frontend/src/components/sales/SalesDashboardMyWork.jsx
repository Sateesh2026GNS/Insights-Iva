import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";

import Button from "../common/Button";
import { ErrorState, LoadingState } from "../common/states";
import MyWorkActivityDateModal from "./MyWorkActivityDateModal";
import { getSalesMyWork } from "../../api/salesApi";
import { classifyApiError } from "../../utils/apiError";
import { addDaysIso, formatMediumDate, todayIso } from "../../utils/dateUtils";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "leads", label: "Leads" },
  { id: "followups", label: "Follow-ups" },
  { id: "customers", label: "Customers" },
  { id: "quotations", label: "Quotations" },
  { id: "orders", label: "Sales Orders" },
  { id: "job_cards", label: "Job Cards" },
  { id: "meetings", label: "Meetings" },
];

function pickData(res) {
  const body = res?.data;
  if (body && typeof body === "object" && "data" in body && body.data != null) return body.data;
  return body;
}

function activityDescription(item) {
  const sub = (item.subtitle || "").trim();
  const title = item.title || "";
  if (title === "Lead Created") {
    return sub ? `New lead added for ${sub}` : "New lead added to the sales pipeline";
  }
  if (title === "Lead Updated") {
    return sub ? `Lead record updated for ${sub}` : "Lead record updated";
  }
  if (title.includes("Follow-up")) {
    return sub ? `Follow-up with ${sub}` : "Scheduled or completed follow-up";
  }
  if (title === "Customer Created") {
    return sub ? `Customer ${sub} added` : "New customer created";
  }
  if (title === "Customer Updated") {
    return sub ? `Customer ${sub} updated` : "Customer record updated";
  }
  if (title === "Quotation Created") {
    return sub ? `Quotation ${sub} created` : "New quotation created";
  }
  if (title === "Quotation Sent") {
    return sub ? `Quotation ${sub} sent to customer` : "Quotation sent to customer";
  }
  if (title === "Quotation Updated") {
    return sub ? `Quotation ${sub} updated` : "Quotation updated";
  }
  if (title === "Sales Order Created") {
    return sub ? `Sales order ${sub} created` : "New sales order created";
  }
  if (title === "Sales Order Updated") {
    return sub ? `Sales order ${sub} updated` : "Sales order updated";
  }
  if (title === "Job Card Created") {
    return sub ? `Job card ${sub} created` : "New job card created";
  }
  if (title === "Job Card Updated") {
    return sub ? `Job card ${sub} updated` : "Job card updated";
  }
  if (title === "Meeting") {
    return sub || "Sales meeting";
  }
  if (title === "Dispatch Recorded") {
    return sub ? `Dispatch recorded for ${sub}` : "Dispatch recorded";
  }
  return sub ? `${title} — ${sub}` : "";
}

function ActivityRow({ item }) {
  const desc = activityDescription(item);
  const viewLabel = item.subtitle
    ? `View ${item.title} for ${item.subtitle}`
    : `View ${item.title}`;

  return (
    <li className="sales-dash-mywork__row">
      <div className="sales-dash-mywork__time" aria-hidden={!item.time_label}>
        {item.time_label || "—"}
      </div>
      <div className="sales-dash-mywork__main min-w-0">
        <p className="sales-dash-mywork__title">{item.title}</p>
        {item.subtitle ? (
          <p className="sales-dash-mywork__subtitle truncate">{item.subtitle}</p>
        ) : null}
        {desc ? <p className="sales-dash-mywork__desc">{desc}</p> : null}
      </div>
      <Link to={item.view_path} className="sales-dash-mywork__view shrink-0" aria-label={viewLabel}>
        View →
      </Link>
    </li>
  );
}

function SummaryStat({ label, value }) {
  return (
    <div className="sales-dash-mywork__stat">
      <span className="sales-dash-mywork__stat-label">{label}</span>
      <span className="sales-dash-mywork__stat-value tabular-nums">{value}</span>
    </div>
  );
}

function presetActive(workDate, preset) {
  const today = todayIso();
  const yesterday = addDaysIso(today, -1);
  if (preset === "today") return workDate === today;
  if (preset === "yesterday") return workDate === yesterday;
  return workDate !== today && workDate !== yesterday;
}

export default function SalesDashboardMyWork() {
  const [workDate, setWorkDate] = useState(() => todayIso());
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);
  const [customDateOpen, setCustomDateOpen] = useState(false);
  const loadGenRef = useRef(0);

  const load = useCallback(async () => {
    const gen = ++loadGenRef.current;
    const requestedDate = workDate;
    setLoading(true);
    setError("");
    setData(null);
    try {
      const res = await getSalesMyWork({ date: requestedDate });
      if (gen !== loadGenRef.current) return;
      setData(pickData(res));
    } catch (err) {
      if (gen !== loadGenRef.current) return;
      setData(null);
      setError(
        classifyApiError(err, "Unable to load your activity. Please try again.").message
      );
    } finally {
      if (gen === loadGenRef.current) {
        setLoading(false);
      }
    }
  }, [workDate]);

  useEffect(() => {
    load();
  }, [load]);

  const filteredTimeline = useMemo(() => {
    const list = data?.timeline || [];
    if (filter === "all") return list;
    return list.filter((a) => a.category === filter);
  }, [data, filter]);

  const summary = useMemo(() => {
    if (!data) return { completed: 0, pending: 0, total: 0 };
    if (filter === "all") {
      const total = data.timeline?.length ?? 0;
      return {
        completed: data.completed_count ?? data.completed?.length ?? 0,
        pending: data.pending_count ?? data.pending?.length ?? 0,
        total,
      };
    }
    const completed = filteredTimeline.filter((a) => a.status === "completed").length;
    const pending = filteredTimeline.filter((a) => a.status === "pending").length;
    return { completed, pending, total: filteredTimeline.length };
  }, [data, filter, filteredTimeline]);

  const dateLabel = formatMediumDate(workDate) || workDate;
  const hasTimeline = Boolean(data?.timeline?.length);
  const isCustomDate = presetActive(workDate, "custom");

  const goPrevDay = () => setWorkDate(addDaysIso(workDate, -1));

  return (
    <section className="sales-dash-card sales-dash-mywork" aria-labelledby="sales-my-work-title">
      <header className="sales-dash-mywork__header">
        <div className="sales-dash-mywork__intro">
          <h3 id="sales-my-work-title" className="sales-dash-card__title">
            My Work
          </h3>
          <p className="sales-dash-mywork__tagline">
            Your sales activity for the selected date.
          </p>
        </div>

        <div className="sales-dash-mywork__date-tools">
          <div className="sales-dash-mywork__date-tools-row">
            <span className="sales-dash-mywork__date-tools-label" id="sales-my-work-date-label">
              Activity Date
            </span>
            <span className="sales-dash-mywork__date-current tabular-nums" aria-live="polite">
              {dateLabel}
            </span>
          </div>
          <div
            className="sales-dash-mywork__date-presets"
            role="group"
            aria-labelledby="sales-my-work-date-label"
          >
            <button
              type="button"
              className={`sales-dash-mywork__preset-btn${presetActive(workDate, "today") ? " is-active" : ""}`}
              onClick={() => setWorkDate(todayIso())}
            >
              Today
            </button>
            <button
              type="button"
              className={`sales-dash-mywork__preset-btn${presetActive(workDate, "yesterday") ? " is-active" : ""}`}
              onClick={() => setWorkDate(addDaysIso(todayIso(), -1))}
            >
              Yesterday
            </button>
            <button
              type="button"
              className={`sales-dash-mywork__preset-btn sales-dash-mywork__preset-btn--custom${isCustomDate ? " is-active" : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                setCustomDateOpen(true);
              }}
              aria-haspopup="dialog"
              aria-expanded={customDateOpen}
            >
              Custom Date
            </button>
          </div>
        </div>
      </header>

      <MyWorkActivityDateModal
        open={customDateOpen}
        currentDate={workDate}
        onClose={() => setCustomDateOpen(false)}
        onApply={(iso) => setWorkDate(iso)}
      />

      {!loading && !error && data ? (
        <div className="sales-dash-mywork__stats" aria-label="Activity summary">
          <SummaryStat label="Completed" value={summary.completed} />
          <SummaryStat label="Pending" value={summary.pending} />
          <SummaryStat label="Total activity" value={summary.total} />
        </div>
      ) : null}

      <div
        className="sales-dash-mywork__filters"
        role="tablist"
        aria-label="Filter activity type"
      >
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            role="tab"
            aria-selected={filter === f.id}
            className={filter === f.id ? "is-active" : ""}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="sales-dash-mywork__content">
        {loading ? (
          <LoadingState compact label="Loading activity…" className="!py-8" />
        ) : error ? (
          <ErrorState
            title="Unable to load activity"
            description={error}
            onRetry={load}
            className="sales-dash-mywork__error"
          />
        ) : !hasTimeline ? (
          <div className="sales-dash-mywork__empty" role="status">
            <p className="sales-dash-mywork__empty-title">No activity yet</p>
            <p className="sales-dash-mywork__empty-desc">
              No sales activity was recorded on {dateLabel}.
            </p>
            <Button type="button" variant="secondary" className="!text-xs" onClick={goPrevDay}>
              View previous day
            </Button>
          </div>
        ) : filteredTimeline.length ? (
          <ul className="sales-dash-mywork__timeline">
            {filteredTimeline.map((item) => (
              <ActivityRow key={item.id} item={item} />
            ))}
          </ul>
        ) : (
          <div className="sales-dash-mywork__empty sales-dash-mywork__empty--filter" role="status">
            <p className="sales-dash-mywork__empty-title">No matching activity</p>
            <p className="sales-dash-mywork__empty-desc">Try another filter for {dateLabel}.</p>
          </div>
        )}
      </div>
    </section>
  );
}
