import { Link } from "react-router-dom";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  inventoryTrend,
  machineUtilization,
  monthlyProduction,
  oeeData,
  orderStatus,
  productionTrend,
} from "../../../data/dashboardDummyData";
import ChartPanel from "./ChartPanel";

const tooltipStyle = {
  borderRadius: 12,
  border: "1px solid #e2e8f0",
  boxShadow: "0 8px 24px rgba(15,23,42,0.08)",
  fontSize: 12,
};

export function ProductionTrendChart() {
  return (
    <ChartPanel title="Production Trend" subtitle="Planned vs actual output — last 7 days">
      <div className="h-64 w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={productionTrend} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <defs>
              <linearGradient id="plannedGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2563EB" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#2563EB" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="actualGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#22C55E" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#22C55E" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Area type="monotone" dataKey="planned" stroke="#2563EB" fill="url(#plannedGrad)" strokeWidth={2} name="Planned" />
            <Area type="monotone" dataKey="actual" stroke="#22C55E" fill="url(#actualGrad)" strokeWidth={2} name="Actual" />
            <Line type="monotone" dataKey="target" stroke="#94A3B8" strokeDasharray="4 4" dot={false} name="Target" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </ChartPanel>
  );
}

export function OEEChart() {
  const overall = Math.round(oeeData.reduce((s, d) => s * (d.value / 100), 1) * 100);

  return (
    <ChartPanel title="OEE Overview" subtitle={`Overall OEE: ${overall}%`}>
      <div className="h-64 w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            cx="50%"
            cy="50%"
            innerRadius="20%"
            outerRadius="90%"
            data={oeeData}
            startAngle={180}
            endAngle={0}
          >
            <RadialBar background dataKey="value" cornerRadius={8} />
            <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v}%`, "Score"]} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
          </RadialBarChart>
        </ResponsiveContainer>
      </div>
    </ChartPanel>
  );
}

export function MachineUtilizationChart() {
  return (
    <ChartPanel title="Machine Utilization" subtitle="Top shop floor assets">
      <div className="space-y-3">
        {machineUtilization.map((row) => (
          <div key={row.machine}>
            <div className="mb-1 flex justify-between text-xs">
              <span className="font-semibold text-slate-700 dark:text-white">{row.machine}</span>
              <span className="font-bold tabular-nums text-[#2563EB] dark:text-blue-400">{row.utilization}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#2563EB] to-[#22C55E]"
                style={{ width: `${row.utilization}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </ChartPanel>
  );
}

export function OrderStatusChart() {
  const total = orderStatus.reduce((s, d) => s + d.value, 0);

  return (
    <ChartPanel title="Order Status" subtitle={`${total} active orders`}>
      <div className="flex flex-col items-center gap-4 sm:flex-row">
        <div className="h-48 w-48 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={orderStatus}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={52}
                outerRadius={72}
                paddingAngle={3}
              >
                {orderStatus.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} stroke="none" />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <ul className="flex-1 space-y-2 text-sm">
          {orderStatus.map((item) => (
            <li key={item.name} className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                {item.name}
              </span>
              <span className="font-semibold tabular-nums text-slate-700 dark:text-white">{item.value}</span>
            </li>
          ))}
        </ul>
      </div>
    </ChartPanel>
  );
}

export function MonthlyProductionChart() {
  return (
    <ChartPanel title="Monthly Production" subtitle="Output vs target (units)">
      <div className="h-56 w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={monthlyProduction} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="output" fill="#2563EB" radius={[6, 6, 0, 0]} name="Output" />
            <Bar dataKey="target" fill="#CBD5E1" radius={[6, 6, 0, 0]} name="Target" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartPanel>
  );
}

export function InventoryTrendChart() {
  return (
    <ChartPanel title="Inventory Trend" subtitle="Stock levels by category (₹ Lakhs)">
      <div className="h-56 w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={inventoryTrend} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="week" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line type="monotone" dataKey="raw" stroke="#2563EB" strokeWidth={2} dot={{ r: 3 }} name="Raw Materials" />
            <Line type="monotone" dataKey="wip" stroke="#F59E0B" strokeWidth={2} dot={{ r: 3 }} name="Work in Progress (WIP)" />
            <Line type="monotone" dataKey="fg" stroke="#22C55E" strokeWidth={2} dot={{ r: 3 }} name="Finished Goods" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </ChartPanel>
  );
}

export default function DashboardCharts() {
  return (
    <div className="grid gap-5 lg:grid-cols-12">
      <div className="lg:col-span-7">
        <ProductionTrendChart />
      </div>
      <div className="lg:col-span-5">
        <OEEChart />
      </div>
      <div className="lg:col-span-4">
        <MachineUtilizationChart />
      </div>
      <div className="lg:col-span-4">
        <OrderStatusChart />
      </div>
      <div className="lg:col-span-4">
        <MonthlyProductionChart />
      </div>
      <div className="lg:col-span-12">
        <InventoryTrendChart />
      </div>
    </div>
  );
}
