import { TOOLKIT_CONFIGS_BATCH2 } from "./manufacturingToolkitConfigsBatch2";

const SUB = "Manufacturing Production Planning & Factory Control Toolkit";

const STATUS_COL = { key: "status", label: "Status", type: "status" };

export const TOOLKIT_CONFIGS = {
  product_cost: {
    theme: "orange",
    hero: { title: "Manufacturing Product Cost", highlight: "Per Unit", subtitle: SUB, left: "🏭 Cost clarity for every SKU" },
    kpis: [
      { label: "Total Products", value: "10", unit: "SKUs", tone: "blue", icon: "10" },
      { label: "Avg Unit Cost", value: "₹286.40", tone: "green", icon: "₹" },
      { label: "Total Production Qty", value: "1,25,000", tone: "orange", icon: "Q" },
      { label: "Total Mfg Cost", value: "₹35.8L", tone: "purple", icon: "C" },
      { label: "Average Margin", value: "28.5", unit: "%", tone: "teal", icon: "%" },
      { label: "Profitable Products", value: "8 / 10", tone: "lime", icon: "✓" },
    ],
    layout: [
      {
        type: "row",
        variant: "2-1",
        children: [
          {
            type: "table",
            title: "Product Costing Details (Per Unit)",
            columns: [
              { key: "sno", label: "S.No." },
              { key: "sku", label: "SKU" },
              { key: "product", label: "Product", align: "left" },
              { key: "category", label: "Category" },
              { key: "total", label: "Total Cost (₹)", format: "number" },
              { key: "price", label: "Selling (₹)", format: "number" },
              { key: "margin", label: "Margin %", format: "percent" },
            ],
            rows: [
              { sno: 1, sku: "FG-101", product: "Steel Bracket", category: "Metal", total: 252, price: 340, margin: 34.9 },
              { sno: 2, sku: "FG-102", product: "Plastic Housing", category: "Plastic", total: 118, price: 165, margin: 28.5 },
              { sno: 3, sku: "FG-103", product: "Gear Housing", category: "Mechanical", total: 416, price: 520, margin: 20.0 },
              { sno: 4, sku: "FG-104", product: "Control Panel", category: "Electrical", total: 597, price: 780, margin: 23.5 },
            ],
            totalRow: { sno: "", sku: "", product: "AVERAGE", category: "", total: 286, price: 351, margin: 35.3 },
          },
          {
            type: "row",
            variant: "1-1",
            children: [
              {
                type: "chart",
                title: "Unit Cost vs Selling Price (₹)",
                chartType: "bar",
                xKey: "name",
                data: [
                  { name: "FG-101", cost: 252, price: 340 },
                  { name: "FG-102", cost: 118, price: 165 },
                  { name: "FG-103", cost: 416, price: 520 },
                  { name: "FG-104", cost: 597, price: 780 },
                ],
                bars: [
                  { key: "cost", name: "Unit Cost", color: "#2563eb" },
                  { key: "price", name: "Selling Price", color: "#ea580c" },
                ],
              },
              {
                type: "chart",
                title: "Cost Breakdown (Average)",
                chartType: "donut",
                donutCenter: "₹286.40 Per Unit",
                data: [
                  { name: "Raw Material", value: 46 },
                  { name: "Labour", value: 16 },
                  { name: "Machine", value: 11 },
                  { name: "Overhead", value: 12 },
                  { name: "Other", value: 15 },
                ],
              },
            ],
          },
        ],
      },
      {
        type: "row",
        variant: "1-1",
        children: [
          { type: "insights", items: ["8 of 10 products are profitable", "Control Panel has highest unit cost — review BOM", "Average margin 28.5% above floor target"] },
          { type: "actions", items: ["Negotiate raw material rates", "Review rejection rate on Gear Housing", "Update standard costs for Q2"] },
        ],
      },
    ],
    bottomTabs: ["Dashboard", "Product_Costing", "BOM_Costs", "Production_Plan", "Variance_Analysis", "Supplier_Rates", "Settings"],
  },

  capacity_planning: {
    theme: "green",
    hero: { titlePrefix: "Manufacturing", highlight: "Capacity Planning Calculator", titleSuffix: "", subtitle: SUB },
    kpis: [
      { label: "Line Capacity", value: "12,000", unit: "Units/Day", tone: "blue", icon: "L" },
      { label: "Machine Hrs Avail.", value: "2,400", unit: "Hrs/Week", tone: "green", icon: "H" },
      { label: "Required Hours", value: "1,920", unit: "Hrs/Week", tone: "orange", icon: "R" },
      { label: "Utilization", value: "80", unit: "%", tone: "purple", icon: "%" },
      { label: "Bottlenecks", value: "2", unit: "Lines", tone: "red", icon: "!" },
      { label: "Capacity Gap", value: "7,200", unit: "Units/Mo", tone: "red", icon: "G" },
    ],
    layout: [
      {
        type: "row",
        variant: "2-1",
        children: [
          {
            type: "table",
            title: "Manufacturing Capacity Planning (Line-wise)",
            columns: [
              { key: "line", label: "Line", align: "left" },
              { key: "product", label: "Product", align: "left" },
              { key: "machines", label: "Machines" },
              { key: "avail", label: "Avail Hrs" },
              { key: "req", label: "Req Hrs" },
              { key: "util", label: "Util %", format: "percent" },
              { key: "gap", label: "Gap" },
              STATUS_COL,
            ],
            rows: [
              { line: "Cutting", product: "Sheet Metal", machines: 4, avail: 320, req: 234, util: 73, gap: 0, status: "normal" },
              { line: "CNC", product: "Precision Parts", machines: 8, avail: 640, req: 544, util: 85, gap: 0, status: "high_load" },
              { line: "Assembly", product: "Final Assembly", machines: 6, avail: 480, req: 461, util: 96, gap: 1200, status: "bottleneck" },
              { line: "Packaging", product: "Pack & Label", machines: 5, avail: 400, req: 392, util: 98, gap: 800, status: "bottleneck" },
            ],
            totalRow: { line: "TOTAL", product: "", machines: 45, avail: 2400, req: 1920, util: 80, gap: 7200, status: "" },
          },
          {
            type: "chart",
            title: "Line-wise Utilization (%)",
            chartType: "bar",
            xKey: "line",
            data: [
              { line: "Cutting", util: 73 },
              { line: "CNC", util: 85 },
              { line: "Assembly", util: 96 },
              { line: "Packaging", util: 98 },
            ],
            bars: [{ key: "util", name: "Utilization %", color: "#16a34a" }],
          },
        ],
      },
      {
        type: "row",
        variant: "1-1",
        children: [
          { type: "insights", items: ["Overall utilization 80%", "Assembly & Packaging are bottlenecks", "6 additional operators recommended"] },
          { type: "actions", items: ["Optimize assembly cycle time", "Balance line workload", "Monitor capacity vs demand weekly"] },
        ],
      },
    ],
    bottomTabs: ["Dashboard", "Capacity Planning", "Line Details", "Machine Calendar", "Demand Plan", "Resources", "Summary", "Settings"],
  },

  team_capacity: {
    theme: "teal",
    hero: { title: "TEAM CAPACITY PLANNER", subtitle: SUB, left: "Plan Teams · Track Capacity · Drive Productivity" },
    kpis: [
      { label: "Total Teams", value: "6", tone: "blue", icon: "6" },
      { label: "Operators", value: "108", tone: "green", icon: "Op" },
      { label: "Supervisors", value: "12", tone: "orange", icon: "Sv" },
      { label: "Planned Shift Hrs", value: "1,920", tone: "purple", icon: "H" },
      { label: "Attendance", value: "93", unit: "%", tone: "red", icon: "%" },
      { label: "Utilization", value: "88", unit: "%", tone: "teal", icon: "%" },
      { label: "Overtime Hrs", value: "126", tone: "yellow", icon: "OT" },
    ],
    layout: [
      {
        type: "row",
        variant: "2-1",
        children: [
          {
            type: "table",
            title: "Team Capacity Details - June 2026",
            columns: [
              { key: "team", label: "Team / Line", align: "left" },
              { key: "dept", label: "Dept" },
              { key: "ops", label: "Operators" },
              { key: "avail", label: "Avail Hrs" },
              { key: "req", label: "Req Hrs" },
              { key: "util", label: "Util %", format: "percent" },
              { key: "ot", label: "OT Hrs" },
              STATUS_COL,
            ],
            rows: [
              { team: "Assembly A", dept: "Assembly", ops: 22, avail: 352, req: 340, util: 97, ot: 28, status: "on_track" },
              { team: "Assembly B", dept: "Assembly", ops: 20, avail: 320, req: 326, util: 102, ot: 42, status: "overloaded" },
              { team: "Machining", dept: "Production", ops: 18, avail: 288, req: 250, util: 87, ot: 12, status: "on_track" },
              { team: "Quality", dept: "QC", ops: 12, avail: 192, req: 160, util: 83, ot: 0, status: "on_track" },
            ],
            totalRow: { team: "TOTAL", dept: "", ops: 108, avail: 1920, req: 1680, util: 88, ot: 126, status: "" },
          },
          {
            type: "chart",
            title: "Team Capacity vs Requirement (Hours)",
            chartType: "bar",
            xKey: "team",
            data: [
              { team: "Asm A", avail: 352, req: 340 },
              { team: "Asm B", avail: 320, req: 326 },
              { team: "Mach", avail: 288, req: 250 },
              { team: "QC", avail: 192, req: 160 },
            ],
            bars: [
              { key: "avail", name: "Available", color: "#2563eb" },
              { key: "req", name: "Required", color: "#ea580c" },
            ],
          },
        ],
      },
      {
        type: "row",
        variant: "1-1",
        children: [
          { type: "insights", items: ["88% overall capacity utilization", "Assembly B overutilized at 102%", "126 hours overtime this month"] },
          { type: "actions", items: ["Monitor Assembly B workload", "Arrange backup operators", "Review shift roster for July"] },
        ],
      },
    ],
    bottomTabs: ["Dashboard", "Team Capacity", "Shift Plan", "Skill Matrix", "Leave Tracker", "Settings"],
  },

  budget_planner: {
    theme: "red",
    hero: {
      title: "Manufacturing Budget Planner",
      subtitle: SUB,
      meta: ["Year: 2026", "Plant: New Delhi", "Prepared By: Operations Team"],
    },
    kpis: [
      { label: "Annual Budget", value: "₹12.5 Cr", tone: "blue", icon: "B" },
      { label: "Actual Spend", value: "₹9.62 Cr", tone: "green", icon: "A" },
      { label: "Variance", value: "₹2.88 Cr", tone: "orange", icon: "V" },
      { label: "Utilization", value: "77.0", unit: "%", tone: "purple", icon: "%" },
      { label: "Pending Approvals", value: "12", tone: "teal", icon: "P" },
      { label: "Projects on Track", value: "8", tone: "lime", icon: "✓" },
    ],
    layout: [
      {
        type: "row",
        variant: "2-1",
        children: [
          {
            type: "table",
            title: "Department-wise Budget vs Actual (Annual)",
            columns: [
              { key: "dept", label: "Department", align: "left" },
              { key: "budget", label: "Budget (₹)", format: "number" },
              { key: "actual", label: "Actual (₹)", format: "number" },
              { key: "var", label: "Variance %", format: "percent" },
              STATUS_COL,
            ],
            rows: [
              { dept: "Production", budget: 45000000, actual: 36800000, var: 18.2, status: "on_track" },
              { dept: "Raw Materials", budget: 52000000, actual: 41200000, var: 20.8, status: "on_track" },
              { dept: "Maintenance", budget: 8000000, actual: 6100000, var: 23.8, status: "on_track" },
              { dept: "Admin & Overhead", budget: 6000000, actual: 3740000, var: 37.6, status: "monitor" },
            ],
            totalRow: { dept: "TOTAL", budget: 125000000, actual: 96240000, var: 23.0, status: "" },
          },
          {
            type: "chart",
            title: "Expense Distribution (Actual)",
            chartType: "donut",
            donutCenter: "₹9.62 Crore",
            data: [
              { name: "Production", value: 29 },
              { name: "Raw Materials", value: 33 },
              { name: "Labour", value: 18 },
              { name: "Other", value: 20 },
            ],
          },
        ],
      },
      {
        type: "row",
        variant: "1-1",
        children: [
          { type: "insights", items: ["77% of annual budget utilized", "Admin costs 37.6% under budget", "12 items pending approval"] },
          { type: "actions", items: ["Review pending approvals (12)", "Monitor raw material price fluctuations", "Update Q3 forecast"] },
        ],
      },
    ],
    bottomTabs: ["Dashboard", "Annual_Budget", "Monthly_Plan", "Actuals", "Variance_Analysis", "Cost_Details", "Settings"],
  },

  dept_operating_plan: {
    theme: "navy",
    hero: {
      title: "Department-Wise Operating Plan",
      subtitle: SUB,
      meta: ["Year: 2026", "Plant: New Delhi", "Last Updated: 25-Sep-2026"],
    },
    kpis: [
      { label: "Annual Target", value: "₹42.5L", tone: "blue", icon: "T" },
      { label: "Total Budget", value: "₹38.75L", tone: "green", icon: "B" },
      { label: "Progress", value: "68", unit: "%", tone: "orange", icon: "%" },
      { label: "On Track Depts", value: "5 / 8", tone: "purple", icon: "✓" },
      { label: "High Risk", value: "3", tone: "red", icon: "!" },
      { label: "Team Members", value: "248", tone: "teal", icon: "👥" },
    ],
    layout: [
      {
        type: "table",
        title: "Department-Wise Operating Plan (2026)",
        columns: [
          { key: "dept", label: "Department", align: "left" },
          { key: "target", label: "Target (₹)", format: "number" },
          { key: "budget", label: "Budget (₹)", format: "number" },
          { key: "owner", label: "Owner", align: "left" },
          { key: "progress", label: "Progress %", format: "percent" },
          STATUS_COL,
        ],
        rows: [
          { dept: "Production", target: 1500000, budget: 1350000, owner: "Mr. R. Sharma", progress: 75, status: "on_track" },
          { dept: "Quality", target: 600000, budget: 550000, owner: "Ms. K. Patel", progress: 72, status: "on_track" },
          { dept: "Purchase", target: 500000, budget: 480000, owner: "Mr. A. Verma", progress: 55, status: "pending" },
          { dept: "Safety", target: 350000, budget: 320000, owner: "Mr. S. Rao", progress: 48, status: "delay" },
        ],
        totalRow: { dept: "TOTAL", target: 4250000, budget: 3875000, owner: "", progress: 68, status: "" },
      },
      {
        type: "row",
        variant: "1-1",
        children: [
          { type: "insights", items: ["68% overall execution progress", "₹3.75L budget remaining", "5 of 8 departments on track"] },
          { type: "actions", items: ["Expedite procurement process", "Complete safety upgrades by Q3", "Monthly progress review with HODs"] },
        ],
      },
    ],
    bottomTabs: ["Dashboard", "Dept_Plan", "Monthly_Tracking", "Budget", "Action_Items", "Settings"],
  },

  project_timeline: {
    theme: "yellow",
    hero: { title: "Manufacturing Project Timeline", subtitle: SUB, left: "Plan · Implement · Monitor · Achieve" },
    kpis: [
      { label: "Total Activities", value: "16", tone: "blue", icon: "16" },
      { label: "Completed", value: "6", tone: "green", icon: "✓" },
      { label: "In Progress", value: "8", tone: "orange", icon: "…" },
      { label: "Not Started", value: "2", tone: "red", icon: "○" },
      { label: "Overall Progress", value: "54", unit: "%", tone: "purple", icon: "%" },
      { label: "Project Cost", value: "₹2.49 Cr", tone: "teal", icon: "₹" },
    ],
    layout: [
      {
        type: "table",
        title: "Project Activity Schedule",
        columns: [
          { key: "task", label: "Activity", align: "left" },
          { key: "dept", label: "Department" },
          { key: "start", label: "Start" },
          { key: "end", label: "End" },
          { key: "progress", label: "Progress %", format: "percent" },
          STATUS_COL,
        ],
        rows: [
          { task: "Site Preparation", dept: "Infrastructure", start: "Jan-26", end: "Feb-26", progress: 100, status: "completed" },
          { task: "Equipment Installation", dept: "Production", start: "Mar-26", end: "Jun-26", progress: 65, status: "in_progress" },
          { task: "Quality Validation", dept: "Quality", start: "Jul-26", end: "Aug-26", progress: 20, status: "in_progress" },
          { task: "Final Handover", dept: "Management", start: "Nov-26", end: "Nov-26", progress: 0, status: "pending" },
        ],
      },
      {
        type: "row",
        variant: "1-1",
        children: [
          { type: "insights", items: ["Equipment installation is on critical path", "54% overall project progress", "Target completion 30-Nov-2026"] },
          { type: "actions", items: ["Expedite machinery delivery", "Weekly steering committee review", "Update resource plan for Q3"] },
        ],
      },
    ],
    bottomTabs: ["Dashboard", "Task_List", "Gantt_Chart", "Resource_Plan", "Cost_Tracker", "Summary", "Settings"],
  },

  resource_planning: {
    theme: "navy",
    hero: { title: "Resource Planning Dashboard", subtitle: SUB, left: "Plan · Schedule · Allocate · Monitor" },
    kpis: [
      { label: "Total Machines", value: "48", tone: "blue", icon: "M" },
      { label: "Manpower", value: "120", tone: "green", icon: "P" },
      { label: "Key Materials", value: "36", tone: "orange", icon: "K" },
      { label: "Utilization", value: "78", unit: "%", tone: "teal", icon: "%" },
      { label: "Shortages", value: "6", unit: "Items", tone: "red", icon: "!" },
    ],
    layout: [
      {
        type: "table",
        title: "Resource Plan vs Availability",
        columns: [
          { key: "type", label: "Resource", align: "left" },
          { key: "planned", label: "Planned" },
          { key: "available", label: "Available" },
          { key: "util", label: "Util %", format: "percent" },
          STATUS_COL,
        ],
        rows: [
          { type: "Machines", planned: 48, available: 45, util: 96, status: "shortage" },
          { type: "Manpower", planned: 120, available: 118, util: 92, status: "on_track" },
          { type: "Raw Materials (T)", planned: 840, available: 820, util: 98, status: "shortage" },
          { type: "Production Time (Hrs)", planned: 5760, available: 5760, util: 78, status: "on_track" },
        ],
      },
      {
        type: "row",
        variant: "1-1",
        children: [
          { type: "insights", items: ["78% overall resource utilization", "6 resource shortages flagged", "1,270 hrs time buffer available"] },
          { type: "actions", items: ["Procure 2 additional CNC machines", "Hire 6 skilled welders", "Expedite aluminum sheet PO"] },
        ],
      },
    ],
    bottomTabs: ["Dashboard", "Resource_Plan", "Machine_Capacity", "Manpower_Plan", "Material_Requirement", "Summary", "Settings"],
  },

  workload_analysis: {
    theme: "maroon",
    hero: {
      title: "Workload Analysis",
      subtitle: SUB,
      meta: ["Plant: Pune", "Month: Jun 2026", "Prepared By: Production Planning"],
    },
    kpis: [
      { label: "Work Orders", value: "125", tone: "blue", icon: "WO" },
      { label: "Assigned", value: "102", tone: "green", icon: "A" },
      { label: "Pending", value: "23", tone: "orange", icon: "P" },
      { label: "Capacity Use", value: "82", unit: "%", tone: "purple", icon: "%" },
      { label: "Overtime Hrs", value: "126", tone: "red", icon: "OT" },
      { label: "Efficiency", value: "87", unit: "%", tone: "teal", icon: "E" },
    ],
    layout: [
      {
        type: "table",
        title: "Workstation-wise Workload Details",
        columns: [
          { key: "ws", label: "Workstation", align: "left" },
          { key: "assigned", label: "Assigned" },
          { key: "pending", label: "Pending" },
          { key: "util", label: "Util %", format: "percent" },
          STATUS_COL,
        ],
        rows: [
          { ws: "CNC Machining", assigned: 18, pending: 3, util: 103, status: "overloaded" },
          { ws: "Assembly Line B", assigned: 15, pending: 4, util: 98, status: "at_risk" },
          { ws: "Painting", assigned: 12, pending: 1, util: 92, status: "on_track" },
          { ws: "Packaging", assigned: 14, pending: 2, util: 88, status: "on_track" },
        ],
        totalRow: { ws: "TOTAL", assigned: 125, pending: 23, util: 98, status: "" },
      },
      {
        type: "row",
        variant: "1-1",
        children: [
          { type: "insights", items: ["82% overall capacity use", "CNC & Assembly B overloaded", "23 pending work orders"] },
          { type: "actions", items: ["Allocate resources to CNC & Assembly B", "Expedite 18 high-priority jobs", "Rebalance workload next week"] },
        ],
      },
    ],
    bottomTabs: ["Dashboard", "Workload_Details", "Work_Order_List", "Capacity_Plan", "Efficiency_Analysis", "Settings"],
  },

  shift_equipment: {
    theme: "green",
    hero: { title: "SHIFT-WISE TASK & EQUIPMENT CHART", subtitle: SUB, left: "Plan · Produce · Track · Operate" },
    kpis: [
      { label: "Total Tasks", value: "24", tone: "blue", icon: "24" },
      { label: "Equipments", value: "8", tone: "green", icon: "8" },
      { label: "Operators", value: "18", tone: "orange", icon: "18" },
      { label: "Task Completion", value: "87", unit: "%", tone: "teal", icon: "%" },
      { label: "Downtime (Hrs)", value: "16", tone: "red", icon: "16" },
      { label: "Maint. Due", value: "3", tone: "yellow", icon: "3" },
    ],
    layout: [
      {
        type: "table",
        title: "Shift-wise Task & Equipment Details",
        columns: [
          { key: "shift", label: "Shift" },
          { key: "equip", label: "Equipment" },
          { key: "task", label: "Task", align: "left" },
          { key: "planned", label: "Plan Hrs" },
          { key: "actual", label: "Actual Hrs" },
          { key: "pct", label: "Completion %", format: "percent" },
          STATUS_COL,
        ],
        rows: [
          { shift: "A", equip: "CNC-01", task: "Bracket machining", planned: 8, actual: 7.5, pct: 94, status: "running" },
          { shift: "B", equip: "VMC-01", task: "Housing finish", planned: 8, actual: 6.2, pct: 78, status: "maintenance" },
          { shift: "C", equip: "ASM-01", task: "Panel assembly", planned: 8, actual: 8, pct: 100, status: "running" },
        ],
      },
      {
        type: "row",
        variant: "1-1",
        children: [
          { type: "insights", items: ["87% overall task completion", "92% equipment uptime", "3 maintenance jobs due"] },
          { type: "actions", items: ["Resolve Drill-01 breakdown", "Complete Grind-01 maintenance", "Review Shift C handover"] },
        ],
      },
    ],
    bottomTabs: ["Dashboard", "Task_Schedule", "Equipment_Master", "Shift_Reports", "Maintenance", "Settings"],
  },

  capital_cost: {
    theme: "navy",
    hero: { title: "Capital Cost Estimation Sheet", subtitle: SUB, left: "Plan · Estimate · Approve · Build" },
    kpis: [
      { label: "Total Est. Cost", value: "₹97.50 Cr", tone: "blue", icon: "E" },
      { label: "Approved Budget", value: "₹100 Cr", tone: "orange", icon: "B" },
      { label: "Variance", value: "-2.5", unit: "%", tone: "green", icon: "V" },
      { label: "Cost Items", value: "8", tone: "purple", icon: "8" },
      { label: "Commissioning", value: "Jun-26", tone: "teal", icon: "📅" },
    ],
    layout: [
      {
        type: "table",
        title: "Capital Expenditure Plan",
        columns: [
          { key: "cat", label: "Category", align: "left" },
          { key: "est", label: "Estimated (₹ Cr)", format: "number" },
          { key: "appr", label: "Approved (₹ Cr)", format: "number" },
          { key: "var", label: "Variance %", format: "percent" },
        ],
        rows: [
          { cat: "Plant Machinery", est: 40, appr: 42, var: -4.8 },
          { cat: "Factory Building", est: 25, appr: 25, var: 0 },
          { cat: "Utilities & Install", est: 18, appr: 17, var: 5.9 },
          { cat: "Contingency", est: 14.5, appr: 16, var: -9.4 },
        ],
        totalRow: { cat: "TOTAL", est: 97.5, appr: 100, var: -2.5 },
      },
      {
        type: "row",
        variant: "1-1",
        children: [
          { type: "insights", items: ["Estimate within approved budget", "Machinery is largest capex line", "Contingency reserved at 14%"] },
          { type: "actions", items: ["Finalize vendor quotes for CNC lines", "Management review 30-Apr", "Track installation milestones"] },
        ],
      },
    ],
    bottomTabs: ["Dashboard", "Cost Estimation", "Capex Details", "Assumptions", "Approvals", "Action Plan", "Settings"],
  },

  cashflow: {
    theme: "green",
    hero: { title: "Manufacturing Cashflow Dashboard", subtitle: SUB, left: "Plan · Produce · Control · Grow" },
    kpis: [
      { label: "Opening Balance", value: "₹1.25 Cr", tone: "blue", icon: "O" },
      { label: "Cash Inflow", value: "₹14.8 Cr", tone: "green", icon: "In" },
      { label: "Cash Outflow", value: "₹13.65 Cr", tone: "red", icon: "Out" },
      { label: "Closing Balance", value: "₹2.40 Cr", tone: "teal", icon: "C" },
      { label: "Receivables", value: "₹3.10 Cr", tone: "purple", icon: "AR" },
      { label: "Current Ratio", value: "1.68", tone: "lime", icon: "R" },
    ],
    layout: [
      {
        type: "row",
        variant: "2-1",
        children: [
          {
            type: "table",
            title: "Monthly Cashflow Summary (₹ Lakhs)",
            columns: [
              { key: "month", label: "Month", align: "left" },
              { key: "in", label: "Inflow" },
              { key: "out", label: "Outflow" },
              { key: "net", label: "Net" },
              { key: "close", label: "Closing" },
            ],
            rows: [
              { month: "Apr-24", in: 1180, out: 1090, net: 90, close: 1340 },
              { month: "May-24", in: 1220, out: 1140, net: 80, close: 1420 },
              { month: "Jun-24", in: 1250, out: 1160, net: 90, close: 1510 },
            ],
          },
          {
            type: "chart",
            title: "Cash Inflow vs Outflow",
            chartType: "bar",
            xKey: "month",
            data: [
              { month: "Apr", in: 1180, out: 1090 },
              { month: "May", in: 1220, out: 1140 },
              { month: "Jun", in: 1250, out: 1160 },
            ],
            bars: [
              { key: "in", name: "Inflow", color: "#16a34a" },
              { key: "out", name: "Outflow", color: "#0ea5e9" },
            ],
          },
        ],
      },
      {
        type: "row",
        variant: "1-1",
        children: [
          { type: "insights", items: ["77% inflow growth vs prior year on track", "Debtor days: 48", "Comfortable liquidity position"] },
          { type: "actions", items: ["Follow up top 5 customer collections", "Review payable schedule", "Update 13-week cash forecast"] },
        ],
      },
    ],
    bottomTabs: ["Dashboard", "Cashflow", "Receivables", "Payables", "Analysis", "Action Plan"],
  },

  expense_forecast: {
    theme: "purple",
    hero: {
      title: "Monthly & Quarterly Expense Forecast",
      subtitle: SUB,
      meta: ["FY 2025-26", "Plant: Pune", "Updated: 15-Apr-2025"],
    },
    kpis: [
      { label: "Total Expense FY", value: "₹24.86 Cr", tone: "blue", icon: "T" },
      { label: "Avg Monthly", value: "₹2.07 Cr", tone: "green", icon: "M" },
      { label: "Q2 Highest", value: "₹6.63 Cr", tone: "orange", icon: "Q2" },
      { label: "Forecast vs Actual", value: "+4.5", unit: "%", tone: "red", icon: "V" },
      { label: "Cost Driver", value: "Production", unit: "38%", tone: "purple", icon: "P" },
    ],
    layout: [
      {
        type: "chart",
        title: "Total Expense Trend (Monthly)",
        chartType: "line",
        xKey: "month",
        data: [
          { month: "Apr", expense: 195 },
          { month: "May", expense: 202 },
          { month: "Jun", expense: 210 },
          { month: "Jul", expense: 218 },
        ],
        lines: [{ key: "expense", name: "Expense (₹ L)", color: "#818cf8" }],
      },
      {
        type: "row",
        variant: "1-1",
        children: [
          { type: "insights", items: ["Expenses rise in Q2 with higher production", "Labour and utility costs stable", "Forecast within budget range"] },
          { type: "actions", items: ["Focus maintenance cost control", "Update Q2 assumptions", "Review logistics spend"] },
        ],
      },
    ],
    bottomTabs: ["Dashboard", "Monthly Forecast", "Quarterly View", "Variance Analysis", "Assumptions", "Action Plan"],
  },

  resource_matrix: {
    theme: "gold",
    hero: { title: "Project Resource Matrix", subtitle: SUB, left: "PLAN · PEOPLE · PRODUCE · PROGRESS" },
    kpis: [
      { label: "Total Resources", value: "48", tone: "yellow", icon: "48" },
      { label: "Available", value: "12", tone: "green", icon: "12" },
      { label: "Allocated", value: "36", tone: "blue", icon: "36" },
      { label: "Critical", value: "5", tone: "red", icon: "5" },
      { label: "Avg Utilization", value: "78", unit: "%", tone: "purple", icon: "%" },
      { label: "Active Projects", value: "8", tone: "teal", icon: "8" },
    ],
    layout: [
      {
        type: "table",
        title: "Resource Matrix",
        columns: [
          { key: "dept", label: "Dept", align: "left" },
          { key: "name", label: "Resource", align: "left" },
          { key: "role", label: "Role", align: "left" },
          { key: "avail", label: "Availability" },
          { key: "util", label: "Util %", format: "percent" },
          { key: "priority", label: "Priority", type: "status" },
        ],
        rows: [
          { dept: "Engineering", name: "Ravi Kumar", role: "Project Engineer", avail: "Allocated", util: 95, priority: "high" },
          { dept: "Production", name: "Sneha Patel", role: "Machine Operator", avail: "Allocated", util: 88, priority: "medium" },
          { dept: "Planning", name: "Amit Shah", role: "Planner", avail: "Available", util: 45, priority: "low" },
        ],
      },
      {
        type: "row",
        variant: "1-1",
        children: [
          { type: "insights", items: ["5 critical resources above 90% utilization", "12 resources available for new work", "8 active manufacturing projects"] },
          { type: "actions", items: ["Cross-train backup for CNC lead", "Resolve Planning bandwidth gap", "Update skills matrix Q2"] },
        ],
      },
    ],
    bottomTabs: ["Dashboard", "Resource Matrix", "Project List", "Resource Plan", "Skills", "Reports"],
  },

  raci_roles: {
    theme: "red",
    hero: { title: "Task-Based RACI Role Assignment Sheet", subtitle: SUB, left: "Plan · Produce · Ensure Quality · Deliver Safely" },
    kpis: [
      { label: "Total Tasks", value: "12", tone: "blue", icon: "12" },
      { label: "Responsible (R)", value: "12", tone: "green", icon: "R" },
      { label: "Accountable (A)", value: "12", tone: "orange", icon: "A" },
      { label: "Pending Clarifications", value: "3", tone: "red", icon: "3" },
      { label: "Departments", value: "8", tone: "purple", icon: "8" },
      { label: "Review Status", value: "75", unit: "%", tone: "teal", icon: "%" },
    ],
    layout: [
      {
        type: "table",
        title: "RACI Matrix - Manufacturing Tasks",
        columns: [
          { key: "task", label: "Task", align: "left" },
          { key: "prod", label: "Production" },
          { key: "qual", label: "Quality" },
          { key: "maint", label: "Maint." },
          { key: "stage", label: "Stage" },
          STATUS_COL,
        ],
        rows: [
          { task: "Production Setup", prod: "R", qual: "C", maint: "I", stage: "Execution", status: "completed" },
          { task: "Machine Changeover", prod: "R", qual: "I", maint: "C", stage: "Execution", status: "completed" },
          { task: "Preventive Maintenance", prod: "C", qual: "I", maint: "R", stage: "Planned", status: "in_progress" },
          { task: "Quality Check", prod: "C", qual: "R", maint: "I", stage: "Execution", status: "in_progress" },
        ],
      },
      {
        type: "row",
        variant: "1-1",
        children: [
          { type: "notes", title: "Key Notes", items: ["R = Responsible, A = Accountable, C = Consulted, I = Informed", "Only one Accountable (A) per task", "Review with department heads monthly"] },
          { type: "actions", items: ["Clarify role for Corrective Maintenance", "Review final RACI with HODs by 30-Apr", "Close 3 pending clarifications"] },
        ],
      },
    ],
    bottomTabs: ["Dashboard", "RACI Matrix", "Department View", "Task Tracker", "Charts", "Notes"],
  },

  ...TOOLKIT_CONFIGS_BATCH2,
};

export function getToolkitConfig(id) {
  return TOOLKIT_CONFIGS[id] || null;
}
