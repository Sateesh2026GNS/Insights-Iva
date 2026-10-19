import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  CheckCircle2,
  FileSpreadsheet,
  Package,
  Printer,
  Scale,
  ShieldCheck,
} from "lucide-react";

import Loader from "../../components/common/Loader";
import Button from "../../components/common/Button";
import { useToast } from "../../context/ToastContext";
import {
  addExportPackingCarton,
  createPackingListFromDispatch,
  deleteExportPackingCarton,
  getDispatchOptionsForPacking,
  getExportPackingDashboard,
  updateExportPackingCarton,
  updateExportPackingList,
  validateExportPackingList,
} from "../../api/exportPackingApi";
import { exportToExcel, exportToPdf } from "../../utils/exportUtils";
import "../../styles/export-packing-list.css";

const CHART_COLORS = ["#2563eb", "#ea580c", "#16a34a", "#7c3aed", "#dc2626", "#0d9488"];

const FOOTER_TABS = [
  { id: "dashboard", label: "Dashboard" },
  { id: "packing_list", label: "Packing List" },
  { id: "item_master", label: "Item Master" },
  { id: "shipment", label: "Shipment Details" },
  { id: "checklist", label: "Document Checklist" },
  { id: "settings", label: "Settings" },
];

function fmtKg(n) {
  return `${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg`;
}

function statusPill(status) {
  const key = String(status || "").toLowerCase();
  const tone =
    key === "completed" || key === "dispatched" ? "success" : key === "in_progress" ? "info" : "pending";
  return <span className={`epl-pill epl-pill--${tone}`}>{status || "—"}</span>;
}

export default function ExportPackingListGenerator() {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [validating, setValidating] = useState(false);
  const [packingListId, setPackingListId] = useState(null);
  const [dispatchOptions, setDispatchOptions] = useState([]);
  const [shipmentForm, setShipmentForm] = useState({});
  const [settingsForm, setSettingsForm] = useState({});
  const [checklist, setChecklist] = useState([]);
  const [newCarton, setNewCarton] = useState({
    carton_no: "",
    sku_code: "",
    item_description: "",
    qty_pcs: "",
  });
  const [saving, setSaving] = useState(false);
  const [editingCartonId, setEditingCartonId] = useState(null);
  const [editCartonForm, setEditCartonForm] = useState({});

  const syncFormsFromPackingList = useCallback((res) => {
    if (res.packing_list?.id) {
      setPackingListId(res.packing_list.id);
      setShipmentForm({
        destination: res.packing_list.destination || "",
        container_no: res.packing_list.container_no || "",
        shipment_no: res.packing_list.shipment_no || "",
        dispatch_date: res.packing_list.dispatch_date || "",
        remarks: res.packing_list.remarks || "",
        prepared_by_name: res.packing_list.prepared_by_name || "",
      });
      setSettingsForm({
        status: res.packing_list.status || "draft",
        cartons_planned: res.packing_list.cartons_planned ?? 0,
        cartons_prepared: res.packing_list.cartons_prepared ?? 0,
        gross_weight_kg: res.packing_list.gross_weight_kg ?? "",
        net_weight_kg: res.packing_list.net_weight_kg ?? "",
      });
    }
    setChecklist(res.document_checklist || []);
  }, []);

  const load = useCallback(async (id, { seedDemo = false } = {}) => {
      setLoading(true);
      try {
        const res = await getExportPackingDashboard(id ?? null, { seedDemo });
        setData(res);
        syncFormsFromPackingList(res);
      } catch {
        addToast("Could not load export packing list.", "error");
        setData(null);
      } finally {
        setLoading(false);
      }
    }, [addToast, syncFormsFromPackingList]);

  const loadDemonstrationData = async () => {
    setSaving(true);
    try {
      await load(null, { seedDemo: true });
      addToast("Demonstration packing list loaded.", "success");
      setActiveTab("dashboard");
    } catch {
      addToast("Could not load demonstration data.", "error");
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    getDispatchOptionsForPacking()
      .then((rows) => setDispatchOptions(Array.isArray(rows) ? rows : []))
      .catch(() => setDispatchOptions([]));
  }, []);

  const pl = data?.packing_list;
  const kpis = data?.kpis;

  const applyDashboard = (res) => {
    setData(res);
    syncFormsFromPackingList(res);
  };

  const linkDispatch = async (dispatchId) => {
    if (!dispatchId) return;
    setSaving(true);
    try {
      const res = await createPackingListFromDispatch(Number(dispatchId));
      applyDashboard(res);
      addToast("Packing list created from dispatch.", "success");
      setActiveTab("dashboard");
    } catch {
      addToast("Could not link dispatch shipment.", "error");
    } finally {
      setSaving(false);
    }
  };

  const saveShipmentDetails = async () => {
    if (!pl?.id) return;
    setSaving(true);
    try {
      const res = await updateExportPackingList(pl.id, shipmentForm);
      applyDashboard(res);
      addToast("Shipment details saved.", "success");
    } catch {
      addToast("Save failed.", "error");
    } finally {
      setSaving(false);
    }
  };

  const saveSettings = async () => {
    if (!pl?.id) return;
    setSaving(true);
    try {
      const res = await updateExportPackingList(pl.id, {
        ...settingsForm,
        gross_weight_kg: settingsForm.gross_weight_kg === "" ? null : Number(settingsForm.gross_weight_kg),
        net_weight_kg: settingsForm.net_weight_kg === "" ? null : Number(settingsForm.net_weight_kg),
        cartons_planned: Number(settingsForm.cartons_planned) || 0,
        cartons_prepared: Number(settingsForm.cartons_prepared) || 0,
      });
      applyDashboard(res);
      addToast("Settings saved.", "success");
    } catch {
      addToast("Save failed.", "error");
    } finally {
      setSaving(false);
    }
  };

  const saveChecklist = async () => {
    if (!pl?.id) return;
    setSaving(true);
    try {
      const res = await updateExportPackingList(pl.id, { document_checklist: checklist });
      applyDashboard(res);
      addToast("Document checklist saved.", "success");
    } catch {
      addToast("Save failed.", "error");
    } finally {
      setSaving(false);
    }
  };

  const startEditCarton = (row) => {
    setEditingCartonId(row.id);
    setEditCartonForm({
      carton_no: row.carton_no || "",
      sku_code: row.sku_code || "",
      item_description: row.item_description || "",
      qty_pcs: row.qty_pcs ?? "",
    });
  };

  const cancelEditCarton = () => {
    setEditingCartonId(null);
    setEditCartonForm({});
  };

  const saveEditCarton = async () => {
    if (!editingCartonId) return;
    setSaving(true);
    try {
      const res = await updateExportPackingCarton(editingCartonId, {
        ...editCartonForm,
        qty_pcs: Number(editCartonForm.qty_pcs) || 0,
      });
      applyDashboard(res);
      cancelEditCarton();
      addToast("Carton updated.", "success");
    } catch {
      addToast("Could not update carton.", "error");
    } finally {
      setSaving(false);
    }
  };

  const removeCarton = async (cartonId) => {
    if (!cartonId || !pl?.id) return;
    setSaving(true);
    try {
      await deleteExportPackingCarton(cartonId);
      await load(pl.id);
      addToast("Carton removed.", "success");
    } catch {
      addToast("Could not delete carton.", "error");
    } finally {
      setSaving(false);
    }
  };

  const submitNewCarton = async (e) => {
    e.preventDefault();
    if (!pl?.id || !newCarton.carton_no || !newCarton.item_description) {
      addToast("Carton no. and item description are required.", "warning");
      return;
    }
    setSaving(true);
    try {
      await addExportPackingCarton(pl.id, {
        ...newCarton,
        qty_pcs: Number(newCarton.qty_pcs) || 0,
      });
      await load(pl.id);
      setNewCarton({ carton_no: "", sku_code: "", item_description: "", qty_pcs: "" });
      addToast("Carton added.", "success");
    } catch {
      addToast("Could not add carton.", "error");
    } finally {
      setSaving(false);
    }
  };

  const exportCartonsPdf = async () => {
    const rows = data?.cartons || [];
    if (!rows.length) {
      addToast("No carton rows to export.", "warning");
      return;
    }
    await exportToPdf(
      rows,
      [
        { key: "carton_no", label: "Carton No." },
        { key: "sku_code", label: "SKU" },
        { key: "item_description", label: "Description" },
        { key: "qty_pcs", label: "Qty" },
        { key: "gross_weight_kg", label: "Gross kg" },
      ],
      `Export Packing List — ${pl?.packing_list_no || ""}`,
      `packing-list-${pl?.packing_list_no || "export"}`
    );
    addToast("PDF export started.", "success");
  };

  const exportCartons = () => {
    const rows = data?.cartons || [];
    if (!rows.length) {
      addToast("No carton rows to export.", "warning");
      return;
    }
    exportToExcel(
      rows,
      [
        { key: "carton_no", label: "Carton No." },
        { key: "sku_code", label: "SKU Code" },
        { key: "item_description", label: "Item Description" },
        { key: "qty_pcs", label: "Qty (Pcs)" },
        { key: "net_weight_kg", label: "Net Weight (kg)" },
        { key: "gross_weight_kg", label: "Gross Weight (kg)" },
        { key: "dimensions", label: "Dimensions (cm)" },
        { key: "marks_numbers", label: "Marks and Numbers" },
      ],
      `packing-list-${pl?.packing_list_no || "export"}`
    );
    addToast("Exported carton list to Excel.", "success");
  };

  const handleValidate = async () => {
    if (!pl?.id) return;
    setValidating(true);
    try {
      const res = await validateExportPackingList(pl.id);
      if (res.ok) addToast("Totals validated successfully.", "success");
      else addToast(res.messages?.[0] || "Validation reported issues.", "warning");
    } catch {
      addToast("Validation failed.", "error");
    } finally {
      setValidating(false);
    }
  };

  const cartonProgress = useMemo(() => {
    if (!kpis?.cartons_planned) return 100;
    return Math.min(100, Math.round((100 * (kpis.cartons_prepared || 0)) / kpis.cartons_planned));
  }, [kpis]);

  if (loading) {
    return (
      <div className="epl-page">
        <Loader label="Loading export packing list…" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="epl-page ui-page">
        <p className="text-sm text-[var(--color-text-secondary)]">No packing list data available.</p>
        <Button type="button" variant="primary" onClick={() => load()}>Retry</Button>
      </div>
    );
  }

  const showCartonActions = activeTab === "packing_list";

  const cartonTable = (
    <div className="epl-table-wrap">
      <table className="epl-table">
        <thead>
          <tr>
            <th>S.No.</th>
            <th>Carton No.</th>
            <th>SKU Code</th>
            <th>Item Description</th>
            <th>Qty (Pcs)</th>
            <th>Net Wt (kg)</th>
            <th>Gross Wt (kg)</th>
            <th>Dimensions (cm)</th>
            <th>Marks &amp; Numbers</th>
            {showCartonActions ? <th aria-label="Actions" /> : null}
          </tr>
        </thead>
        <tbody>
          {(data.cartons || []).map((row, idx) => {
            const editing = showCartonActions && editingCartonId === row.id;
            return (
              <tr key={row.id || row.carton_no}>
                <td>{idx + 1}</td>
                <td>
                  {editing ? (
                    <input
                      className="epl-input"
                      value={editCartonForm.carton_no}
                      onChange={(e) => setEditCartonForm((s) => ({ ...s, carton_no: e.target.value }))}
                    />
                  ) : (
                    row.carton_no
                  )}
                </td>
                <td>
                  {editing ? (
                    <input
                      className="epl-input"
                      value={editCartonForm.sku_code}
                      onChange={(e) => setEditCartonForm((s) => ({ ...s, sku_code: e.target.value }))}
                    />
                  ) : (
                    row.sku_code || "—"
                  )}
                </td>
                <td>
                  {editing ? (
                    <input
                      className="epl-input"
                      value={editCartonForm.item_description}
                      onChange={(e) => setEditCartonForm((s) => ({ ...s, item_description: e.target.value }))}
                    />
                  ) : (
                    row.item_description
                  )}
                </td>
                <td className="tabular-nums">
                  {editing ? (
                    <input
                      className="epl-input"
                      type="number"
                      value={editCartonForm.qty_pcs}
                      onChange={(e) => setEditCartonForm((s) => ({ ...s, qty_pcs: e.target.value }))}
                    />
                  ) : (
                    row.qty_pcs
                  )}
                </td>
                <td className="tabular-nums">{row.net_weight_kg}</td>
                <td className="tabular-nums">{row.gross_weight_kg}</td>
                <td>{row.dimensions}</td>
                <td>{row.marks_numbers || "—"}</td>
                {showCartonActions ? (
                  <td className="whitespace-nowrap">
                    {editing ? (
                      <>
                        <Button type="button" variant="primary" size="sm" disabled={saving} onClick={saveEditCarton}>
                          Save
                        </Button>
                        <Button type="button" variant="ghost" size="sm" disabled={saving} onClick={cancelEditCarton}>
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button type="button" variant="secondary" size="sm" disabled={saving} onClick={() => startEditCarton(row)}>
                          Edit
                        </Button>
                        <Button type="button" variant="ghost" size="sm" disabled={saving} onClick={() => removeCarton(row.id)}>
                          Delete
                        </Button>
                      </>
                    )}
                  </td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="epl-page ui-page space-y-4">
      <header className="epl-hero">
        <div>
          <p className="epl-hero__eyebrow">Import &amp; Export Costing, Documentation &amp; Shipment Control Toolkit</p>
          <h1 className="epl-hero__title">Export Packing List Generator</h1>
          <p className="epl-hero__sub">
            Organize cartons, track quantities, and review weights for export shipments.
          </p>
        </div>
        {pl ? (
          <dl className="epl-shipment-meta">
            <div><dt>Shipment No</dt><dd>{pl.shipment_no}</dd></div>
            <div><dt>Destination</dt><dd>{pl.destination || "—"}</dd></div>
            <div><dt>Container No</dt><dd>{pl.container_no || "—"}</dd></div>
            <div><dt>Gross Weight</dt><dd>{fmtKg(pl.gross_weight_kg)}</dd></div>
            <div><dt>Net Weight</dt><dd>{fmtKg(pl.net_weight_kg)}</dd></div>
            <div><dt>Dispatch Date</dt><dd>{pl.dispatch_date || "—"}</dd></div>
          </dl>
        ) : null}
      </header>

      {!pl ? (
        <section className="epl-panel space-y-3">
          <p className="text-sm text-[var(--color-text-secondary)]">
            No packing list yet. Link a dispatch shipment to start, or load sample data for training and demos only.
          </p>
          <Button type="button" variant="secondary" disabled={saving} onClick={loadDemonstrationData}>
            Load demonstration data
          </Button>
          <label className="block text-sm font-medium">
            Link dispatch shipment
            <select
              className="mt-1 w-full max-w-md rounded-lg border border-[var(--color-border)] px-3 py-2"
              defaultValue=""
              onChange={(e) => linkDispatch(e.target.value)}
              disabled={saving}
            >
              <option value="">Select dispatch…</option>
              {dispatchOptions.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.dispatch_number} — {d.dispatch_date || "no date"}
                </option>
              ))}
            </select>
          </label>
        </section>
      ) : null}

      {pl && activeTab === "dashboard" ? (
        <>
          <section className="epl-kpi-grid">
            <article className="epl-kpi-card">
              <Package className="epl-kpi-card__icon" />
              <div>
                <div className="epl-kpi-card__value">{kpis?.total_packages ?? 0}</div>
                <div className="epl-kpi-card__label">Total Packages</div>
                <div className="epl-kpi-card__meta">Cartons / Packages</div>
              </div>
            </article>
            <article className="epl-kpi-card">
              <div className="epl-kpi-card__value">{kpis?.total_skus ?? 0}</div>
              <div className="epl-kpi-card__label">Total SKUs</div>
              <div className="epl-kpi-card__meta">Unique items</div>
            </article>
            <article className="epl-kpi-card">
              <Scale className="epl-kpi-card__icon" />
              <div>
                <div className="epl-kpi-card__value">{fmtKg(kpis?.gross_weight_kg)}</div>
                <div className="epl-kpi-card__label">Gross Weight</div>
              </div>
            </article>
            <article className="epl-kpi-card">
              <div className="epl-kpi-card__value">{fmtKg(kpis?.net_weight_kg)}</div>
              <div className="epl-kpi-card__label">Net Weight</div>
            </article>
            <article className="epl-kpi-card">
              <div className="epl-kpi-card__value">
                {kpis?.cartons_prepared ?? 0} <span className="text-base font-normal">of {kpis?.cartons_planned ?? 0}</span>
              </div>
              <div className="epl-kpi-card__label">Cartons Prepared</div>
              <div className="epl-progress" aria-hidden>
                <span style={{ width: `${cartonProgress}%` }} />
              </div>
            </article>
            <article className="epl-kpi-card epl-kpi-card--status">
              <CheckCircle2 className="epl-kpi-card__icon text-emerald-600" />
              <div>
                <div className="epl-kpi-card__label">Packing Status</div>
                {statusPill(kpis?.packing_status)}
              </div>
            </article>
          </section>

          <div className="epl-grid-main">
            <section className="epl-panel epl-panel--wide">
              <h2 className="epl-panel__title">Carton-wise Packing List</h2>
              {cartonTable}
            </section>

            <section className="epl-panel">
              <h2 className="epl-panel__title">Weight Summary</h2>
              <table className="epl-table epl-table--compact">
                <thead>
                  <tr>
                    <th>Component</th>
                    <th>Weight (kg)</th>
                    <th>% of Gross</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.weight_summary || []).map((row) => (
                    <tr key={row.label}>
                      <td>{row.label}</td>
                      <td className="tabular-nums">{row.weight_kg}</td>
                      <td className="tabular-nums">{row.pct_of_gross}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section className="epl-panel">
              <h2 className="epl-panel__title">Package Type Distribution</h2>
              <div className="epl-chart">
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={data.package_type_distribution || []} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80}>
                      {(data.package_type_distribution || []).map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="epl-panel">
              <h2 className="epl-panel__title">SKU Quantity Summary</h2>
              <div className="epl-chart">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={data.sku_quantity_summary || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="sku" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="qty" fill="#2563eb" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
          </div>

          <div className="epl-grid-bottom">
            <section className="epl-panel">
              <h2 className="epl-panel__title">Recent Packing Lists</h2>
              <table className="epl-table epl-table--compact">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Packing List No.</th>
                    <th>Shipment No.</th>
                    <th>Destination</th>
                    <th>Cartons</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.recent_packing_lists || []).map((row) => (
                    <tr
                      key={row.id}
                      className="cursor-pointer hover:bg-[var(--color-surface-muted)]"
                      onClick={() => load(row.id)}
                    >
                      <td>{row.date || "—"}</td>
                      <td>{row.packing_list_no}</td>
                      <td>{row.shipment_no}</td>
                      <td>{row.destination || "—"}</td>
                      <td>{row.cartons}</td>
                      <td>{statusPill(row.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section className="epl-panel">
              <h2 className="epl-panel__title">Shipment Remarks</h2>
              <p className="epl-remarks">{pl?.remarks || "—"}</p>
              <p className="epl-remarks-meta">
                Prepared by: <strong>{pl?.prepared_by_name || "—"}</strong>
                {pl?.dispatch_date ? ` · Date: ${pl.dispatch_date}` : null}
              </p>
            </section>

            <section className="epl-panel">
              <h2 className="epl-panel__title">Quick Actions</h2>
              <div className="epl-actions">
                <Button type="button" variant="secondary" onClick={() => window.print()}>
                  <Printer className="h-4 w-4" /> Print List
                </Button>
                <Button type="button" variant="secondary" onClick={exportCartons}>
                  <FileSpreadsheet className="h-4 w-4" /> Export Sheet
                </Button>
                <Button type="button" variant="secondary" onClick={exportCartonsPdf}>
                  <Printer className="h-4 w-4" /> Export PDF
                </Button>
                <Button type="button" variant="primary" disabled={validating} onClick={handleValidate}>
                  <ShieldCheck className="h-4 w-4" /> Validate Totals
                </Button>
              </div>
              <h3 className="epl-notes-title">Notes / Reminders</h3>
              <ul className="epl-notes">
                <li>Verify total carton count against the commercial invoice.</li>
                <li>Confirm gross weight matches the shipping bill.</li>
                <li>Take photos of loaded containers before seal.</li>
              </ul>
            </section>
          </div>
        </>
      ) : pl && activeTab === "packing_list" ? (
        <section className="epl-panel space-y-4">
          <h2 className="epl-panel__title">Packing List</h2>
          {cartonTable}
          <form className="epl-form-grid" onSubmit={submitNewCarton}>
            <input
              placeholder="Carton No."
              value={newCarton.carton_no}
              onChange={(e) => setNewCarton((s) => ({ ...s, carton_no: e.target.value }))}
              className="epl-input"
            />
            <input
              placeholder="SKU Code"
              value={newCarton.sku_code}
              onChange={(e) => setNewCarton((s) => ({ ...s, sku_code: e.target.value }))}
              className="epl-input"
            />
            <input
              placeholder="Item description"
              value={newCarton.item_description}
              onChange={(e) => setNewCarton((s) => ({ ...s, item_description: e.target.value }))}
              className="epl-input epl-input--wide"
            />
            <input
              placeholder="Qty"
              type="number"
              value={newCarton.qty_pcs}
              onChange={(e) => setNewCarton((s) => ({ ...s, qty_pcs: e.target.value }))}
              className="epl-input"
            />
            <Button type="submit" variant="primary" disabled={saving}>Add carton</Button>
          </form>
        </section>
      ) : pl && activeTab === "item_master" ? (
        <section className="epl-panel">
          <h2 className="epl-panel__title">Item Master (from cartons)</h2>
          <table className="epl-table">
            <thead>
              <tr>
                <th>SKU Code</th>
                <th>Description</th>
                <th>Total Qty</th>
                <th>Cartons</th>
              </tr>
            </thead>
            <tbody>
              {(data.item_master || []).map((row) => (
                <tr key={row.sku_code || row.item_description}>
                  <td>{row.sku_code || "—"}</td>
                  <td>{row.item_description}</td>
                  <td>{row.total_qty}</td>
                  <td>{row.carton_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : pl && activeTab === "shipment" ? (
        <section className="epl-panel space-y-3">
          <h2 className="epl-panel__title">Shipment Details</h2>
          <div className="epl-form-grid">
            {[
              ["shipment_no", "Shipment No."],
              ["destination", "Destination"],
              ["container_no", "Container No."],
              ["dispatch_date", "Dispatch Date"],
              ["prepared_by_name", "Prepared By"],
            ].map(([key, label]) => (
              <label key={key} className="text-sm">
                {label}
                <input
                  className="epl-input mt-1"
                  value={shipmentForm[key] || ""}
                  onChange={(e) => setShipmentForm((s) => ({ ...s, [key]: e.target.value }))}
                />
              </label>
            ))}
          </div>
          <label className="text-sm block">
            Remarks
            <textarea
              className="epl-input mt-1 min-h-[100px]"
              value={shipmentForm.remarks || ""}
              onChange={(e) => setShipmentForm((s) => ({ ...s, remarks: e.target.value }))}
            />
          </label>
          <label className="text-sm block">
            Link to dispatch (create new list)
            <select
              className="epl-input mt-1"
              defaultValue=""
              onChange={(e) => linkDispatch(e.target.value)}
              disabled={saving}
            >
              <option value="">—</option>
              {dispatchOptions.map((d) => (
                <option key={d.id} value={d.id}>{d.dispatch_number}</option>
              ))}
            </select>
          </label>
          <Button type="button" variant="primary" disabled={saving} onClick={saveShipmentDetails}>Save shipment</Button>
        </section>
      ) : pl && activeTab === "checklist" ? (
        <section className="epl-panel space-y-3">
          <h2 className="epl-panel__title">Document Checklist</h2>
          <ul className="space-y-2">
            {checklist.map((item, idx) => (
              <li key={item.id || idx}>
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={Boolean(item.checked)}
                    onChange={(e) => {
                      const next = [...checklist];
                      next[idx] = { ...item, checked: e.target.checked };
                      setChecklist(next);
                    }}
                  />
                  {item.label}
                </label>
              </li>
            ))}
          </ul>
          <Button type="button" variant="primary" disabled={saving} onClick={saveChecklist}>Save checklist</Button>
        </section>
      ) : pl && activeTab === "settings" ? (
        <section className="epl-panel space-y-3">
          <h2 className="epl-panel__title">Settings</h2>
          <div className="epl-form-grid">
            <label className="text-sm">
              Status
              <select
                className="epl-input mt-1"
                value={settingsForm.status || "draft"}
                onChange={(e) => setSettingsForm((s) => ({ ...s, status: e.target.value }))}
              >
                <option value="draft">Draft</option>
                <option value="in_progress">In progress</option>
                <option value="completed">Completed</option>
                <option value="dispatched">Dispatched</option>
              </select>
            </label>
            <label className="text-sm">
              Cartons planned
              <input
                type="number"
                className="epl-input mt-1"
                value={settingsForm.cartons_planned}
                onChange={(e) => setSettingsForm((s) => ({ ...s, cartons_planned: e.target.value }))}
              />
            </label>
            <label className="text-sm">
              Cartons prepared
              <input
                type="number"
                className="epl-input mt-1"
                value={settingsForm.cartons_prepared}
                onChange={(e) => setSettingsForm((s) => ({ ...s, cartons_prepared: e.target.value }))}
              />
            </label>
            <label className="text-sm">
              Gross weight (kg)
              <input
                type="number"
                className="epl-input mt-1"
                value={settingsForm.gross_weight_kg}
                onChange={(e) => setSettingsForm((s) => ({ ...s, gross_weight_kg: e.target.value }))}
              />
            </label>
            <label className="text-sm">
              Net weight (kg)
              <input
                type="number"
                className="epl-input mt-1"
                value={settingsForm.net_weight_kg}
                onChange={(e) => setSettingsForm((s) => ({ ...s, net_weight_kg: e.target.value }))}
              />
            </label>
          </div>
          <Button type="button" variant="primary" disabled={saving} onClick={saveSettings}>Save settings</Button>
        </section>
      ) : null}

      <nav className="epl-footer-nav" aria-label="Export packing sections">
        {FOOTER_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={activeTab === tab.id ? "epl-footer-nav__item epl-footer-nav__item--active" : "epl-footer-nav__item"}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
