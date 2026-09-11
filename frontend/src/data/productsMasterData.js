/** Extended product master fields — merged with API catalog rows in the UI. */

export const PRODUCT_CATEGORIES = [
  "Raw Material",
  "Work in Progress (WIP)",
  "Finished Goods",
  "Consumables",
  "Spare Parts",
];

export const PRODUCT_TYPES = ["Raw Material", "Semi-Finished", "Finished Goods", "Service"];

export const PRODUCT_STATUSES = ["active", "inactive"];

export const WAREHOUSES = ["Main Store", "Production Store", "Finished Goods (FG) Store", "Quality Control (QC) Store"];

export const BRANDS = ["Tata Steel", "Bosch", "Siemens", "Local", "Generic"];

export const PRODUCT_UNITS = [
  "PCS",
  "NOS",
  "KGS",
  "GMS",
  "MTR",
  "SQMTR",
  "LTR",
  "BOX",
  "PACK",
  "SET",
  "TON",
  "CBM",
  "FT",
  "SQFT",
  "INCH",
  "MM",
  "CM",
  "PAIR",
  "ROLL",
  "BAG",
  "CAN",
  "DRUM",
  "PKT",
  "BUNDLE",
  "COIL",
  "SHEET",
  "KG",
  "ML",
];

export const DEMO_PRODUCTS = [];


export function guessCategory(sku = "", name = "") {
  const s = `${sku} ${name}`.toLowerCase();
  if (s.includes("part") || s.includes("stl") || s.includes("raw")) return "Raw Material";
  if (s.includes("widget") || s.includes("motor") || s.includes("valve")) return "Finished Goods";
  if (s.includes("lub") || s.includes("oil")) return "Consumables";
  return "Finished Goods";
}

export function enrichApiProduct(apiRow) {
  let category = apiRow.category || apiRow.product_type;
  
  // Try extracting explicit Category from description tag if category is default or missing
  const descMatch = apiRow.description?.match(/Category:\s*([^|]+)/i);
  if (descMatch && descMatch[1]?.trim()) {
    category = descMatch[1].trim();
  }

  if (category) {
    const cLower = String(category).trim().toLowerCase();
    if (cLower === "raw material" || cLower === "raw_material" || cLower === "rm") {
      category = "Raw Material";
    } else if (cLower.includes("wip") || cLower.includes("work in progress") || cLower === "semi-finished") {
      category = "WIP";
    } else if (cLower.includes("spare") || cLower.includes("parts")) {
      category = "Spare Parts";
    } else if (cLower.includes("consumable")) {
      category = "Consumables";
    } else if (cLower.includes("finished")) {
      category = "Finished Goods";
    }
  }

  if (!category || category === "No Category") {
    category = "Finished Goods";
  }
  const stock = apiRow.current_stock != null ? Number(apiRow.current_stock) : 0;
  const minStock = apiRow.min_stock != null ? Number(apiRow.min_stock) : 0;
  const maxStock = apiRow.max_stock != null ? Number(apiRow.max_stock) : 0;
  const unit = apiRow.unit || apiRow.unit_of_measure || apiRow.uom || "Pcs";

  // price_per_unit comes from unit_cost in backend
  const pricePerUnit = apiRow.price_per_unit != null
    ? Number(apiRow.price_per_unit)
    : apiRow.unit_cost != null
    ? Number(apiRow.unit_cost)
    : 0;

  // quantity comes from current_stock in backend
  const quantity = apiRow.quantity != null
    ? Number(apiRow.quantity)
    : stock;

  // total_cost = quantity * price_per_unit
  const totalCost = apiRow.total_cost != null
    ? Number(apiRow.total_cost)
    : apiRow.unit_price != null
    ? Number(apiRow.unit_price)
    : quantity * pricePerUnit;

  return {
    id: apiRow.id,
    product_code: apiRow.product_code || (apiRow.id ? `PRD${String(apiRow.id).padStart(3, "0")}` : "—"),
    name: apiRow.name || "—",
    category,
    product_type: apiRow.product_type || (category === "Raw Material" ? "Raw Material" : "Finished Goods"),
    sku: apiRow.sku || "—",
    barcode: apiRow.barcode || "—",
    brand: apiRow.brand || "—",
    unit,
    hsn_code: apiRow.hsn_code || "—",
    gst_percent: apiRow.gst_percent ?? 0,
    quantity,
    unit_price: apiRow.unit_price != null ? Number(apiRow.unit_price) : totalCost,
    price_per_unit: pricePerUnit,
    purchase_price: pricePerUnit,
    selling_price: apiRow.unit_price != null ? Number(apiRow.unit_price) : totalCost,
    total_cost: totalCost,
    min_stock: minStock,
    max_stock: maxStock,
    current_stock: stock,
    warehouse: apiRow.warehouse || "—",
    description: apiRow.description || "",
    status: apiRow.status || "active",
    bom: apiRow.bom || "—",
    production_time: apiRow.production_time || "—",
    machine_required: apiRow.machine_required || "—",
    quality_standard: apiRow.quality_standard || "—",
    batch_tracking: Boolean(apiRow.batch_tracking),
    serial_number: Boolean(apiRow.serial_number),
    expiry_date: apiRow.expiry_date || null,
    units_sold: apiRow.units_sold ?? 0,
    stock_value: stock * pricePerUnit,
    created_at: apiRow.created_at || new Date().toISOString().slice(0, 10),
  };
}



export function computeSummary(products) {
  const categories = new Set(products.map((p) => p.category));
  return {
    total: products.length,
    active: products.filter((p) => p.status === "active").length,
    inactive: products.filter((p) => p.status === "inactive").length,
    lowStock: products.filter((p) => p.current_stock > 0 && p.current_stock <= p.min_stock).length,
    outOfStock: products.filter((p) => p.current_stock === 0).length,
    categories: categories.size,
  };
}

export function computeQuickStats(products) {
  if (!products.length) {
    return {
      mostSold: "—",
      highestStock: "—",
      lowestStock: "—",
      recentlyAdded: "—",
      pendingApproval: 0,
    };
  }
  const mostSold = [...products].sort((a, b) => (b.units_sold || 0) - (a.units_sold || 0))[0];
  const highest = [...products].sort((a, b) => b.current_stock - a.current_stock)[0];
  const lowest = [...products].filter((p) => p.current_stock > 0).sort((a, b) => a.current_stock - b.current_stock)[0];
  const recent = [...products].sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""))[0];
  return {
    mostSold: mostSold?.name || "—",
    highestStock: highest ? `${highest.name} (${highest.current_stock})` : "—",
    lowestStock: lowest ? `${lowest.name} (${lowest.current_stock})` : "—",
    recentlyAdded: recent?.name || "—",
    pendingApproval: products.filter((p) => p.status === "inactive").length,
  };
}

export function getCategoryChartData(products = []) {
  if (!Array.isArray(products) || !products.length) return [];
  const counts = {};
  for (const p of products) {
    const cat = p.category || "Finished Goods";
    counts[cat] = (counts[cat] || 0) + 1;
  }
  const CATEGORY_COLORS = {
    "Finished Goods": "#22C55E",
    "Raw Material": "#3B82F6",
    "Work in Progress (WIP)": "#F97316",
    "Consumables": "#A855F7",
    "Spare Parts": "#64748B",
    "Semi-Finished": "#EAB308",
    "Assembly": "#06B6D4",
    "Sub-Assembly": "#8B5CF6",
  };
  return Object.entries(counts).map(([name, value], index) => ({
    name,
    value,
    color: CATEGORY_COLORS[name] || ["#22C55E", "#3B82F6", "#F97316", "#A855F7", "#64748B", "#EC4899", "#14B8A6"][index % 7],
  }));
}

export const categoryChartData = (products) => getCategoryChartData(products);
export const IMPORT_TEMPLATE_HEADERS = [
  "product_code",
  "name",
  "category",
  "sku",
  "unit",
  "purchase_price",
  "selling_price",
  "min_stock",
  "max_stock",
  "warehouse",
  "status",
];
