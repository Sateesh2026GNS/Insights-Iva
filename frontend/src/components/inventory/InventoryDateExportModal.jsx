import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Building2,
  Calendar,
  Check,
  Clock,
  Copy,
  Download,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  Mail,
  Package,
  PlusCircle,
  RefreshCw,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

import Button from "../common/Button";
import { useToast } from "../../context/ToastContext";
import {
  getStoreInventoryHistory,
  getStockLedger,
  getInventoryDashboard,
  getRawMaterials,
  getFinishedGoods,
} from "../../api/inventoryApi";
import { asArray } from "../../utils/apiError";
import WhatsAppIcon from "../common/WhatsAppIcon";

function formatReadableDate(isoDate) {
  if (!isoDate) return "Today";
  try {
    const [y, m, d] = String(isoDate).slice(0, 10).split("-");
    if (!y || !m || !d) return isoDate;
    const date = new Date(Number(y), Number(m) - 1, Number(d));
    return date.toLocaleDateString("en-IN", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return isoDate;
  }
}

function formatInr(val) {
  return `₹ ${Number(val || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatQty(val) {
  return Number(val || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  });
}

export default function InventoryDateExportModal({
  open,
  onClose,
  initialDate = "",
  warehouseId = "",
  warehouses = [],
  sectionTitle = "Inventory",
  itemType = "",
}) {
  const { addToast } = useToast();
  const [selectedDate, setSelectedDate] = useState(initialDate || new Date().toISOString().slice(0, 10));
  const [selectedWarehouse, setSelectedWarehouse] = useState(warehouseId || "");
  const [activeTab, setActiveTab] = useState("download"); // "download" | "whatsapp" | "email" | "preview"
  const [loading, setLoading] = useState(false);
  const [movements, setMovements] = useState([]);
  const [sectionItems, setSectionItems] = useState([]);
  const [itemCostMap, setItemCostMap] = useState(new Map());
  const [previewFilter, setPreviewFilter] = useState("all"); // "all" | "created_today"

  // WhatsApp form
  const [whatsappPhone, setWhatsappPhone] = useState("");
  const [copiedWa, setCopiedWa] = useState(false);

  // Email form
  const [recipientEmail, setRecipientEmail] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailCc, setEmailCc] = useState("");
  const [copiedEmail, setCopiedEmail] = useState(false);

  useEffect(() => {
    if (open) {
      if (initialDate) setSelectedDate(initialDate);
      if (warehouseId) setSelectedWarehouse(warehouseId);
      setActiveTab("download");
      setCopiedWa(false);
      setCopiedEmail(false);
    }
  }, [open, initialDate, warehouseId]);

  const activeWarehouseObj = useMemo(() => {
    if (!selectedWarehouse) return null;
    return warehouses.find((w) => String(w.id) === String(selectedWarehouse)) || null;
  }, [selectedWarehouse, warehouses]);

  const activeWarehouseName = activeWarehouseObj ? activeWarehouseObj.name : "All Warehouses";

  // Fetch data specifically for this subsection (Raw Materials / Finished Goods / Inventory)
  const fetchData = useCallback(async () => {
    if (!selectedDate) return;
    setLoading(true);
    try {
      const params = {
        date_from: selectedDate,
        date_to: selectedDate,
      };
      if (selectedWarehouse) {
        params.warehouse_id = Number(selectedWarehouse);
      }

      // Fetch items specifically for the subsection
      let itemsPromise;
      if (itemType === "raw_material") {
        itemsPromise = getRawMaterials();
      } else if (itemType === "finished_good") {
        itemsPromise = getFinishedGoods();
      } else {
        itemsPromise = getInventoryDashboard();
      }

      const [histRes, ledRes, itemsRes] = await Promise.allSettled([
        getStoreInventoryHistory(params),
        getStockLedger(),
        itemsPromise,
      ]);

      const itemsList = itemsRes.status === "fulfilled" ? asArray(itemsRes.value?.data) : [];
      setSectionItems(itemsList);

      const sectionItemIds = new Set(itemsList.map((i) => i.id).filter(Boolean));
      const sectionItemNames = new Set(itemsList.map((i) => String(i.name || "").toLowerCase()).filter(Boolean));

      const costMap = new Map();
      itemsList.forEach((it) => {
        if (it.name) costMap.set(String(it.name).toLowerCase(), Number(it.unit_cost || it.average_cost || 0));
      });
      setItemCostMap(costMap);

      let rawMovements = [];
      if (histRes.status === "fulfilled" && Array.isArray(histRes.value?.data) && histRes.value.data.length > 0) {
        rawMovements = histRes.value.data;
      } else if (ledRes.status === "fulfilled" && Array.isArray(ledRes.value?.data)) {
        // Fallback to stock ledger
        rawMovements = ledRes.value.data
          .filter((r) => String(r.date || "").slice(0, 10) === selectedDate)
          .map((r) => ({
            id: r.id,
            date: r.date,
            transaction: r.transaction || (Number(r.qty_in) ? "in" : "out"),
            product: r.item_name || "—",
            item_id: r.item_id,
            quantity: Number(r.qty_in) || Number(r.qty_out) || r.quantity || 0,
            qty_in: Number(r.qty_in) || 0,
            qty_out: Number(r.qty_out) || 0,
            user: r.created_by || r.user || "System",
            warehouse: r.warehouse_name || "Main Warehouse",
            reference: r.reference || "—",
          }));
      }

      // Filter movements by subsection (Raw Materials / Finished Goods) if itemType is specified
      let filteredMovements = rawMovements;
      if (itemType && (sectionItemIds.size > 0 || sectionItemNames.size > 0)) {
        filteredMovements = rawMovements.filter((m) => {
          if (m.item_id && sectionItemIds.has(m.item_id)) return true;
          if (m.product && sectionItemNames.has(String(m.product).toLowerCase())) return true;
          return false;
        });
      }

      // Filter by warehouse if warehouse is selected
      if (selectedWarehouse) {
        filteredMovements = filteredMovements.filter((m) => {
          if (m.warehouse_id) return String(m.warehouse_id) === String(selectedWarehouse);
          if (activeWarehouseName && m.warehouse) return m.warehouse === activeWarehouseName;
          return true;
        });
      }

      setMovements(filteredMovements);
    } catch {
      addToast(`Could not load ${sectionTitle} records`, "error");
    } finally {
      setLoading(false);
    }
  }, [selectedDate, selectedWarehouse, itemType, sectionTitle, activeWarehouseName, addToast]);

  useEffect(() => {
    if (open) {
      fetchData();
    }
  }, [open, fetchData]);

  // Filter items specifically created on this date vs general
  const itemsCreatedOnDate = useMemo(() => {
    return sectionItems.filter((i) => {
      const cDate = String(i.created_at || i.created_date || i.date || "").slice(0, 10);
      return cDate === selectedDate;
    });
  }, [sectionItems, selectedDate]);

  // Aggregate metrics for that date
  const metrics = useMemo(() => {
    let stockInQty = 0;
    let stockInVal = 0;
    let stockOutQty = 0;
    let stockOutVal = 0;
    let returnAdjustCount = 0;

    movements.forEach((m) => {
      const type = String(m.transaction || "").toLowerCase();
      const q = Number(m.quantity || 0);
      const unitCost = itemCostMap.get(String(m.product || "").toLowerCase()) || 0;

      if (type.includes("in") || type === "purchase" || type === "production" || Number(m.qty_in) > 0) {
        const inQ = Number(m.qty_in) || q;
        stockInQty += inQ;
        stockInVal += inQ * unitCost;
      } else if (type.includes("out") || type.includes("issue") || type === "sales" || type === "scrap" || Number(m.qty_out) > 0) {
        const outQ = Number(m.qty_out) || q;
        stockOutQty += outQ;
        stockOutVal += outQ * unitCost;
      } else {
        returnAdjustCount += 1;
      }
    });

    const totalStockValue = sectionItems.reduce((acc, i) => {
      const q = Number(i.quantity ?? i.total_quantity ?? 0);
      const c = Number(i.unit_cost ?? i.average_cost ?? 0);
      return acc + (i.stock_value != null ? Number(i.stock_value) : q * c);
    }, 0);

    return {
      totalCount: movements.length,
      stockInQty,
      stockInVal,
      stockOutQty,
      stockOutVal,
      returnAdjustCount,
      totalSectionItems: sectionItems.length,
      itemsCreatedCount: itemsCreatedOnDate.length,
      totalStockValue,
    };
  }, [movements, itemCostMap, sectionItems, itemsCreatedOnDate]);

  // Update default Email Subject
  useEffect(() => {
    const formatted = formatReadableDate(selectedDate);
    setEmailSubject(`Insights Iva — ${sectionTitle} Report (${formatted})`);
  }, [selectedDate, sectionTitle]);

  // Formatted text for WhatsApp
  const whatsAppText = useMemo(() => {
    const formatted = formatReadableDate(selectedDate);
    const lines = [
      `📦 *Insights Iva — ${sectionTitle} Report*`,
      `📅 *Date:* ${formatted}`,
      `🏢 *Warehouse:* ${activeWarehouseName}`,
      `🏷️ *${sectionTitle} Catalog:* ${metrics.totalSectionItems} items (${formatInr(metrics.totalStockValue)})`,
      ``,
      `📊 *Activity on ${formatted}:*`,
      `• *Total Movements:* ${metrics.totalCount}`,
      `• *Stock In:* ${formatQty(metrics.stockInQty)} units ${metrics.stockInVal > 0 ? `(${formatInr(metrics.stockInVal)})` : ""}`,
      `• *Stock Out / Issued:* ${formatQty(metrics.stockOutQty)} units ${metrics.stockOutVal > 0 ? `(${formatInr(metrics.stockOutVal)})` : ""}`,
      `• *New Items Created:* ${metrics.itemsCreatedCount}`,
      ``,
    ];

    if (itemsCreatedOnDate.length > 0) {
      lines.push(`✨ *Items Created on ${formatted} (${itemsCreatedOnDate.length}):*`);
      itemsCreatedOnDate.slice(0, 5).forEach((it) => {
        lines.push(`• ${it.name} (${it.sku || "N/A"}) — ${formatQty(it.quantity ?? 0)} ${it.unit || ""}`);
      });
      lines.push(``);
    }

    if (movements.length > 0) {
      lines.push(`📋 *Movement Transactions (${Math.min(movements.length, 5)} of ${movements.length}):*`);
      movements.slice(0, 5).forEach((m) => {
        const txn = String(m.transaction || "").replace(/_/g, " ").toUpperCase();
        lines.push(`• [${txn}] ${m.product}: ${formatQty(m.quantity)} qty (${m.warehouse || activeWarehouseName})`);
      });
    } else if (itemsCreatedOnDate.length === 0) {
      lines.push(`ℹ️ _No transactions or items created on this date._`);
    }

    lines.push(``);
    lines.push(`— Generated via Insights Iva Cloud`);
    return lines.join("\n");
  }, [selectedDate, activeWarehouseName, sectionTitle, metrics, movements, itemsCreatedOnDate]);

  // Clean, concise email body formatted for reliable mailto opening
  const emailBodyText = useMemo(() => {
    const formatted = formatReadableDate(selectedDate);
    const lines = [
      `Dear Team,`,
      ``,
      `Please find the ${sectionTitle} daily report summary for ${formatted} (${activeWarehouseName}):`,
      ``,
      `==============================================`,
      `${sectionTitle.toUpperCase()} SUMMARY: ${formatted}`,
      `==============================================`,
      `• Date: ${formatted} (${selectedDate})`,
      `• Warehouse: ${activeWarehouseName}`,
      `• Total Items in Catalog: ${metrics.totalSectionItems}`,
      `• Catalog Valuation: ${formatInr(metrics.totalStockValue)}`,
      `• Date Movements: ${metrics.totalCount} transactions`,
      `• Stock In: ${formatQty(metrics.stockInQty)} units (${formatInr(metrics.stockInVal)})`,
      `• Material Issued: ${formatQty(metrics.stockOutQty)} units (${formatInr(metrics.stockOutVal)})`,
      `• New Items Created on Date: ${metrics.itemsCreatedCount}`,
      ``,
    ];

    if (itemsCreatedOnDate.length > 0) {
      lines.push(`ITEMS CREATED ON THIS DATE:`);
      itemsCreatedOnDate.slice(0, 6).forEach((it, idx) => {
        lines.push(`${idx + 1}. ${it.name} | SKU: ${it.sku || "—"} | Qty: ${it.quantity ?? 0} ${it.unit || ""}`);
      });
      lines.push(``);
    }

    if (movements.length > 0) {
      lines.push(`RECENT MOVEMENTS:`);
      movements.slice(0, 6).forEach((m, idx) => {
        lines.push(`${idx + 1}. [${String(m.transaction || "").toUpperCase()}] ${m.product} | Qty: ${m.quantity} | WH: ${m.warehouse || activeWarehouseName}`);
      });
      lines.push(``);
    }

    lines.push(`==============================================`);
    lines.push(`Generated from Insights Iva ERP System`);
    return lines.join("\n");
  }, [selectedDate, activeWarehouseName, sectionTitle, metrics, movements, itemsCreatedOnDate]);

  // Export handlers
  const handleDownloadExcel = () => {
    const formatted = formatReadableDate(selectedDate);
    const filePrefix = sectionTitle.replace(/\s+/g, "_");

    const wb = XLSX.utils.book_new();

    // ── Sheet 1: All Items in Catalog ──────────────────────────────────────
    const allItemHeaders = [
      "ID",
      "Item Name",
      "SKU / Code",
      "Category",
      "Warehouse",
      "Current Stock",
      "Available Qty",
      "Reserved Qty",
      "Unit",
      "Unit Cost (INR)",
      "Stock Value (INR)",
      "Status",
      "Created Date",
    ];

    const allItemRows = sectionItems.map((i) => [
      i.id || "—",
      i.name || "—",
      i.sku || "—",
      i.category || "General",
      i.warehouse_name || activeWarehouseName,
      Number(i.quantity ?? i.total_quantity ?? 0),
      Number(i.available ?? i.quantity ?? 0),
      Number(i.reserved ?? 0),
      i.unit || "units",
      Number(i.unit_cost || 0),
      Number(i.stock_value || (Number(i.quantity || 0) * Number(i.unit_cost || 0))),
      i.status || "available",
      i.created_at ? i.created_at.slice(0, 10) : "—",
    ]);

    const wsAllItems = XLSX.utils.aoa_to_sheet([allItemHeaders, ...allItemRows]);

    // Set column widths for better readability
    wsAllItems["!cols"] = [
      { wch: 8 },   // ID
      { wch: 30 },  // Item Name
      { wch: 18 },  // SKU
      { wch: 18 },  // Category
      { wch: 20 },  // Warehouse
      { wch: 14 },  // Current Stock
      { wch: 14 },  // Available
      { wch: 14 },  // Reserved
      { wch: 8 },   // Unit
      { wch: 16 },  // Unit Cost
      { wch: 18 },  // Stock Value
      { wch: 12 },  // Status
      { wch: 14 },  // Created Date
    ];

    XLSX.utils.book_append_sheet(wb, wsAllItems, sectionTitle.slice(0, 28));

    // ── Sheet 2: Items Created on Selected Date ──────────────────────────
    if (itemsCreatedOnDate.length > 0) {
      const newItemHeaders = [
        "ID",
        "Item Name",
        "SKU / Code",
        "Category",
        "Warehouse",
        "Quantity",
        "Unit",
        "Unit Cost (INR)",
        "Stock Value (INR)",
        "Status",
        "Created Date",
      ];

      const newItemRows = itemsCreatedOnDate.map((i) => [
        i.id || "—",
        i.name || "—",
        i.sku || "—",
        i.category || "General",
        i.warehouse_name || activeWarehouseName,
        Number(i.quantity ?? i.total_quantity ?? 0),
        i.unit || "units",
        Number(i.unit_cost || 0),
        Number(i.stock_value || (Number(i.quantity || 0) * Number(i.unit_cost || 0))),
        i.status || "available",
        i.created_at ? i.created_at.slice(0, 10) : selectedDate,
      ]);

      const wsNewItems = XLSX.utils.aoa_to_sheet([newItemHeaders, ...newItemRows]);
      wsNewItems["!cols"] = [
        { wch: 8 }, { wch: 30 }, { wch: 18 }, { wch: 18 }, { wch: 20 },
        { wch: 12 }, { wch: 8 }, { wch: 16 }, { wch: 18 }, { wch: 12 }, { wch: 14 },
      ];
      XLSX.utils.book_append_sheet(wb, wsNewItems, "New on " + selectedDate);
    }

    // ── Sheet 3: Date Movements Log ──────────────────────────────────────
    if (movements.length > 0) {
      const movementHeaders = [
        "ID",
        "Date & Time",
        "Transaction Type",
        "Product / Item",
        "Quantity",
        "Qty In",
        "Qty Out",
        "Warehouse",
        "User",
        "Reference",
      ];

      const movementRows = movements.map((m) => [
        m.id || "—",
        m.date ? new Date(m.date).toLocaleString("en-IN") : selectedDate,
        String(m.transaction || "").replace(/_/g, " ").toUpperCase(),
        m.product || "—",
        Number(m.quantity || 0),
        Number(m.qty_in || 0),
        Number(m.qty_out || 0),
        m.warehouse || activeWarehouseName,
        m.user || "System",
        m.machine || m.reference || "—",
      ]);

      const wsMovements = XLSX.utils.aoa_to_sheet([movementHeaders, ...movementRows]);
      wsMovements["!cols"] = [
        { wch: 8 }, { wch: 22 }, { wch: 20 }, { wch: 30 },
        { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 20 }, { wch: 16 }, { wch: 18 },
      ];
      XLSX.utils.book_append_sheet(wb, wsMovements, "Movements " + selectedDate);
    }

    // ── Sheet 4: Summary ────────────────────────────────────────────────
    const summaryData = [
      ["Field", "Value"],
      ["Report", sectionTitle],
      ["Report Date", selectedDate],
      ["Formatted Date", formatted],
      ["Warehouse", activeWarehouseName],
      ["Total Items in Catalog", metrics.totalSectionItems],
      ["Items Created on Date", metrics.itemsCreatedCount],
      ["Total Movements", metrics.totalCount],
      ["Stock In Qty", metrics.stockInQty],
      ["Stock Out Qty", metrics.stockOutQty],
      ["Total Stock Value (INR)", metrics.totalStockValue],
      ["Generated At", new Date().toLocaleString("en-IN")],
    ];

    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
    wsSummary["!cols"] = [{ wch: 28 }, { wch: 24 }];
    XLSX.utils.book_append_sheet(wb, wsSummary, "Summary");

    XLSX.writeFile(wb, `${filePrefix}_Report_${selectedDate}.xlsx`);
    addToast(`${sectionTitle} Excel report downloaded`, "success");
  };

  // ── Shared PDF builder ────────────────────────────────────────────────────
  const buildPdfDoc = useCallback(() => {
    const doc = new jsPDF();
    const formatted = formatReadableDate(selectedDate);

    // Header
    doc.setFillColor(22, 101, 52);
    doc.rect(0, 0, 210, 28, "F");
    doc.setFontSize(15);
    doc.setTextColor(255, 255, 255);
    doc.text(`Insights Iva — ${sectionTitle} Report`, 14, 14);
    doc.setFontSize(9);
    doc.setTextColor(240, 253, 244);
    doc.text(`Date: ${formatted} (${selectedDate}) | Warehouse: ${activeWarehouseName}`, 14, 22);

    let currentY = 36;

    // Movement Table
    if (movements.length > 0) {
      doc.setFontSize(11);
      doc.setTextColor(30, 30, 40);
      doc.text("Activity / Movements on Date", 14, currentY);
      const moveHeaders = ["#", "Time", "Transaction", "Product", "Qty", "Warehouse", "User"];
      const moveRows = movements.map((m, i) => [
        String(i + 1),
        m.date ? new Date(m.date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—",
        String(m.transaction || "").replace(/_/g, " ").toUpperCase(),
        m.product || "—",
        formatQty(m.quantity),
        m.warehouse || activeWarehouseName,
        m.user || "System",
      ]);
      autoTable(doc, {
        head: [moveHeaders],
        body: moveRows,
        startY: currentY + 4,
        styles: { fontSize: 8, cellPadding: 2.5 },
        headStyles: { fillColor: [22, 101, 52], textColor: [255, 255, 255] },
        alternateRowStyles: { fillColor: [240, 253, 244] },
      });
      currentY = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + 10 : currentY + 30;
    }

    // Items Created on Date Table
    if (itemsCreatedOnDate.length > 0) {
      doc.setFontSize(11);
      doc.setTextColor(30, 30, 40);
      doc.text(`Items Created on Date (${formatted})`, 14, currentY);
      const itemHeaders = ["#", "Item Name", "Category", "Quantity", "Unit", "Stock Value (Rs.)", "Status"];
      const itemRows = itemsCreatedOnDate.map((it, i) => [
        String(i + 1),
        it.name || "—",
        it.category || "General",
        formatQty(it.quantity ?? it.available ?? 0),
        it.unit || "",
        Number(it.stock_value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 }),
        it.status || "available",
      ]);
      autoTable(doc, {
        head: [itemHeaders],
        body: itemRows,
        startY: currentY + 4,
        styles: { fontSize: 8, cellPadding: 2.5 },
        headStyles: { fillColor: [5, 150, 105], textColor: [255, 255, 255] },
        alternateRowStyles: { fillColor: [240, 253, 244] },
      });
    } else if (movements.length === 0) {
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      doc.text(`No items or movements recorded for ${formatted} (${selectedDate}).`, 14, currentY + 6);
    }

    return doc;
  }, [selectedDate, sectionTitle, activeWarehouseName, movements, itemsCreatedOnDate]);

  const handleDownloadPdf = () => {
    const filePrefix = sectionTitle.replace(/\s+/g, "_");
    const doc = buildPdfDoc();
    doc.save(`${filePrefix}_Report_${selectedDate}.pdf`);
    try {
      const pdfBlobUrl = doc.output("bloburl");
      if (pdfBlobUrl) window.open(pdfBlobUrl, "_blank");
    } catch {
      /* ignore popup blocker */
    }
    addToast(`${sectionTitle} PDF report downloaded & opened for print`, "success");
  };

  const handleDownloadCsv = () => {
    const filePrefix = sectionTitle.replace(/\s+/g, "_");
    const escapeCsv = (val) => `"${String(val ?? "").replace(/"/g, '""')}"`;

    const headers = [
      "Type",
      "ID",
      "Name",
      "SKU",
      "Category",
      "Quantity",
      "Unit",
      "Unit Cost",
      "Stock Value",
      "Warehouse",
      "Status",
      "Date",
    ];

    const targetItems = itemsCreatedOnDate.length > 0 ? itemsCreatedOnDate : [];
    const itemRows = targetItems.map((i) => [
      "ITEM",
      i.id || "",
      i.name || "",
      i.sku || "",
      i.category || "",
      i.quantity ?? 0,
      i.unit || "",
      i.unit_cost || 0,
      i.stock_value || 0,
      i.warehouse_name || activeWarehouseName,
      i.status || "",
      i.created_at ? i.created_at.slice(0, 10) : selectedDate,
    ]);

    const movementRows = movements.map((m) => [
      "MOVEMENT",
      m.id || "",
      m.product || "",
      "",
      "",
      m.quantity || 0,
      "",
      "",
      "",
      m.warehouse || activeWarehouseName,
      m.transaction || "",
      m.date || selectedDate,
    ]);

    const allRows = [...itemRows, ...movementRows];
    const csvContent = [
      headers.map(escapeCsv).join(","),
      ...allRows.map((row) => row.map(escapeCsv).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${filePrefix}_Report_${selectedDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    addToast(`${sectionTitle} CSV report downloaded`, "success");
  };

  // ── WhatsApp share: share ONLY the PDF file ──
  const handleShareWhatsApp = async () => {
    const filePrefix = sectionTitle.replace(/\s+/g, "_");
    const fileName = `${filePrefix}_Report_${selectedDate}.pdf`;
    const doc = buildPdfDoc();
    const pdfBlob = doc.output("blob");
    const pdfFile = new File([pdfBlob], fileName, { type: "application/pdf" });

    // 1. If Web Share API supports file sharing, share the PDF file directly without text
    if (navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
      try {
        await navigator.share({
          files: [pdfFile],
          title: fileName,
        });
        addToast(`"${fileName}" sent to WhatsApp share`, "success");
        return;
      } catch (err) {
        if (err.name === "AbortError") {
          return; // User cancelled share sheet
        }
      }
    }

    // 2. Fallback: Download the PDF file directly and open WhatsApp
    doc.save(fileName);
    addToast(`"${fileName}" downloaded! Opening WhatsApp...`, "success");

    setTimeout(() => {
      const cleanedPhone = whatsappPhone.replace(/\D/g, "");
      const waUrl = cleanedPhone
        ? `https://web.whatsapp.com/send?phone=${cleanedPhone.startsWith("91") ? cleanedPhone : `91${cleanedPhone}`}`
        : `https://web.whatsapp.com/`;

      const win = window.open(waUrl, "_blank", "noopener,noreferrer");
      if (!win) {
        window.open(`https://wa.me/${cleanedPhone ? (cleanedPhone.startsWith("91") ? cleanedPhone : `91${cleanedPhone}`) : ""}`, "_blank", "noopener,noreferrer");
      }
    }, 300);
  };

  const handleCopyWhatsApp = () => {
    navigator.clipboard.writeText(whatsAppText);
    setCopiedWa(true);
    addToast("WhatsApp summary copied to clipboard", "success");
    setTimeout(() => setCopiedWa(false), 2500);
  };

  // Email Actions
  const handleCopyEmail = () => {
    navigator.clipboard.writeText(emailBodyText);
    setCopiedEmail(true);
    addToast("Email content copied to clipboard", "success");
    setTimeout(() => setCopiedEmail(false), 2500);
  };

  // ── Gmail / Email share: share PDF file directly ──
  const handleOpenGmail = async () => {
    const filePrefix = sectionTitle.replace(/\s+/g, "_");
    const fileName = `${filePrefix}_Report_${selectedDate}.pdf`;
    const doc = buildPdfDoc();
    const pdfBlob = doc.output("blob");
    const pdfFile = new File([pdfBlob], fileName, { type: "application/pdf" });

    // 1. If Web Share API is available, pass the PDF file directly (attaches file in Outlook / Mail / Gmail app)
    if (navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
      try {
        await navigator.share({
          files: [pdfFile],
          title: `Insights Iva — ${sectionTitle} Report (${formatReadableDate(selectedDate)})`,
        });
        addToast(`"${fileName}" sent to email share`, "success");
        return;
      } catch (err) {
        if (err.name === "AbortError") {
          return; // User cancelled share sheet
        }
      }
    }

    // 2. Web fallback: Download the PDF file directly and open Gmail compose
    doc.save(fileName);
    addToast(`"${fileName}" downloaded! Please attach the downloaded file to your email.`, "info");

    setTimeout(() => {
      const to = encodeURIComponent(recipientEmail.trim());
      const su = encodeURIComponent(emailSubject || `Insights Iva — ${sectionTitle} Report (${formatReadableDate(selectedDate)})`);
      const cc = emailCc.trim() ? encodeURIComponent(emailCc.trim()) : "";
      const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${to}&su=${su}${cc ? `&cc=${cc}` : ""}`;
      window.open(gmailUrl, "_blank", "noopener,noreferrer");
    }, 300);
  };

  const displayedPreviewItems = previewFilter === "created_today" ? itemsCreatedOnDate : sectionItems;

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-3 sm:p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <div
        className="relative flex flex-col max-h-[92vh] w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl border border-emerald-100 text-[var(--color-text,#1f2937)]"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-emerald-100 bg-emerald-50/50 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-[17px] font-bold tracking-tight text-emerald-950">
                  {sectionTitle} Date Activity & Export
                </h2>
                <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800">
                  {formatReadableDate(selectedDate)}
                </span>
              </div>
              <p className="text-[12px] text-emerald-700">
                Download reports or share data via WhatsApp and Email for {sectionTitle} on selected calendar date
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg border-0 bg-transparent text-emerald-800 hover:bg-emerald-100 hover:text-emerald-950 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body: Minimal Direct Action Icons & Buttons */}
        <div className="p-6">
          <p className="mb-4 text-[13px] text-slate-600">
            Select an action to export or share <strong className="text-slate-900">{sectionTitle}</strong> data for{" "}
            <span className="font-semibold text-slate-900">{formatReadableDate(selectedDate)}</span>:
          </p>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {/* 1. PDF / Print */}
            <button
              type="button"
              onClick={handleDownloadPdf}
              className="flex flex-col items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50/60 p-4 transition-all hover:bg-rose-100 hover:border-rose-300 hover:shadow-md cursor-pointer group"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-600 text-white shadow-sm group-hover:scale-105 transition-transform">
                <FileText className="h-6 w-6" />
              </div>
              <span className="text-[13px] font-bold text-rose-950">PDF / Print</span>
            </button>

            {/* 2. WhatsApp */}
            <button
              type="button"
              onClick={handleShareWhatsApp}
              className="flex flex-col items-center justify-center gap-2 rounded-xl border border-[#25D366]/30 bg-emerald-50/60 p-4 transition-all hover:bg-emerald-100 hover:border-[#25D366]/60 hover:shadow-md cursor-pointer group"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#25D366] text-white shadow-sm group-hover:scale-105 transition-transform">
                <WhatsAppIcon className="h-6 w-6" />
              </div>
              <span className="text-[13px] font-bold text-emerald-950">WhatsApp</span>
            </button>

            {/* 3. Email / Gmail */}
            <button
              type="button"
              onClick={handleOpenGmail}
              className="flex flex-col items-center justify-center gap-2 rounded-xl border border-sky-200 bg-sky-50/60 p-4 transition-all hover:bg-sky-100 hover:border-sky-300 hover:shadow-md cursor-pointer group"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-sky-600 text-white shadow-sm group-hover:scale-105 transition-transform">
                <Mail className="h-6 w-6" />
              </div>
              <span className="text-[13px] font-bold text-sky-950">Gmail / Email</span>
            </button>

            {/* 4. Excel Spreadsheet */}
            <button
              type="button"
              onClick={handleDownloadExcel}
              className="flex flex-col items-center justify-center gap-2 rounded-xl border border-teal-200 bg-teal-50/60 p-4 transition-all hover:bg-teal-100 hover:border-teal-300 hover:shadow-md cursor-pointer group"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-600 text-white shadow-sm group-hover:scale-105 transition-transform">
                <FileSpreadsheet className="h-6 w-6" />
              </div>
              <span className="text-[13px] font-bold text-teal-950">Excel (.xlsx)</span>
            </button>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-3.5">
          <div className="flex items-center gap-2 text-[12px] text-slate-600">
            <span>Selected date: <strong className="text-slate-900">{selectedDate}</strong></span>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
