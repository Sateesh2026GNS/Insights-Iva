import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Plus, X } from "lucide-react";

import Loader from "../../components/common/Loader";
import { ListPageShell } from "../../components/common/ListPageShell";
import usePageRefresh from "../../hooks/usePageRefresh";
import { useToast } from "../../context/ToastContext";
import { createAssetCategory, getAssetCategories } from "../../api/hrApi";
import "./companyAssets.css";

function CategoryIllustration() {
  return (
    <div className="hr-company-assets__illustration" aria-hidden>
      <div className="hr-company-assets__doc hr-company-assets__doc--back" />
      <div className="hr-company-assets__doc hr-company-assets__doc--front">
        <span />
        <span />
        <span />
      </div>
      <div className="hr-company-assets__plus-badge">
        <Plus className="h-5 w-5" strokeWidth={2.5} />
      </div>
    </div>
  );
}

function AddCategoryModal({ open, onClose, onSave, saving }) {
  const [name, setName] = useState("");

  useEffect(() => {
    if (open) setName("");
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  const modal = (
    <div
      className="hr-company-assets__overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Add Category"
    >
      <div className="hr-company-assets__modal" onClick={(e) => e.stopPropagation()}>
        <div className="hr-company-assets__modal-header">
          <h2 className="hr-company-assets__modal-title">Add Category</h2>
          <button type="button" className="hr-company-assets__modal-close" onClick={onClose} aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="hr-company-assets__modal-body">
          <label className="hr-company-assets__field-label">
            Category <span>*</span>
          </label>
          <input
            className="hr-company-assets__input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter Category Name"
            autoFocus
          />
        </div>

        <div className="hr-company-assets__modal-footer">
          <button
            type="button"
            className="hr-company-assets__save-btn"
            disabled={!name.trim() || saving}
            onClick={() => onSave(name.trim())}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

export default function CompanyAssets() {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const res = await getAssetCategories();
      const rows = res?.data?.items || res?.data || [];
      setCategories(Array.isArray(rows) ? rows : []);
    } catch {
      setCategories([]);
    } finally {
      setLoading(false);
    }
  }, []);

  usePageRefresh(() => load(true));
  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async (name) => {
    setSaving(true);
    const payload = { name, created_by: "Admin" };
    try {
      const res = await createAssetCategory(payload);
      const created = res?.data || { id: `cat-${Date.now()}`, ...payload };
      setCategories((prev) => [...prev, created]);
      addToast("Category added successfully", "success");
      setModalOpen(false);
    } catch {
      addToast("Failed to add category", "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loader label="Loading company assets..." />;

  const isEmpty = categories.length === 0;

  return (
    <ListPageShell>
      <div className="hr-company-assets min-w-0">
        <h1 className="hr-company-assets__title">Company Assets</h1>

        <div className="hr-company-assets__card">
          {isEmpty ? (
            <>
              <CategoryIllustration />
              <button
                type="button"
                className="hr-company-assets__add-btn"
                onClick={() => setModalOpen(true)}
              >
                <Plus className="h-4 w-4" strokeWidth={2.5} />
                Add Category
              </button>
            </>
          ) : (
            <div className="hr-company-assets__table-wrap">
              <table className="hr-company-assets__table">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Created By</th>
                  </tr>
                </thead>
                <tbody>
                  {categories.map((row) => (
                    <tr key={row.id || row.name}>
                      <td>{row.name}</td>
                      <td>{row.created_by || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="hr-company-assets__table-footer">
                <button
                  type="button"
                  className="hr-company-assets__add-btn hr-company-assets__add-btn--inline"
                  onClick={() => setModalOpen(true)}
                >
                  <Plus className="h-4 w-4" strokeWidth={2.5} />
                  Add Category
                </button>
              </div>
            </div>
          )}
        </div>

        <AddCategoryModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          onSave={handleSave}
          saving={saving}
        />
      </div>
    </ListPageShell>
  );
}
