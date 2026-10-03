import { useEffect, useState, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  Megaphone,
  Plus,
  Search,
  Filter,
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Eye,
  Pencil,
  Trash2,
  X,
  Users,
  Building2,
  Tag,
  LayoutGrid,
  List,
  Sparkles,
  Send,
  Archive,
} from "lucide-react";

import PageHeader from "../../components/common/PageHeader";
import KpiCard from "../../components/common/KpiCard";
import Loader from "../../components/common/Loader";
import Button from "../../components/common/Button";
import usePageRefresh from "../../hooks/usePageRefresh";
import { useToast } from "../../context/ToastContext";
import {
  getAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
} from "../../api/hrApi";
import { apiErrorMessage } from "../../utils/apiError";

const inputClass =
  "mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all";

const selectClass =
  "mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all";

const priorityConfig = {
  urgent: {
    label: "Urgent",
    badge: "bg-red-50 text-red-700 border-red-200",
    dot: "bg-red-500",
    border: "border-l-red-500",
  },
  high: {
    label: "High",
    badge: "bg-amber-50 text-amber-700 border-amber-200",
    dot: "bg-amber-500",
    border: "border-l-amber-500",
  },
  normal: {
    label: "Normal",
    badge: "bg-blue-50 text-blue-700 border-blue-200",
    dot: "bg-blue-500",
    border: "border-l-blue-500",
  },
  low: {
    label: "Low",
    badge: "bg-slate-50 text-slate-600 border-slate-200",
    dot: "bg-slate-400",
    border: "border-l-slate-300",
  },
};

const statusConfig = {
  published: {
    label: "Published",
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
    icon: CheckCircle2,
  },
  draft: {
    label: "Draft",
    badge: "bg-amber-50 text-amber-700 border-amber-200",
    icon: Clock,
  },
  archived: {
    label: "Archived",
    badge: "bg-slate-100 text-slate-600 border-slate-200",
    icon: Archive,
  },
};

export default function Announcements() {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [announcements, setAnnouncements] = useState([]);
  
  // UI states
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [viewMode, setViewMode] = useState("grid"); // "grid" | "table"

  // Modals
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [viewItem, setViewItem] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [form, setForm] = useState({
    title: "",
    description: "",
    priority: "normal",
    status: "published",
    target_audience: "all",
    target_value: "",
    publish_date: new Date().toISOString().slice(0, 10),
    expiry_date: "",
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getAnnouncements();
      setAnnouncements(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      setAnnouncements([]);
      addToast(apiErrorMessage(err, "Failed to fetch announcements"), "error");
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  usePageRefresh(loadData);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // KPI summaries
  const kpis = useMemo(() => {
    const total = announcements.length;
    const published = announcements.filter(
      (a) => (a.status || "").toLowerCase() === "published"
    ).length;
    const drafts = announcements.filter(
      (a) => (a.status || "").toLowerCase() === "draft"
    ).length;
    const highPriority = announcements.filter((a) =>
      ["high", "urgent"].includes((a.priority || "").toLowerCase())
    ).length;
    return { total, published, drafts, highPriority };
  }, [announcements]);

  // Filtered list
  const filteredList = useMemo(() => {
    return announcements.filter((item) => {
      const matchSearch =
        !searchTerm ||
        item.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.created_by_name?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchStatus =
        statusFilter === "all" ||
        (item.status || "").toLowerCase() === statusFilter;

      const matchPriority =
        priorityFilter === "all" ||
        (item.priority || "").toLowerCase() === priorityFilter;

      return matchSearch && matchStatus && matchPriority;
    });
  }, [announcements, searchTerm, statusFilter, priorityFilter]);

  // Handlers
  const handleOpenCreate = () => {
    setEditingItem(null);
    setForm({
      title: "",
      description: "",
      priority: "normal",
      status: "published",
      target_audience: "all",
      target_value: "",
      publish_date: new Date().toISOString().slice(0, 10),
      expiry_date: "",
    });
    setShowModal(true);
  };

  const handleOpenEdit = (item) => {
    setEditingItem(item);
    setForm({
      title: item.title || "",
      description: item.description || "",
      priority: item.priority || "normal",
      status: item.status || "published",
      target_audience: item.target_audience || "all",
      target_value: item.target_value || "",
      publish_date: item.publish_date || new Date().toISOString().slice(0, 10),
      expiry_date: item.expiry_date || "",
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) {
      addToast("Announcement title is required", "error");
      return;
    }
    if (!form.description.trim()) {
      addToast("Announcement content is required", "error");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim(),
        priority: form.priority,
        status: form.status,
        target_audience: form.target_audience,
        target_value: form.target_audience !== "all" ? form.target_value.trim() : null,
        publish_date: form.publish_date || null,
        expiry_date: form.expiry_date || null,
      };

      if (editingItem) {
        await updateAnnouncement(editingItem.id, payload);
        addToast("Announcement updated successfully", "success");
      } else {
        await createAnnouncement(payload);
        addToast("Announcement created successfully", "success");
      }
      setShowModal(false);
      loadData();
    } catch (err) {
      addToast(apiErrorMessage(err, "Failed to save announcement"), "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setSaving(true);
    try {
      await deleteAnnouncement(deleteId);
      addToast("Announcement deleted successfully", "success");
      setDeleteId(null);
      if (viewItem?.id === deleteId) setViewItem(null);
      loadData();
    } catch (err) {
      addToast(apiErrorMessage(err, "Failed to delete announcement"), "error");
    } finally {
      setSaving(false);
    }
  };

  const handleQuickToggleStatus = async (item, newStatus) => {
    try {
      await updateAnnouncement(item.id, { status: newStatus });
      addToast(`Status updated to ${newStatus}`, "success");
      loadData();
    } catch (err) {
      addToast(apiErrorMessage(err, "Failed to update status"), "error");
    }
  };

  return (
    <div className="space-y-6 p-6">
      {/* Page Header */}
      <PageHeader
        title="Announcements"
        subtitle="Broadcast company notices, policy changes, and HR updates across the organization."
        showTitle
        action={
          <Button onClick={handleOpenCreate} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            New Announcement
          </Button>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Total Announcements"
          value={kpis.total}
          icon={Megaphone}
          color="blue"
        />
        <KpiCard
          title="Published / Active"
          value={kpis.published}
          icon={CheckCircle2}
          color="green"
        />
        <KpiCard
          title="Draft Notices"
          value={kpis.drafts}
          icon={Clock}
          color="amber"
        />
        <KpiCard
          title="Urgent & High Priority"
          value={kpis.highPriority}
          icon={AlertTriangle}
          color="rose"
        />
      </div>

      {/* Toolbar: Search, Filters & View Switcher */}
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
          {/* Search */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search announcements by title or content..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-4 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
            />
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-400 hidden sm:block" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm font-medium text-slate-700 focus:border-blue-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
            >
              <option value="all">All Statuses</option>
              <option value="published">Published</option>
              <option value="draft">Draft</option>
              <option value="archived">Archived</option>
            </select>
          </div>

          {/* Priority Filter */}
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm font-medium text-slate-700 focus:border-blue-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
          >
            <option value="all">All Priorities</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="normal">Normal</option>
            <option value="low">Low</option>
          </select>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1 self-end md:self-auto">
          <button
            type="button"
            onClick={() => setViewMode("grid")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              viewMode === "grid"
                ? "bg-white text-slate-800 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            Grid
          </button>
          <button
            type="button"
            onClick={() => setViewMode("table")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              viewMode === "table"
                ? "bg-white text-slate-800 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <List className="h-3.5 w-3.5" />
            Table
          </button>
        </div>
      </div>

      {/* Loading state */}
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader />
        </div>
      ) : filteredList.length === 0 ? (
        /* Empty State */
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center shadow-sm">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
            <Megaphone className="h-8 w-8" />
          </div>
          <h3 className="mt-4 text-lg font-bold text-slate-900">No Announcements Found</h3>
          <p className="mt-1 max-w-sm text-sm text-slate-500">
            {searchTerm || statusFilter !== "all" || priorityFilter !== "all"
              ? "No announcements matched your search or filters. Try resetting filters."
              : "Get started by broadcasting your first HR notice or company announcement."}
          </p>
          <Button onClick={handleOpenCreate} className="mt-6 flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Create Announcement
          </Button>
        </div>
      ) : viewMode === "grid" ? (
        /* Grid Cards View */
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredList.map((item) => {
            const pri = priorityConfig[item.priority?.toLowerCase()] || priorityConfig.normal;
            const st = statusConfig[item.status?.toLowerCase()] || statusConfig.published;

            return (
              <div
                key={item.id}
                className={`group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md border-l-4 ${pri.border}`}
              >
                <div>
                  {/* Top Tags */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${pri.badge}`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${pri.dot}`} />
                      {pri.label}
                    </span>

                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${st.badge}`}
                    >
                      {st.label}
                    </span>
                  </div>

                  {/* Title */}
                  <h3
                    onClick={() => setViewItem(item)}
                    className="cursor-pointer text-base font-bold text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-2"
                  >
                    {item.title}
                  </h3>

                  {/* Description preview */}
                  <p className="mt-2 text-sm text-slate-600 line-clamp-3 leading-relaxed">
                    {item.description}
                  </p>
                </div>

                {/* Footer Metadata & Actions */}
                <div className="mt-6 pt-4 border-t border-slate-100 flex flex-col gap-3">
                  <div className="flex flex-wrap items-center justify-between text-xs text-slate-500 gap-2">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-slate-400" />
                      <span>{item.publish_date || "Immediate"}</span>
                    </div>

                    {item.target_audience && (
                      <div className="flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-md text-slate-700 font-medium">
                        <Users className="h-3 w-3 text-slate-500" />
                        <span className="capitalize">{item.target_audience}</span>
                        {item.target_value ? `: ${item.target_value}` : ""}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs text-slate-400 truncate max-w-[140px]">
                      By {item.created_by_name || "Admin"}
                    </span>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setViewItem(item)}
                        className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                        title="View Notice"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(item)}
                        className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-blue-600 transition-colors"
                        title="Edit Announcement"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteId(item.id)}
                        className="rounded-lg p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                        title="Delete Announcement"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Table View */
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-700">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3.5">Title</th>
                  <th className="px-6 py-3.5">Priority</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5">Target Audience</th>
                  <th className="px-6 py-3.5">Publish Date</th>
                  <th className="px-6 py-3.5">Author</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredList.map((item) => {
                  const pri = priorityConfig[item.priority?.toLowerCase()] || priorityConfig.normal;
                  const st = statusConfig[item.status?.toLowerCase()] || statusConfig.published;

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-6 py-4 font-semibold text-slate-900 max-w-xs truncate">
                        <button
                          type="button"
                          onClick={() => setViewItem(item)}
                          className="hover:text-blue-600 text-left truncate w-full"
                        >
                          {item.title}
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${pri.badge}`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${pri.dot}`} />
                          {pri.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${st.badge}`}
                        >
                          {st.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-600">
                        <span className="capitalize font-medium">{item.target_audience || "All"}</span>
                        {item.target_value ? ` (${item.target_value})` : ""}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-500">
                        {item.publish_date || "—"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-500">
                        {item.created_by_name || "Admin"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setViewItem(item)}
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                            title="View Detail"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(item)}
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-blue-600"
                            title="Edit"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteId(item.id)}
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-600"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CREATE / EDIT MODAL */}
      {showModal &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
            <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl overflow-hidden animate-in fade-in zoom-in duration-200">
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                    <Megaphone className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      {editingItem ? "Edit Announcement" : "New Announcement"}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {editingItem
                        ? "Update details of this notice"
                        : "Create a new announcement for employees"}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Form Body */}
              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                    Title <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Annual Company Offsite & Holiday Schedule"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    className={inputClass}
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                      Priority
                    </label>
                    <select
                      value={form.priority}
                      onChange={(e) => setForm({ ...form, priority: e.target.value })}
                      className={selectClass}
                    >
                      <option value="normal">Normal Priority</option>
                      <option value="high">High Priority</option>
                      <option value="urgent">Urgent Priority</option>
                      <option value="low">Low Priority</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                      Status
                    </label>
                    <select
                      value={form.status}
                      onChange={(e) => setForm({ ...form, status: e.target.value })}
                      className={selectClass}
                    >
                      <option value="published">Published</option>
                      <option value="draft">Save as Draft</option>
                      <option value="archived">Archived</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                      Target Audience
                    </label>
                    <select
                      value={form.target_audience}
                      onChange={(e) => setForm({ ...form, target_audience: e.target.value })}
                      className={selectClass}
                    >
                      <option value="all">All Employees</option>
                      <option value="department">Specific Department</option>
                      <option value="role">Specific Role</option>
                    </select>
                  </div>

                  {form.target_audience !== "all" && (
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                        {form.target_audience === "department" ? "Department Name" : "Role Title"}
                      </label>
                      <input
                        type="text"
                        placeholder={
                          form.target_audience === "department"
                            ? "e.g. Engineering, Sales, HR"
                            : "e.g. Manager, Operator"
                        }
                        value={form.target_value}
                        onChange={(e) => setForm({ ...form, target_value: e.target.value })}
                        className={inputClass}
                      />
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                      Publish Date
                    </label>
                    <input
                      type="date"
                      value={form.publish_date}
                      onChange={(e) => setForm({ ...form, publish_date: e.target.value })}
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                      Expiry Date (Optional)
                    </label>
                    <input
                      type="date"
                      value={form.expiry_date}
                      onChange={(e) => setForm({ ...form, expiry_date: e.target.value })}
                      className={inputClass}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                    Content / Notice Body <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={5}
                    required
                    placeholder="Write the full announcement message, instructions, or policy details here..."
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    className={`${inputClass} resize-y`}
                  />
                </div>

                {/* Modal Footer */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                  >
                    Cancel
                  </button>
                  <Button type="submit" disabled={saving} className="flex items-center gap-2">
                    {saving ? "Saving..." : editingItem ? "Update Announcement" : "Create Announcement"}
                  </Button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* VIEW DETAIL MODAL */}
      {viewItem &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
            <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl overflow-hidden animate-in fade-in zoom-in duration-200">
              <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                      (priorityConfig[viewItem.priority?.toLowerCase()] || priorityConfig.normal).badge
                    }`}
                  >
                    {(priorityConfig[viewItem.priority?.toLowerCase()] || priorityConfig.normal).label}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                      (statusConfig[viewItem.status?.toLowerCase()] || statusConfig.published).badge
                    }`}
                  >
                    {(statusConfig[viewItem.status?.toLowerCase()] || statusConfig.published).label}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setViewItem(null)}
                  className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
                <h2 className="text-xl font-bold text-slate-900">{viewItem.title}</h2>

                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <div>
                    <span className="font-semibold text-slate-700">Author:</span>{" "}
                    {viewItem.created_by_name || "Admin"}
                  </div>
                  <div>
                    <span className="font-semibold text-slate-700">Publish Date:</span>{" "}
                    {viewItem.publish_date || "Immediate"}
                  </div>
                  {viewItem.expiry_date && (
                    <div>
                      <span className="font-semibold text-slate-700">Expires:</span>{" "}
                      {viewItem.expiry_date}
                    </div>
                  )}
                  <div>
                    <span className="font-semibold text-slate-700">Audience:</span>{" "}
                    <span className="capitalize">{viewItem.target_audience || "All"}</span>
                    {viewItem.target_value ? ` (${viewItem.target_value})` : ""}
                  </div>
                </div>

                <div className="mt-4 text-sm text-slate-800 leading-relaxed whitespace-pre-wrap rounded-xl border border-slate-100 bg-slate-50/50 p-4">
                  {viewItem.description}
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4 bg-slate-50/50">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const item = viewItem;
                      setViewItem(null);
                      handleOpenEdit(item);
                    }}
                    className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteId(viewItem.id);
                    }}
                    className="flex items-center gap-1.5 rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setViewItem(null)}
                  className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                >
                  Close
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteId &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl animate-in fade-in zoom-in duration-200">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-base font-bold text-slate-900">Delete Announcement?</h3>
              <p className="mt-1 text-sm text-slate-500">
                Are you sure you want to delete this announcement? This action cannot be undone.
              </p>
              <div className="mt-6 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setDeleteId(null)}
                  className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleDelete}
                  className="rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-rose-700 transition-colors"
                >
                  {saving ? "Deleting..." : "Delete Notice"}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
