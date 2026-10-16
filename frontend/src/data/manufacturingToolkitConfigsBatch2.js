/** Additional Manufacturing Toolkit dashboards (batch 2) */
const SUB = "Manufacturing Production Planning & Factory Control Toolkit";
const STATUS_COL = { key: "status", label: "Status", type: "status" };

export const TOOLKIT_CONFIGS_BATCH2 = {
  inventory_register: {
    theme: "green",
    hero: {
      title: "Manufacturing",
      highlight: "Inventory Register",
      subtitle: SUB,
      left: "Right Materials · Right Production",
      right: "Today: 23-Apr-2025",
    },
    kpis: [
      { label: "Total Items", value: "125", unit: "Active SKUs", tone: "blue", icon: "📦" },
      { label: "Stock Value", value: "₹48.76L", tone: "green", icon: "₹" },
      { label: "Low Stock", value: "18", unit: "Below reorder", tone: "orange", icon: "!" },
      { label: "Received (MTD)", value: "12,480", unit: "Units", tone: "teal", icon: "↓" },
      { label: "Issued (MTD)", value: "10,215", unit: "Units", tone: "purple", icon: "↑" },
      { label: "Dead Stock", value: "7", unit: "90+ days", tone: "red", icon: "⏸" },
      { label: "Stock Accuracy", value: "98.4", unit: "%", tone: "lime", icon: "✓" },
    ],
    layout: [
      {
        type: "row",
        variant: "2-1",
        children: [
          {
            type: "table",
            title: "Inventory Register",
            columns: [
              { key: "sno", label: "S.No." },
              { key: "code", label: "Item Code" },
              { key: "name", label: "Item Name", align: "left" },
              { key: "cat", label: "Category" },
              { key: "unit", label: "Unit" },
              { key: "open", label: "Opening" },
              { key: "recv", label: "Received" },
              { key: "issued", label: "Issued" },
              { key: "bal", label: "Balance" },
              { key: "reorder", label: "Reorder" },
              { key: "value", label: "Stock Value (₹)", format: "currency" },
              { key: "loc", label: "Location" },
              STATUS_COL,
              { key: "updated", label: "Last Updated" },
            ],
            rows: [
              { sno: 1, code: "RM-001", name: "Mild Steel Plate 6mm", cat: "Raw Materials", unit: "KG", open: 1200, recv: 800, issued: 600, bal: 1400, reorder: 500, value: 126000, loc: "RM-01-A", status: "normal", updated: "22-Apr-2025" },
              { sno: 2, code: "RM-014", name: "SS-304 Sheet", cat: "Raw Materials", unit: "KG", open: 180, recv: 120, issued: 250, bal: 50, reorder: 200, value: 42000, loc: "RM-02-B", status: "low_stock", updated: "22-Apr-2025" },
              { sno: 3, code: "CMP-088", name: "Bearing 6205", cat: "Components", unit: "Nos", open: 400, recv: 200, issued: 180, bal: 420, reorder: 150, value: 33600, loc: "ST-03-C", status: "normal", updated: "21-Apr-2025" },
              { sno: 4, code: "CON-012", name: "Cutting Oil", cat: "Consumables", unit: "Ltr", open: 80, recv: 40, issued: 55, bal: 65, reorder: 40, value: 9750, loc: "ST-01", status: "normal", updated: "20-Apr-2025" },
              { sno: 5, code: "PKG-021", name: "Corrugated Box 18×12", cat: "Packing", unit: "Nos", open: 2200, recv: 1500, issued: 1800, bal: 1900, reorder: 1200, value: 28500, loc: "PK-02", status: "normal", updated: "22-Apr-2025" },
              { sno: 6, code: "SPR-006", name: "V-Belt B-52", cat: "Spares", unit: "Nos", open: 24, recv: 0, issued: 6, bal: 18, reorder: 10, value: 5400, loc: "MT-01", status: "normal", updated: "19-Apr-2025" },
              { sno: 7, code: "FG-220", name: "Bracket Assembly", cat: "Finished Goods", unit: "Nos", open: 600, recv: 400, issued: 180, bal: 820, reorder: 300, value: 98400, loc: "FG-01", status: "normal", updated: "22-Apr-2025" },
              { sno: 8, code: "ELEC-019", name: "Proximity Sensor", cat: "Components", unit: "Nos", open: 90, recv: 30, issued: 45, bal: 75, reorder: 80, value: 56250, loc: "EL-01", status: "low_stock", updated: "22-Apr-2025" },
            ],
          },
          {
            type: "row",
            variant: "1-1",
            children: [
              {
                type: "chart",
                title: "Stock by Category (₹)",
                chartType: "bar",
                xKey: "name",
                data: [
                  { name: "Raw", v: 1240000 },
                  { name: "Components", v: 980000 },
                  { name: "Consumables", v: 620000 },
                  { name: "FG", v: 1100000 },
                ],
                bars: [{ key: "v", name: "Value", color: "#166534" }],
              },
              {
                type: "chart",
                title: "Fast vs Slow Moving",
                chartType: "donut",
                donutCenter: "125 Items",
                data: [{ name: "Fast", value: 72 }, { name: "Slow", value: 28 }],
              },
            ],
          },
        ],
      },
      {
        type: "row",
        variant: "1-1",
        children: [
          { type: "insights", items: ["18 items below reorder — raise indents", "Stock accuracy 98.4% after last cycle count", "Review 7 dead-stock SKUs for disposal"] },
          { type: "actions", items: ["Expedite PO for SS-304", "Schedule monthly stock verification", "Align safety stock with production plan"] },
        ],
      },
    ],
    bottomTabs: ["Dashboard", "Inventory Register", "Stock Movement", "Low Stock", "Dead Stock", "Category Analysis", "Data"],
  },

  raw_material_tracker: {
    theme: "orange",
    hero: { titlePrefix: "Manufacturing", highlight: "Raw Material Tracker", subtitle: SUB, left: "Right Material · Right Time" },
    kpis: [
      { label: "Total Materials", value: "42", unit: "Items", tone: "orange", icon: "📦" },
      { label: "Current Stock", value: "285,430", unit: "Qty", tone: "orange", icon: "S" },
      { label: "Consumption (Mo)", value: "112,580", unit: "Qty", tone: "blue", icon: "↓" },
      { label: "Pending Inward", value: "76,200", unit: "Qty", tone: "orange", icon: "🚚" },
      { label: "Critical", value: "8", unit: "Items", tone: "red", icon: "!" },
      { label: "Avg Lead Time", value: "12", unit: "Days", tone: "blue", icon: "⏱" },
      { label: "Suppliers", value: "15", tone: "blue", icon: "👥" },
    ],
    layout: [
      {
        type: "row",
        variant: "2-1",
        children: [
          {
            type: "table",
            title: "Raw Material Details",
            columns: [
              { key: "code", label: "Code" },
              { key: "name", label: "Material", align: "left" },
              { key: "supplier", label: "Supplier", align: "left" },
              { key: "bal", label: "Balance" },
              { key: "reorder", label: "Reorder" },
              { key: "lead", label: "Lead (d)" },
              { key: "quality", label: "Quality", type: "status" },
            ],
            rows: [
              { code: "STL-01", name: "Steel Coils", supplier: "Tata Steel", bal: 42000, reorder: 28000, lead: 14, quality: "ok" },
              { code: "ALU-02", name: "Aluminum Sheets", supplier: "Hindalco", bal: 8500, reorder: 18000, lead: 12, quality: "low" },
              { code: "POL-03", name: "Polymer Granules", supplier: "Reliance", bal: 1200, reorder: 8000, lead: 10, quality: "critical" },
            ],
          },
          {
            type: "chart",
            title: "Consumption Trend (6 Mo)",
            chartType: "line",
            xKey: "month",
            data: [
              { month: "Jan", qty: 78200 },
              { month: "Feb", qty: 92450 },
              { month: "Mar", qty: 110320 },
              { month: "Apr", qty: 98760 },
              { month: "May", qty: 121500 },
              { month: "Jun", qty: 112580 },
            ],
            lines: [{ key: "qty", name: "Consumption", color: "#ea580c" }],
          },
        ],
      },
      {
        type: "row",
        variant: "1-1",
        children: [
          { type: "insights", items: ["8 critical materials — place PO now", "Pending inward 76,200 qty across 6 categories", "Metals 28% of category stock value"] },
          { type: "actions", items: ["Raise indent for Aluminum Sheets", "Monitor Polymer lead time", "Review supplier-wise supply contracts"] },
        ],
      },
    ],
    bottomTabs: ["Dashboard", "Material Master", "Inward", "Consumption", "Critical List", "Suppliers"],
  },

  machine_downtime: {
    theme: "navy",
    hero: { title: "Machine Downtime &", highlight: "Service Log", subtitle: SUB, left: "Plan · Produce · Maintain · Grow" },
    kpis: [
      { label: "Machines Logged", value: "18", tone: "blue", icon: "⚙" },
      { label: "Downtime Hours", value: "124.5", unit: "Hrs", tone: "orange", icon: "⏱" },
      { label: "Service Cases", value: "32", tone: "teal", icon: "🔧" },
      { label: "Open Cases", value: "6", tone: "red", icon: "!" },
      { label: "Maint. Cost", value: "₹1.49L", tone: "purple", icon: "₹" },
      { label: "Avg Repair Time", value: "3.9", unit: "Hrs", tone: "blue", icon: "⏱" },
      { label: "Uptime Score", value: "92.1", unit: "%", tone: "green", icon: "%" },
    ],
    layout: [
      {
        type: "row",
        variant: "2-1",
        children: [
          {
            type: "table",
            title: "Machine Service Log",
            columns: [
              { key: "id", label: "Machine ID" },
              { key: "name", label: "Name", align: "left" },
              { key: "dept", label: "Dept" },
              { key: "hrs", label: "Downtime Hrs" },
              { key: "issue", label: "Issue Type" },
              { key: "engineer", label: "Engineer" },
              STATUS_COL,
            ],
            rows: [
              { id: "CNC-01", name: "CNC Turning Center", dept: "Machining", hrs: 28.5, issue: "Mechanical", engineer: "Ramesh P", status: "open" },
              { id: "VMC-01", name: "VMC", dept: "Machining", hrs: 12, issue: "Electrical", engineer: "Suresh K", status: "closed" },
              { id: "CONV-01", name: "Conveyor", dept: "Logistics", hrs: 18, issue: "Mechanical", engineer: "Amit D", status: "closed" },
            ],
          },
          {
            type: "row",
            variant: "1-1",
            children: [
              {
                type: "chart",
                title: "Downtime by Machine (Hrs)",
                chartType: "bar",
                xKey: "name",
                data: [
                  { name: "CNC-01", h: 28.5 },
                  { name: "IM-01", h: 22 },
                  { name: "CONV-01", h: 18 },
                ],
                bars: [{ key: "h", name: "Hours", color: "#1e40af" }],
              },
              {
                type: "chart",
                title: "Open vs Closed Cases",
                chartType: "donut",
                donutCenter: "32 Cases",
                data: [{ name: "Closed", value: 81 }, { name: "Open", value: 19 }],
              },
            ],
          },
        ],
      },
      { type: "actions", title: "Urgent Actions", items: ["CNC-01 spindle vibration — 5 days open", "Furnace temp variation — high priority", "Schedule PM for Compressor-01"] },
    ],
    bottomTabs: ["Dashboard", "Service Log", "Machine Master", "Preventive Maintenance", "Spare Parts", "Reports"],
  },

  output_downtime: {
    theme: "green",
    hero: { title: "Output vs.", highlight: "Downtime Performance", subtitle: SUB, meta: ["Report Week: 20–26 May 2024"] },
    kpis: [
      { label: "Planned Output", value: "48,500", unit: "Units", tone: "blue", icon: "T" },
      { label: "Actual Output", value: "44,120", unit: "Units", tone: "green", icon: "✓" },
      { label: "Total Downtime", value: "28.5", unit: "Hrs", tone: "red", icon: "⏱" },
      { label: "Efficiency", value: "90.9", unit: "%", tone: "purple", icon: "%" },
      { label: "Lost Output", value: "4,380", unit: "Units", tone: "red", icon: "!" },
      { label: "On-Track Lines", value: "4 / 6", tone: "green", icon: "✓" },
    ],
    layout: [
      {
        type: "table",
        title: "Production Line Performance",
        columns: [
          { key: "line", label: "Line", align: "left" },
          { key: "planned", label: "Planned" },
          { key: "actual", label: "Actual" },
          { key: "dt", label: "Downtime Hrs" },
          { key: "eff", label: "Eff %", format: "percent" },
          STATUS_COL,
        ],
        rows: [
          { line: "Line 1 - Assembly", planned: 8000, actual: 7650, dt: 4.2, eff: 95.6, status: "on_track" },
          { line: "Line 2 - Painting", planned: 7500, actual: 6800, dt: 6.5, eff: 87.1, status: "at_risk" },
          { line: "Line 3 - Machining", planned: 9000, actual: 8100, dt: 5.0, eff: 90.0, status: "on_track" },
          { line: "Line 4 - Packaging", planned: 8500, actual: 8200, dt: 3.1, eff: 96.5, status: "on_track" },
          { line: "Line 5 - Welding", planned: 7000, actual: 6100, dt: 6.8, eff: 87.1, status: "at_risk" },
          { line: "Line 6 - Inspection", planned: 8500, actual: 7270, dt: 2.9, eff: 85.5, status: "behind" },
        ],
        totalRow: { line: "TOTAL", planned: 48500, actual: 44120, dt: 28.5, eff: 90.9, status: "" },
      },
      {
        type: "chart",
        title: "Downtime Impact (Hrs)",
        chartType: "bar",
        xKey: "name",
        data: [
          { name: "Mechanical", h: 9.2 },
          { name: "Changeover", h: 6.5 },
          { name: "Material", h: 4.8 },
          { name: "Electrical", h: 3.1 },
        ],
        bars: [{ key: "h", name: "Hours", color: "#14532d" }],
      },
      {
        type: "actions",
        items: [
          "Reduce Line 2 changeover time",
          "Resolve welding fixture on Line 5",
          "Operator training for Line 6",
        ],
      },
    ],
    bottomTabs: ["Dashboard", "Production Data", "Downtime Log", "Analysis", "Action Plan"],
  },

  work_order_tracker: {
    theme: "purple",
    hero: { title: "Manufacturing", highlight: "Work Order Tracker", subtitle: SUB, left: "Plan · Produce · Deliver · Grow", right: "24 Apr 2025" },
    kpis: [
      { label: "Total WOs", value: "42", tone: "blue", icon: "42" },
      { label: "Released", value: "12", tone: "teal", icon: "12" },
      { label: "In Process", value: "16", tone: "orange", icon: "16" },
      { label: "Completed", value: "9", tone: "green", icon: "9" },
      { label: "Delayed", value: "5", tone: "red", icon: "5" },
      { label: "Pending Qty", value: "12,450", tone: "purple", icon: "Q" },
      { label: "Schedule Adherence", value: "78", unit: "%", tone: "lime", icon: "%" },
    ],
    layout: [
      {
        type: "row",
        variant: "2-1",
        children: [
          {
            type: "table",
            title: "Work Order Details",
            columns: [
              { key: "wo", label: "WO #" },
              { key: "product", label: "Product", align: "left" },
              { key: "customer", label: "Customer", align: "left" },
              { key: "planned", label: "Planned Qty" },
              { key: "done", label: "Completed Qty" },
              { key: "start", label: "Start Date" },
              { key: "due", label: "Due Date" },
              { key: "supervisor", label: "Supervisor" },
              { key: "priority", label: "Priority", type: "status" },
              { key: "status", label: "WO Status", type: "status" },
            ],
            rows: [
              { wo: "WO-1001", product: "Gear Housing", customer: "Bharat Auto Ltd", planned: 1000, done: 1000, start: "10-Apr", due: "18-Apr", supervisor: "Ramesh K", priority: "medium", status: "completed" },
              { wo: "WO-1002", product: "Valve Assembly", customer: "L&T Hydraulics", planned: 2000, done: 1200, start: "12-Apr", due: "22-Apr", supervisor: "Suresh P", priority: "high", status: "in_progress" },
              { wo: "WO-1003", product: "Pump Casing", customer: "Kirloskar Brothers", planned: 1500, done: 1500, start: "08-Apr", due: "16-Apr", supervisor: "Anita S", priority: "medium", status: "completed" },
              { wo: "WO-1004", product: "Motor Bracket", customer: "Tata Motors", planned: 2500, done: 0, start: "20-Apr", due: "28-Apr", supervisor: "Vikram D", priority: "high", status: "released" },
              { wo: "WO-1005", product: "Shaft Ø50", customer: "Mahindra", planned: 3000, done: 1800, start: "14-Apr", due: "24-Apr", supervisor: "Kavita M", priority: "medium", status: "in_progress" },
              { wo: "WO-1006", product: "Flange", customer: "BHEL", planned: 1200, done: 0, start: "05-Apr", due: "15-Apr", supervisor: "Imran A", priority: "high", status: "delay" },
              { wo: "WO-1007", product: "Gear - Spur", customer: "Siemens India", planned: 900, done: 900, start: "11-Apr", due: "19-Apr", supervisor: "Ramesh K", priority: "low", status: "completed" },
              { wo: "WO-1008", product: "Control Panel", customer: "ITC Engineering", planned: 600, done: 200, start: "18-Apr", due: "26-Apr", supervisor: "Suresh P", priority: "medium", status: "in_progress" },
              { wo: "WO-1009", product: "Pump Shaft", customer: "Thermax Ltd", planned: 1800, done: 0, start: "09-Apr", due: "17-Apr", supervisor: "Anita S", priority: "high", status: "delay" },
              { wo: "WO-1010", product: "Base Frame", customer: "Bharat Forge", planned: 2200, done: 600, start: "16-Apr", due: "30-Apr", supervisor: "Vikram D", priority: "medium", status: "released" },
            ],
          },
          {
            type: "chart",
            title: "WO Status Distribution",
            chartType: "donut",
            donutCenter: "42 WOs",
            data: [
              { name: "Released", value: 29 },
              { name: "In Process", value: 38 },
              { name: "Completed", value: 21 },
              { name: "Delayed", value: 12 },
            ],
          },
        ],
      },
      { type: "actions", items: ["Expedite machining for WO-1006", "Release material for WO-1004", "Review supervisor workload balance"] },
    ],
    bottomTabs: ["Dashboard", "Work Orders", "Production Plan", "Material Plan", "Reports"],
  },

  quality_defect: {
    theme: "navy",
    hero: { title: "Manufacturing Quality", highlight: "Defect Tracker", subtitle: SUB, right: "23-Apr-2025" },
    kpis: [
      { label: "Total Defects", value: "356", tone: "red", icon: "!" },
      { label: "Open", value: "87", tone: "blue", icon: "87" },
      { label: "Resolved", value: "269", tone: "green", icon: "269" },
      { label: "Defect Rate", value: "2.8", unit: "%", tone: "orange", icon: "%" },
      { label: "First Pass Yield", value: "96.1", unit: "%", tone: "teal", icon: "✓" },
      { label: "Critical Issues", value: "12", tone: "red", icon: "12" },
    ],
    layout: [
      {
        type: "row",
        variant: "1-1",
        children: [
          {
            type: "chart",
            title: "Defects by Category",
            chartType: "bar",
            xKey: "name",
            data: [
              { name: "Dimensional", v: 104 },
              { name: "Surface", v: 76 },
              { name: "Functional", v: 58 },
              { name: "Material", v: 42 },
            ],
            bars: [{ key: "v", name: "Count", color: "#dc2626" }],
          },
          {
            type: "chart",
            title: "Severity Split",
            chartType: "donut",
            donutCenter: "356 Defects",
            data: [
              { name: "Minor", value: 46 },
              { name: "Major", value: 18 },
              { name: "Critical", value: 3 },
            ],
          },
        ],
      },
      {
        type: "table",
        title: "Detailed Defect Log",
        columns: [
          { key: "id", label: "Defect ID" },
          { key: "product", label: "Product", align: "left" },
          { key: "line", label: "Line" },
          { key: "type", label: "Type" },
          { key: "qty", label: "Qty" },
          { key: "severity", label: "Severity", type: "status" },
          STATUS_COL,
        ],
        rows: [
          { id: "DEF-101", product: "Bracket A", line: "Line A", type: "Dimensional", qty: 4, severity: "major", status: "open" },
          { id: "DEF-102", product: "Housing B", line: "Line C", type: "Surface", qty: 2, severity: "minor", status: "in_progress" },
          { id: "DEF-103", product: "Panel C", line: "Line E", type: "Functional", qty: 1, severity: "critical", status: "open" },
        ],
      },
      { type: "actions", items: ["Daily quality huddle on open critical defects", "Root cause on Line A dimensional drift", "Update control plans for Panel C"] },
    ],
    bottomTabs: ["Dashboard", "Defect Log", "Charts", "Pivot Analysis", "Corrective Actions", "Data"],
  },

  quality_management_plan: {
    theme: "navy",
    hero: { title: "Quality Management", highlight: "Plan", subtitle: SUB, right: "Today: 23-Apr-2025" },
    kpis: [
      { label: "Quality Objectives", value: "12", unit: "Active", tone: "blue", icon: "12" },
      { label: "Audits Planned", value: "24", unit: "2025", tone: "teal", icon: "24" },
      { label: "Audits Completed", value: "18", unit: "75%", tone: "green", icon: "18" },
      { label: "CAPA Actions", value: "16", unit: "7 open", tone: "orange", icon: "16" },
      { label: "Training Complete", value: "92", unit: "%", tone: "purple", icon: "%" },
      { label: "Supplier Score", value: "88.5", unit: "%", tone: "lime", icon: "S" },
      { label: "Compliance", value: "Compliant", tone: "green", icon: "✓" },
    ],
    layout: [
      {
        type: "row",
        variant: "2-1",
        children: [
          {
            type: "table",
            title: "Quality Initiatives — Planning & Tracking",
            columns: [
              { key: "init", label: "Initiative", align: "left" },
              { key: "dept", label: "Dept" },
              { key: "owner", label: "Owner" },
              { key: "target", label: "Target" },
              STATUS_COL,
            ],
            rows: [
              { init: "Internal Quality Audit Program", dept: "Quality", owner: "Priya N", target: "Dec-2025", status: "on_track" },
              { init: "Supplier Quality Improvement", dept: "Procurement", owner: "Vikram S", target: "Sep-2025", status: "at_risk" },
              { init: "Calibration Compliance", dept: "Maintenance", owner: "Rahul M", target: "Jun-2025", status: "completed" },
            ],
          },
          {
            type: "chart",
            title: "CAPA Status",
            chartType: "donut",
            donutCenter: "16 CAPA",
            data: [
              { name: "Open", value: 44 },
              { name: "In Progress", value: 31 },
              { name: "Closed", value: 25 },
            ],
          },
        ],
      },
      { type: "notes", title: "Key Notes", items: ["Conduct monthly management review", "Close overdue CAPA within 30 days", "Maintain ISO audit evidence folder"] },
    ],
    bottomTabs: ["Dashboard", "Quality Plan", "Audit Schedule", "CAPA Register", "Training Plan", "Supplier Quality"],
  },

  equipment_inventory: {
    theme: "green",
    hero: { title: "Equipment", highlight: "Inventory", subtitle: SUB, right: "23-Apr-2025" },
    kpis: [
      { label: "Total Equipment", value: "248", unit: "Assets", tone: "blue", icon: "248" },
      { label: "Active", value: "189", unit: "76.2%", tone: "green", icon: "✓" },
      { label: "Under Maintenance", value: "26", tone: "orange", icon: "26" },
      { label: "Idle", value: "18", tone: "blue", icon: "18" },
      { label: "Calibration Due", value: "14", tone: "red", icon: "14" },
      { label: "Asset Value", value: "₹12.49Cr", tone: "purple", icon: "₹" },
    ],
    layout: [
      {
        type: "row",
        variant: "2-1",
        children: [
          {
            type: "table",
            title: "Equipment Register",
            columns: [
              { key: "id", label: "Equipment ID" },
              { key: "name", label: "Name", align: "left" },
              { key: "cat", label: "Category" },
              { key: "dept", label: "Dept" },
              { key: "value", label: "Value (₹)", format: "currency" },
              STATUS_COL,
            ],
            rows: [
              { id: "EQP-001", name: "CNC Turning Center", cat: "Machinery", dept: "Production", value: 1850000, status: "running" },
              { id: "EQP-002", name: "Air Compressor", cat: "Utilities", dept: "Maintenance", value: 420000, status: "maintenance" },
              { id: "EQP-005", name: "Laser Marking", cat: "Machinery", dept: "Production", value: 980000, status: "normal" },
            ],
          },
          {
            type: "chart",
            title: "Equipment by Department",
            chartType: "bar",
            xKey: "name",
            data: [
              { name: "Production", c: 58 },
              { name: "Maintenance", c: 42 },
              { name: "Quality", c: 28 },
              { name: "Warehouse", c: 24 },
            ],
            bars: [{ key: "c", name: "Count", color: "#1e40af" }],
          },
        ],
      },
      { type: "insights", items: ["14 items due calibration within 60 days", "26 assets under maintenance", "Plan replacement for 20 assets >15 years old"] },
    ],
    bottomTabs: ["Dashboard", "Equipment Register", "Maintenance Schedule", "Calibration Tracker", "Warranty Tracker"],
  },

  utilization_rate: {
    theme: "navy",
    hero: { title: "Utilization Rate", highlight: "Dashboard", subtitle: SUB, right: "23-Apr-2025 Wednesday" },
    kpis: [
      { label: "Avg Utilization", value: "82.4", unit: "%", tone: "green", icon: "%" },
      { label: "Planned Hours", value: "14,400", tone: "blue", icon: "H" },
      { label: "Utilized Hours", value: "11,866", tone: "teal", icon: "H" },
      { label: "Idle Hours", value: "2,534", tone: "red", icon: "H" },
      { label: "Line Efficiency", value: "87.1", unit: "%", tone: "purple", icon: "%" },
      { label: "Underutilized", value: "3", unit: "Assets", tone: "orange", icon: "3" },
      { label: "Capacity Load", value: "82.4", unit: "%", tone: "lime", icon: "%" },
    ],
    layout: [
      {
        type: "table",
        title: "Line / Resource Utilization",
        columns: [
          { key: "res", label: "Line / Resource", align: "left" },
          { key: "dept", label: "Dept" },
          { key: "planned", label: "Planned Hrs" },
          { key: "used", label: "Used Hrs" },
          { key: "util", label: "Util %", format: "percent" },
          { key: "var", label: "Var (pp)" },
          STATUS_COL,
        ],
        rows: [
          { res: "Line A", dept: "Machining", planned: 2200, used: 1960, util: 89.2, var: 4.2, status: "on_track" },
          { res: "Line D", dept: "Packaging", planned: 2100, used: 1680, util: 72.4, var: -12.6, status: "underutilized" },
          { res: "CNC-03", dept: "Machining", planned: 600, used: 570, util: 95, var: 10, status: "constrained" },
        ],
      },
      {
        type: "chart",
        title: "Monthly Utilization Trend",
        chartType: "line",
        xKey: "month",
        data: [
          { month: "Jan", util: 76 },
          { month: "Feb", util: 78 },
          { month: "Mar", util: 80 },
          { month: "Apr", util: 82.4 },
        ],
        lines: [{ key: "util", name: "Utilization %", color: "#2563eb" }],
      },
      { type: "insights", items: ["Line D and CNC-03 need capacity rebalance", "Factory load 82.4% — room for 17.6% upside", "Target utilization 85% across lines"] },
    ],
    bottomTabs: ["Dashboard", "Utilization Data", "Line Analysis", "Department Analysis", "Monthly Trend"],
  },

  labour_productivity: {
    theme: "navy",
    hero: { title: "Manufacturing Labour", highlight: "Productivity Tracker", subtitle: SUB, right: "23-Apr-2025" },
    kpis: [
      { label: "Total Labour Hrs", value: "8,240", tone: "blue", icon: "⏱" },
      { label: "Output / Labour Hr", value: "12.8", unit: "Units", tone: "green", icon: "⚙" },
      { label: "Attendance", value: "94.6", unit: "%", tone: "teal", icon: "👥" },
      { label: "Overtime Hrs", value: "620", tone: "orange", icon: "OT" },
      { label: "Productivity Score", value: "87.4", unit: "/100", tone: "purple", icon: "S" },
      { label: "Absenteeism", value: "5.4", unit: "%", tone: "red", icon: "%" },
      { label: "Shift Efficiency", value: "91.2", unit: "%", tone: "lime", icon: "%" },
    ],
    layout: [
      {
        type: "row",
        variant: "2-1",
        children: [
          {
            type: "table",
            title: "Labour Productivity (Team View)",
            columns: [
              { key: "team", label: "Employee / Team", align: "left" },
              { key: "dept", label: "Dept" },
              { key: "shift", label: "Shift" },
              { key: "hrs", label: "Labour Hrs" },
              { key: "out", label: "Output" },
              { key: "rate", label: "Rate" },
              { key: "att", label: "Attendance", type: "status" },
            ],
            rows: [
              { team: "Rahul Sharma", dept: "Assembly", shift: "Morning", hrs: 8, out: 120, rate: 15, att: "present" },
              { team: "Sneha Patel", dept: "Machining", shift: "Afternoon", hrs: 8, out: 96, rate: 12, att: "present" },
              { team: "Suresh Babu", dept: "Painting", shift: "Morning", hrs: 0, out: 0, rate: 0, att: "absent" },
            ],
          },
          {
            type: "chart",
            title: "Department Productivity",
            chartType: "bar",
            xKey: "name",
            data: [
              { name: "Assembly", v: 15.6 },
              { name: "Machining", v: 12.4 },
              { name: "Packaging", v: 14.1 },
              { name: "Maintenance", v: 9.6 },
            ],
            bars: [{ key: "v", name: "Units/Labour Hr", color: "#1e40af" }],
          },
        ],
      },
      { type: "notes", title: "Notes", items: ["Productivity Rate = Output ÷ Labour Hours", "Track overtime above 10% of regular hours", "Absenteeism review every Monday"] },
    ],
    bottomTabs: ["Dashboard", "Labour Tracker", "Employee Master", "Department Analysis", "Shift Analysis"],
  },

  timesheet_tracking: {
    theme: "navy",
    hero: { title: "Timesheet", highlight: "Tracking", subtitle: SUB, left: "People · Productivity · Planning", right: "23-Apr-2025" },
    kpis: [
      { label: "Regular Hours", value: "5,832", tone: "blue", icon: "⏱" },
      { label: "Overtime Hours", value: "642", tone: "orange", icon: "OT" },
      { label: "Submitted", value: "284", unit: "Sheets", tone: "green", icon: "✓" },
      { label: "Pending Approval", value: "36", tone: "orange", icon: "36" },
      { label: "Missing Entries", value: "18", tone: "red", icon: "18" },
      { label: "Active Employees", value: "312", tone: "teal", icon: "312" },
      { label: "Labour Cost", value: "$48,290", tone: "purple", icon: "$" },
    ],
    layout: [
      {
        type: "table",
        title: "Employee Timesheet Details",
        columns: [
          { key: "emp", label: "Employee", align: "left" },
          { key: "dept", label: "Dept" },
          { key: "date", label: "Date" },
          { key: "reg", label: "Regular" },
          { key: "ot", label: "OT" },
          { key: "total", label: "Total" },
          STATUS_COL,
        ],
        rows: [
          { emp: "Rahul Sharma", dept: "Assembly", date: "22-Apr", reg: 8, ot: 1, total: 9, status: "approved" },
          { emp: "Sneha Patel", dept: "Machining", date: "22-Apr", reg: 8, ot: 0, total: 8, status: "pending" },
          { emp: "Vikram D", dept: "QC", date: "21-Apr", reg: 0, ot: 0, total: 0, status: "missing" },
        ],
      },
      {
        type: "chart",
        title: "Submission Status",
        chartType: "donut",
        donutCenter: "284 Timesheets",
        data: [
          { name: "Submitted", value: 78 },
          { name: "Pending", value: 12 },
          { name: "Not Submitted", value: 10 },
        ],
      },
      { type: "actions", items: ["Chase 18 missing entries by EOD Friday", "Clear pending approvals within 2 days", "Review OT spike in Machining dept"] },
    ],
    bottomTabs: ["Dashboard", "Timesheet Data", "Employee List", "Approval Tracker", "Missing Entries"],
  },

  daily_work_log: {
    theme: "navy",
    hero: { title: "Daily", highlight: "Work Log", subtitle: SUB, left: "Plan Today · Produce Tomorrow", right: "23-Apr-2025" },
    kpis: [
      { label: "Log Entries", value: "48", tone: "blue", icon: "48" },
      { label: "Tasks Completed", value: "36", unit: "75%", tone: "green", icon: "✓" },
      { label: "Pending Tasks", value: "12", tone: "orange", icon: "12" },
      { label: "Manpower", value: "84", tone: "teal", icon: "84" },
      { label: "Output", value: "1,280", unit: "Units", tone: "purple", icon: "U" },
      { label: "Downtime", value: "2.5", unit: "Hrs", tone: "red", icon: "⏱" },
      { label: "Issues", value: "6", tone: "red", icon: "6" },
    ],
    layout: [
      {
        type: "table",
        title: "Daily Work Log Details",
        columns: [
          { key: "date", label: "Date" },
          { key: "shift", label: "Shift" },
          { key: "dept", label: "Dept" },
          { key: "activity", label: "Activity", align: "left" },
          { key: "mp", label: "Manpower" },
          { key: "target", label: "Target" },
          { key: "actual", label: "Actual" },
          STATUS_COL,
        ],
        rows: [
          { date: "23-Apr", shift: "Morning", dept: "Production", activity: "Line A - Component Assembly", mp: 12, target: 400, actual: 420, status: "completed" },
          { date: "23-Apr", shift: "Afternoon", dept: "Painting", activity: "Batch paint run #44", mp: 8, target: 320, actual: 280, status: "in_progress" },
          { date: "23-Apr", shift: "Morning", dept: "Maintenance", activity: "Compressor PM", mp: 4, target: 0, actual: 0, status: "delayed" },
        ],
      },
      {
        type: "row",
        variant: "1-1",
        children: [
          {
            type: "chart",
            title: "Daily Task Completion",
            chartType: "bar",
            xKey: "day",
            data: [
              { day: "17-Apr", done: 28, pend: 8 },
              { day: "20-Apr", done: 32, pend: 6 },
              { day: "23-Apr", done: 36, pend: 12 },
            ],
            bars: [
              { key: "done", name: "Completed", color: "#2563eb" },
              { key: "pend", name: "Pending", color: "#16a34a" },
            ],
          },
          { type: "insights", items: ["85.3% of daily output target achieved", "6 issues logged — 2 equipment related", "Downtime down 18% vs yesterday"] },
        ],
      },
    ],
    bottomTabs: ["Dashboard", "Daily Log", "Data Lists", "Shift Summary", "Issue Log"],
  },

  process_checklist: {
    theme: "navy",
    hero: { title: "Process", highlight: "Checklist", subtitle: SUB, right: "23-Apr-2025 Wednesday" },
    kpis: [
      { label: "Total Items", value: "256", tone: "blue", icon: "256" },
      { label: "Completed", value: "198", tone: "green", icon: "198" },
      { label: "Pending", value: "42", tone: "orange", icon: "42" },
      { label: "Failed", value: "16", tone: "red", icon: "16" },
      { label: "Compliance", value: "77.3", unit: "%", tone: "teal", icon: "%" },
      { label: "Overdue", value: "28", tone: "red", icon: "28" },
      { label: "Approved", value: "184", tone: "lime", icon: "184" },
    ],
    layout: [
      {
        type: "table",
        title: "Process Checklist Details",
        columns: [
          { key: "id", label: "Checklist ID" },
          { key: "stage", label: "Stage" },
          { key: "item", label: "Description", align: "left" },
          { key: "owner", label: "Owner" },
          { key: "due", label: "Due" },
          STATUS_COL,
          { key: "result", label: "Result", type: "status" },
        ],
        rows: [
          { id: "CHK-001", stage: "Raw Material", item: "Incoming inspection sign-off", owner: "QC Lead", due: "22-Apr", status: "completed", result: "pass" },
          { id: "CHK-003", stage: "Production", item: "Line clearance before start", owner: "Supervisor", due: "23-Apr", status: "pending", result: "pending" },
          { id: "CHK-006", stage: "Quality", item: "Final inspection sampling", owner: "QC", due: "20-Apr", status: "overdue", result: "fail" },
        ],
      },
      {
        type: "chart",
        title: "Stage-wise Completion %",
        chartType: "bar",
        xKey: "name",
        data: [
          { name: "Raw Mat.", v: 88 },
          { name: "Production", v: 76 },
          { name: "QC", v: 92 },
          { name: "Dispatch", v: 81 },
        ],
        bars: [{ key: "v", name: "Completion %", color: "#1e40af" }],
      },
      { type: "actions", items: ["Close 28 overdue verifications", "Address failed checks CHK-006 and CHK-010", "Weekly compliance review with EHS"] },
    ],
    bottomTabs: ["Dashboard", "Checklist Data", "Department View", "Trends", "Overdue Checks", "Settings"],
  },

  incident_report: {
    theme: "red",
    hero: { title: "Incident", highlight: "Report", subtitle: SUB, left: "Safety · People · Process", meta: ["Plant: All Plants", "Period: Apr 2025"] },
    kpis: [
      { label: "Total Incidents", value: "48", tone: "red", icon: "48" },
      { label: "Open Investigations", value: "12", tone: "blue", icon: "12" },
      { label: "Closed", value: "36", tone: "green", icon: "36" },
      { label: "Lost Time Cases", value: "6", tone: "red", icon: "6" },
      { label: "Near Misses", value: "15", tone: "blue", icon: "15" },
      { label: "High Severity", value: "8", tone: "red", icon: "8" },
      { label: "Corrective Actions", value: "42", tone: "teal", icon: "42" },
    ],
    layout: [
      {
        type: "row",
        variant: "2-1",
        children: [
          {
            type: "table",
            title: "Incident Register",
            columns: [
              { key: "id", label: "Incident ID" },
              { key: "date", label: "Date" },
              { key: "dept", label: "Dept" },
              { key: "type", label: "Type", align: "left" },
              { key: "severity", label: "Severity", type: "status" },
              STATUS_COL,
            ],
            rows: [
              { id: "INC-2025-001", date: "01-Apr", dept: "Production", type: "Machinery Related", severity: "major", status: "open" },
              { id: "INC-2025-004", date: "08-Apr", dept: "Logistics", type: "Slips & Falls", severity: "minor", status: "closed" },
              { id: "INC-2025-006", date: "11-Apr", dept: "Maintenance", type: "Electrical", severity: "critical", status: "open" },
            ],
          },
          {
            type: "chart",
            title: "Severity Split",
            chartType: "donut",
            donutCenter: "48 Incidents",
            data: [
              { name: "Minor", value: 38 },
              { name: "Moderate", value: 37 },
              { name: "Major", value: 17 },
              { name: "Critical", value: 8 },
            ],
          },
        ],
      },
      { type: "insights", items: ["Report · Investigate · Prevent", "76% of corrective actions closed", "Focus on machinery and electrical categories"] },
    ],
    bottomTabs: ["Dashboard", "Incident Register", "Investigations", "CAPA", "Reports"],
  },

  issue_log: {
    theme: "maroon",
    hero: { title: "Issue Log &", highlight: "Register", subtitle: SUB, right: "Track Issues · Resolve Faster" },
    kpis: [
      { label: "Total Issues", value: "156", tone: "blue", icon: "156" },
      { label: "Open", value: "48", tone: "red", icon: "48" },
      { label: "Closed", value: "98", tone: "green", icon: "98" },
      { label: "Overdue", value: "17", tone: "red", icon: "17" },
      { label: "Critical", value: "12", tone: "red", icon: "12" },
      { label: "Avg Resolution", value: "6.8", unit: "Days", tone: "teal", icon: "D" },
      { label: "Owner Compliance", value: "92.3", unit: "%", tone: "lime", icon: "%" },
    ],
    layout: [
      {
        type: "row",
        variant: "2-1",
        children: [
          {
            type: "table",
            title: "Issue Log Details",
            columns: [
              { key: "id", label: "Issue ID" },
              { key: "raised", label: "Raised" },
              { key: "dept", label: "Dept" },
              { key: "title", label: "Title", align: "left" },
              { key: "priority", label: "Priority", type: "status" },
              { key: "owner", label: "Owner" },
              STATUS_COL,
            ],
            rows: [
              { id: "ISS-2401", raised: "05-Apr", dept: "Production", title: "Line 3 material shortage", priority: "high", owner: "R. Kumar", status: "open" },
              { id: "ISS-2408", raised: "12-Apr", dept: "Maintenance", title: "Hydraulic leak press-02", priority: "critical", owner: "S. Patel", status: "in_progress" },
              { id: "ISS-2412", raised: "18-Apr", dept: "Quality", title: "Gauge calibration overdue", priority: "medium", owner: "A. Singh", status: "closed" },
            ],
          },
          {
            type: "chart",
            title: "Issues by Priority",
            chartType: "bar",
            xKey: "name",
            data: [
              { name: "Low", v: 28 },
              { name: "Medium", v: 46 },
              { name: "High", v: 54 },
              { name: "Critical", v: 12 },
            ],
            bars: [{ key: "v", name: "Count", color: "#7f1d1d" }],
          },
        ],
      },
      { type: "actions", items: ["Escalate 17 overdue issues", "Weekly production-issue stand-up", "Close loop on critical maintenance items"] },
    ],
    bottomTabs: ["Dashboard", "Issue Log", "Pivot Analysis", "Department View", "Ageing"],
  },
};
