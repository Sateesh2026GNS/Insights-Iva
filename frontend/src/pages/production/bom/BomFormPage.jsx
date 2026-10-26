import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Trash2 } from "lucide-react";

import { createBom, fetchBomDetail, updateBomVersion } from "../../../api/bomModuleApi";
import { getProducts } from "../../../api/productsApi";
import Button from "../../../components/common/Button";
import FieldError from "../../../components/common/states/FieldError";
import { PermissionDeniedState } from "../../../components/common/states";
import { ListPageShell } from "../../../components/common/ListPageShell";
import { PRODUCTION_MANAGER_PAGE_CHROME } from "../../../config/productionManagerPageChrome";
import { useToast } from "../../../context/ToastContext";
import useAuth from "../../../hooks/useAuth";
import { userCanEditBom } from "../../../config/permissions";
import { apiErrorMessage, asArray, mapValidationErrorsToFields } from "../../../utils/apiError";
import { cleanProductLabel } from "../../../utils/productLabel";

const emptyLine = () => ({
  component_item_id: "",
  quantity: "1",
  uom: "",
  scrap_percent: "0",
});

export default function BomFormPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const copyFrom = searchParams.get("from");
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addToast } = useToast();
  const [products, setProducts] = useState([]);
  const [itemsLoading, setItemsLoading] = useState(true);
  const [itemsError, setItemsError] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [productId, setProductId] = useState("");
  const [baseQty, setBaseQty] = useState("1");
  const [baseUom, setBaseUom] = useState("");
  const [savedCostPerUnit, setSavedCostPerUnit] = useState(null);
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState([emptyLine()]);
  const [versionId, setVersionId] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [lineErrors, setLineErrors] = useState({});
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);

  const canEdit = userCanEditBom(user);
  const finishedProducts = products.filter((product) => /finished/i.test(String(product.category || "")));

  useEffect(() => {
    let active = true;
    getProducts()
      .then((res) => {
        if (!active) return;
        const list = asArray(res?.data ?? res)
          .map((product) => ({
            ...product,
            name: cleanProductLabel(product.name),
            unit: product.unit || "Pcs",
            category: String(product.category || ""),
            status: String(product.status || "active").toLowerCase(),
          }))
          .filter((product) => product.status === "active" && Number.isFinite(Number(product.id)));
        setProducts(list);
        setItemsError("");
      })
      .catch((error) => {
        if (active) setItemsError(apiErrorMessage(error, "Unable to load products."));
      })
      .finally(() => {
        if (active) setItemsLoading(false);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const sourceId = isEdit ? id : copyFrom;
    if (!sourceId) return;
    fetchBomDetail(sourceId).then((data) => {
      const v = data.version;
      if (isEdit) {
        setProductId(String(data.product_id));
        setVersionId(v.id);
      } else {
        setProductId("");
      }
      setBaseQty(String(v.base_quantity));
      setBaseUom(v.base_uom);
      setSavedCostPerUnit(v.cost?.cost_per_unit ?? null);
      setNotes(v.notes || "");
      setEffectiveFrom(v.effective_from || "");
      setLines(
        (v.components || []).map((c) => ({
          component_item_id: String(c.component_item_id),
          quantity: String(c.quantity),
          uom: c.uom,
          scrap_percent: String(c.scrap_percent),
        })),
      );
    });
  }, [id, isEdit, copyFrom]);

  if (!canEdit) {
    return (
      <ListPageShell plannerChrome={PRODUCTION_MANAGER_PAGE_CHROME.bomForm}>
        <PermissionDeniedState description="You do not have permission to edit BOMs." />
      </ListPageShell>
    );
  }

  const buildPayload = () => ({
    name: products.find((product) => String(product.id) === String(productId))?.name || "BOM",
    product_id: Number(productId),
    version: {
      base_quantity: Number(baseQty),
      base_uom: baseUom,
      effective_from: effectiveFrom || null,
      notes,
      components: lines.map((l, i) => ({
          component_item_id: Number(l.component_item_id),
          quantity: Number(l.quantity),
          uom: l.uom,
          scrap_percent: Number(l.scrap_percent || 0),
          line_no: i + 1,
        })),
    },
  });

  const validateForm = () => {
    const nextErrors = {};
    const nextLineErrors = {};
    const parsedBaseQty = Number(baseQty);

    if (!productId) nextErrors.product_id = "Select the finished product this BOM makes.";
    if (!Number.isFinite(parsedBaseQty) || parsedBaseQty <= 0) {
      nextErrors.base_quantity = "Output quantity must be greater than zero.";
    }
    if (!baseUom.trim()) nextErrors.base_uom = "Enter an output unit.";
    if (!lines.length) nextErrors.components = "Add at least one component.";

    const componentIds = new Set();
    lines.forEach((line, index) => {
      const errors = [];
      const quantity = Number(line.quantity);
      const scrap = Number(line.scrap_percent || 0);
      const componentId = Number(line.component_item_id);
      if (!line.component_item_id) errors.push("Select a component.");
      if (line.component_item_id && componentIds.has(componentId)) errors.push("Choose each component only once.");
      if (line.component_item_id) componentIds.add(componentId);
      if (!Number.isFinite(quantity) || quantity <= 0) errors.push("Quantity must be greater than zero.");
      if (!String(line.uom || "").trim()) errors.push("Enter a unit.");
      if (!Number.isFinite(scrap) || scrap < 0 || scrap >= 100) errors.push("Scrap must be from 0% to less than 100%.");
      if (errors.length) nextLineErrors[index] = errors.join(" ");
    });

    setFieldErrors(nextErrors);
    setLineErrors(nextLineErrors);
    return Object.keys(nextErrors).length === 0 && Object.keys(nextLineErrors).length === 0;
  };

  const clearFieldError = (field) => {
    setFieldErrors((previous) => {
      if (!previous[field]) return previous;
      const next = { ...previous };
      delete next[field];
      return next;
    });
  };

  const clearLineError = (index) => {
    setLineErrors((previous) => {
      if (!previous[index]) return previous;
      const next = { ...previous };
      delete next[index];
      return next;
    });
  };

  const save = async (activateAfter) => {
    setSaveError("");
    if (!validateForm()) {
      addToast("Please correct the highlighted fields before saving.", "error");
      requestAnimationFrame(() => {
        document.querySelector('[aria-invalid="true"]')?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
      return;
    }
    setSaving(true);
    setFieldErrors({});
    setLineErrors({});
    try {
      if (isEdit) {
        await updateBomVersion(id, versionId, buildPayload().version);
        addToast("BOM draft saved.", "success");
        if (activateAfter) {
          const { activateBomVersion } = await import("../../../api/bomModuleApi");
          await activateBomVersion(id, versionId);
          addToast("BOM activated.", "success");
        }
        navigate(`/production/bom/${id}`);
      } else {
        const created = await createBom(buildPayload());
        addToast("BOM created.", "success");
        navigate(`/production/bom/${created.id}`);
      }
    } catch (e) {
      const mapped = mapValidationErrorsToFields(e);
      const mappedMessage = Object.values(mapped || {}).join(" ");
      const message = mappedMessage || apiErrorMessage(e, "Unable to save BOM.");
      if (mapped && Object.keys(mapped).length) setFieldErrors(mapped);
      setSaveError(message);
      addToast(message, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ListPageShell plannerChrome={PRODUCTION_MANAGER_PAGE_CHROME.bomForm}>
      <div
        className="ui-card mx-auto w-full max-w-4xl space-y-4 p-4"
        style={{ width: "min(100%, 56rem)", marginInline: "auto" }}
      >
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium">Finished product</label>
            <select
              className="ui-input mt-1 w-full"
              value={productId}
              required
              onChange={(e) => {
                const selectedId = e.target.value;
                setProductId(selectedId);
                const selectedProduct = finishedProducts.find((product) => String(product.id) === selectedId);
                setBaseUom(selectedProduct?.unit || "");
                clearFieldError("product_id");
              }}
              disabled={isEdit}
              aria-busy={itemsLoading}
              aria-invalid={Boolean(fieldErrors.product_id)}
            >
              <option value="">{itemsLoading ? "Loading products…" : "Select finished product"}</option>
              {(isEdit ? products : finishedProducts).map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            {!itemsLoading && !itemsError && finishedProducts.length === 0 && (
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">No active finished goods are available. Add one in Product Master first.</p>
            )}
            {itemsError && <FieldError message={itemsError} />}
            <FieldError message={fieldErrors.product_id} />
          </div>
          <div>
            <label className="text-sm font-medium">Recipe output quantity</label>
            <input
              type="number"
              min="0.001"
              step="any"
              required
              className="ui-input mt-1 w-full"
              value={baseQty}
              onChange={(e) => {
                setBaseQty(e.target.value);
                clearFieldError("base_quantity");
              }}
              aria-invalid={Boolean(fieldErrors.base_quantity)}
            />
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              Component quantities below are for this output amount.
            </p>
            <FieldError message={fieldErrors.base_quantity} />
          </div>
          <div>
            <label className="text-sm font-medium">Output unit</label>
            <input
              className="ui-input mt-1 w-full read-only:opacity-75"
              value={baseUom}
              readOnly
              placeholder="Set from finished product"
              aria-invalid={Boolean(fieldErrors.base_uom)}
            />
            <FieldError message={fieldErrors.base_uom} />
          </div>
          <div>
            <label className="text-sm font-medium">Cost per unit</label>
            <input
              className="ui-input mt-1 w-full read-only:opacity-75"
              value={savedCostPerUnit != null ? `₹${Number(savedCostPerUnit).toFixed(2)}` : "Calculated after save"}
              readOnly
              aria-label="Calculated cost per unit"
            />
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              Calculated from component landed costs; it is not entered manually.
            </p>
          </div>
        </div>
        <details className="rounded-lg border border-[var(--color-border)] px-3 py-2">
          <summary className="cursor-pointer text-sm font-medium">Additional details (optional)</summary>
          <div className="grid gap-3 pt-3 sm:grid-cols-2">
            <label className="text-sm font-medium">
              Effective from
              <input type="date" className="ui-input mt-1 w-full" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} />
            </label>
            <label className="text-sm font-medium sm:col-span-2">
              Notes
              <textarea className="ui-textarea mt-1 min-h-16 w-full resize-y" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </label>
          </div>
        </details>
        <FieldError message={fieldErrors.components} />
        <div className="border-t border-[var(--color-border)] pt-3">
          <div className="mb-3">
            <p className="text-sm font-semibold">Components</p>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">Add each material or sub-assembly once and enter the quantity needed for the output above.</p>
          </div>
          {lines.map((line, idx) => (
            <div key={idx} className="grid grid-cols-1 gap-2 mb-3 items-end rounded-lg border border-[var(--color-border)] p-3 sm:grid-cols-[minmax(0,2fr)_minmax(6rem,1fr)_minmax(6rem,1fr)_2.5rem]">
              <select
                className="ui-input"
                value={line.component_item_id}
                aria-label={`Component ${idx + 1}`}
                aria-invalid={Boolean(lineErrors[idx])}
                disabled={itemsLoading || Boolean(itemsError)}
                onChange={(e) => {
                  const next = [...lines];
                  next[idx].component_item_id = e.target.value;
                  const picked = products.find((p) => String(p.id) === e.target.value);
                  next[idx].uom = picked?.unit || "";
                  setLines(next);
                  clearLineError(idx);
                }}
              >
                <option value="">{itemsLoading ? "Loading components…" : "Select material or sub-assembly"}</option>
                {products
                  .filter((p) => String(p.id) !== String(productId))
                  .map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
              </select>
              <input
                type="number"
                min="0.001"
                step="any"
                className="ui-input"
                placeholder="Qty"
                aria-label={`Quantity for component ${idx + 1}`}
                value={line.quantity}
                onChange={(e) => {
                  const next = [...lines];
                  next[idx].quantity = e.target.value;
                  setLines(next);
                  clearLineError(idx);
                }}
              />
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Unit</label>
                <input className="ui-input w-full" value={line.uom} readOnly placeholder="From selected item" aria-label={`Unit for component ${idx + 1}`} />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="mb-0.5 rounded-lg border border-red-200 bg-red-50 text-red-600 hover:border-red-300 hover:bg-red-100 hover:text-red-700"
                aria-label={`Remove component ${idx + 1}`}
                title="Remove component"
                onClick={() => {
                  setLines(lines.filter((_, i) => i !== idx));
                  setLineErrors({});
                }}
              >
                <Trash2 className="h-4 w-4 text-red-600" aria-hidden />
              </Button>
              {lineErrors[idx] ? (
                <p className="col-span-full text-xs text-[var(--color-danger)]" role="alert">
                  {lineErrors[idx]}
                </p>
              ) : null}
            </div>
          ))}
          <Button type="button" variant="secondary" onClick={() => setLines([...lines, emptyLine()])}>
            Add line
          </Button>
        </div>
        <div className="flex flex-col-reverse gap-3 border-t border-[var(--color-border)] pt-4 sm:flex-row sm:items-center sm:justify-between">
          {!isEdit ? (
            <p className="text-xs text-[var(--color-text-muted)]">
              New BOMs are saved as drafts. You can review and activate them after saving.
            </p>
          ) : <span />}
          <div className="flex flex-wrap justify-end gap-2">
            {saveError && <p className="basis-full text-right text-sm text-[var(--color-danger)]" role="alert">{saveError}</p>}
            <Button variant="primary" disabled={saving} onClick={() => save(false)}>Save draft</Button>
            {isEdit && (
              <Button variant="secondary" disabled={saving} onClick={() => save(true)}>
                Save and activate
              </Button>
            )}
            <Button variant="secondary" to="/production/bom">Cancel</Button>
          </div>
        </div>
      </div>
    </ListPageShell>
  );
}
