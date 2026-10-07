import { useEffect, useState } from "react";

import AdminModal from "../admin/AdminModal";
import Button from "../common/Button";
import { Input } from "../common/FormField";
import { createTeamDirectorySalesExecutive, getTeamDirectory } from "../../api/adminApi";
import { useToast } from "../../context/ToastContext";
import { apiErrorMessage } from "../../utils/apiError";
import {
  filterLeadExecutiveCandidates,
  findExecutiveByName,
} from "../../utils/salesExecutiveDirectory";

export default function AddExecutiveNameModal({ open, onClose, onSuccess }) {
  const { addToast } = useToast();
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName("");
    setError("");
  }, [open]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Name is required.");
      return;
    }
    if (!/[a-zA-Z]/.test(trimmed)) {
      setError("Name must contain at least one letter.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const directoryRes = await getTeamDirectory();
      const existing = filterLeadExecutiveCandidates(
        Array.isArray(directoryRes.data) ? directoryRes.data : []
      );
      if (findExecutiveByName(existing, trimmed)) {
        setError("An executive with this name already exists. Select them from the list.");
        setSaving(false);
        return;
      }
      const res = await createTeamDirectorySalesExecutive({ full_name: trimmed });
      const created = res.data;
      addToast("Executive added.", "success");
      onSuccess?.(created);
      onClose?.();
    } catch (err) {
      setError(apiErrorMessage(err, "Could not add executive."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminModal title="Add New Name" open={open} onClose={onClose} maxWidth="max-w-md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Name"
          required
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setError("");
          }}
          placeholder="Enter name"
          error={error}
          autoFocus
        />
        <p className="text-xs text-slate-500">
          Creates a sales team user for this company. They will appear in Assigned Executive immediately.
        </p>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={saving} disabled={saving}>
            Save
          </Button>
        </div>
      </form>
    </AdminModal>
  );
}
