import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import "../../styles/manufacturing-toolkit.css";

const CHART_COLORS = ["#2563eb", "#ea580c", "#16a34a", "#7c3aed", "#dc2626", "#0d9488", "#ca8a04", "#64748b"];

function fmtCell(value, format) {
  if (value == null || value === "") return "—";
  if (format === "currency") return `₹ ${Number(value).toLocaleString("en-IN")}`;
  if (format === "percent") return `${Number(value).toFixed(1)}%`;
  if (format === "number") return Number(value).toLocaleString();
  return String(value);
}

function renderPill(value) {
  const key = String(value || "").toLowerCase().replace(/\s+/g, "_");
  const map = {
    on_track: "success",
    running: "success",
    completed: "success",
    adequate: "success",
    scheduled: "info",
    normal: "success",
    slight_delay: "warning",
    at_risk: "warning",
    in_progress: "info",
    high_load: "warning",
    pending: "pending",
    delay: "danger",
    bottleneck: "danger",
    overloaded: "danger",
    breakdown: "danger",
    maintenance: "danger",
    shortage: "danger",
    monitor: "warning",
    low_stock: "danger",
    ok: "success",
    low: "warning",
    critical: "danger",
    open: "danger",
    closed: "success",
    approved: "success",
    missing: "danger",
    pass: "success",
    fail: "danger",
    overdue: "danger",
    watch: "warning",
    underutilized: "warning",
    constrained: "danger",
    present: "success",
    absent: "danger",
    behind: "danger",
    delayed: "danger",
    released: "info",
    on_hold: "pending",
    major: "warning",
    minor: "info",
    medium: "warning",
    high: "danger",
    planned: "info",
    resolved: "success",
    reported: "pending",
  };
  const tone = map[key] || "neutral";
  const label = typeof value === "string" ? value : key;
  return <span className={`mtk-pill mtk-pill--${tone}`}>{label.replace(/_/g, " ")}</span>;
}

function ToolkitTable({ section }) {
  const { title, columns = [], rows = [], totalRow } = section;
  return (
    <section className="mtk-panel">
      {title ? <div className="mtk-panel__title">{title}</div> : null}
      <div className="mtk-table-wrap">
        <table className="mtk-table">
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col.key}>{col.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={idx}>
                {columns.map((col) => {
                  const raw = row[col.key];
                  const align = col.align === "left" ? "mtk-left" : "";
                  if (col.type === "status") {
                    return (
                      <td key={col.key}>
                        {renderPill(raw)}
                      </td>
                    );
                  }
                  return (
                    <td key={col.key} className={align}>
                      {fmtCell(raw, col.format)}
                    </td>
                  );
                })}
              </tr>
            ))}
            {totalRow ? (
              <tr className="mtk-total-row">
                {columns.map((col, i) => (
                  <td key={col.key} className={col.align === "left" ? "mtk-left" : ""}>
                    {i === 0 && !totalRow[col.key] ? "TOTAL" : fmtCell(totalRow[col.key], col.format)}
                  </td>
                ))}
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ToolkitChart({ section }) {
  const { title, chartType, data = [], xKey, bars, lines, donutCenter } = section;
  return (
    <section className="mtk-panel">
      {title ? <div className="mtk-panel__title">{title}</div> : null}
      <div className="mtk-chart">
        <ResponsiveContainer width="100%" height="100%">
          {chartType === "line" ? (
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={xKey} tick={{ fontSize: 9 }} />
              <YAxis tick={{ fontSize: 9 }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 9 }} />
              {(lines || []).map((line) => (
                <Line key={line.key} type="monotone" dataKey={line.key} name={line.name} stroke={line.color} strokeWidth={2} dot />
              ))}
            </LineChart>
          ) : chartType === "donut" ? (
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name" innerRadius={40} outerRadius={58} paddingAngle={1}>
                {data.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          ) : (
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={xKey} tick={{ fontSize: 9 }} />
              <YAxis tick={{ fontSize: 9 }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 9 }} />
              {(bars || []).map((bar) => (
                <Bar key={bar.key} dataKey={bar.key} name={bar.name} fill={bar.color} radius={[2, 2, 0, 0]} />
              ))}
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
      {donutCenter ? <div className="mtk-donut-label">{donutCenter}</div> : null}
    </section>
  );
}

function renderSection(section) {
  if (!section) return null;
  switch (section.type) {
    case "table":
      return <ToolkitTable section={section} />;
    case "chart":
      return <ToolkitChart section={section} />;
    case "insights":
      return (
        <div className="mtk-insights">
          <h4>{section.title || "Key Insights"}</h4>
          <ul>
            {(section.items || []).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      );
    case "actions":
      return (
        <div className="mtk-actions">
          <h4>{section.title || "Action Items"}</h4>
          <ol>
            {(section.items || []).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
        </div>
      );
    case "notes":
      return (
        <div className="mtk-notes">
          <strong>{section.title}</strong>
          <ul className="mt-1 list-disc pl-4">
            {(section.items || []).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      );
    case "row":
      return (
        <div className={`mtk-layout-row mtk-layout-row--${section.variant || "1-1"}`}>
          {(section.children || []).map((child, i) => (
            <div key={i}>{renderSection(child)}</div>
          ))}
        </div>
      );
    default:
      return null;
  }
}

export default function ManufacturingToolkitDashboard({ config }) {
  if (!config) return null;
  const { theme = "navy", hero = {}, kpis = [], layout = [], bottomTabs = [] } = config;

  return (
    <div className={`mtk-root mtk-theme--${theme} print:hidden`}>
      <header className="mtk-hero">
        <div className="mtk-hero__row">
          <span>{hero.left || "Manufacturing Production Planning & Factory Control Toolkit"}</span>
          {hero.meta?.length ? (
            <div className="mtk-hero__meta">
              {hero.meta.map((line) => (
                <div key={line}>{line}</div>
              ))}
            </div>
          ) : (
            <span className="hidden sm:inline max-w-[220px] text-right">{hero.right || ""}</span>
          )}
        </div>
        <div className="mtk-hero__title">
          <h1>
            {hero.title ? (
              <>
                {hero.title}
                {hero.highlight ? <span className="mtk-accent"> {hero.highlight}</span> : null}
              </>
            ) : (
              <>
                {hero.titlePrefix || ""}
                {hero.highlight ? <span className="mtk-accent"> {hero.highlight}</span> : null}
                {hero.titleSuffix || ""}
              </>
            )}
          </h1>
          {hero.subtitle ? <p style={{ fontSize: 10, opacity: 0.9, margin: 0 }}>{hero.subtitle}</p> : null}
        </div>
      </header>

      {kpis.length ? (
        <div className="mtk-kpi-row" aria-label="Toolkit KPIs">
          {kpis.map((kpi) => (
            <div key={kpi.label} className="mtk-kpi">
              <div className={`mtk-kpi__icon mtk-kpi__icon--${kpi.tone || "blue"}`}>{kpi.icon || "•"}</div>
              <div className="mtk-kpi__label">{kpi.label}</div>
              <div className="mtk-kpi__value">{kpi.value}</div>
              {kpi.unit ? <div className="mtk-kpi__unit">{kpi.unit}</div> : null}
            </div>
          ))}
        </div>
      ) : null}

      <div className="mtk-body">
        {layout.map((section, idx) => (
          <div key={idx}>{renderSection(section)}</div>
        ))}
      </div>

      {bottomTabs.length ? (
        <nav className="mtk-tabs" aria-label="Toolkit sheets">
          {bottomTabs.map((tab, i) => (
            <button key={tab} type="button" className={i === 0 ? "mtk-tabs__active" : ""} disabled={i !== 0}>
              {tab}
            </button>
          ))}
        </nav>
      ) : null}
    </div>
  );
}
