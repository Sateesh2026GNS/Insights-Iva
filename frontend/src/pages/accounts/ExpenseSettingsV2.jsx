import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft } from "lucide-react";

import ExpenseCategoryModal from "../../components/accounts/ExpenseCategoryModal";
import {
  AccountsCard,
  AccountsPageShell,
  AccountsPrimaryButton,
  ACCOUNTS_TEXT,
  ACCOUNTS_TEXT_MUTED,
} from "../../components/accounts/accountsDesignSystem";
import Loader from "../../components/common/Loader";
import {
  categoryIcon,
  fetchExpenseCategories,
  saveExpenseCategories,
} from "../../data/expenseCategories";
import { useToast } from "../../context/ToastContext";
import { apiErrorMessage } from "../../utils/apiError";

export default function ExpenseSettingsV2() {
  const { addToast } = useToast();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editCategory, setEditCategory] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const rows = await fetchExpenseCategories();
        if (!cancelled) setCategories(rows);
      } catch (err) {
        if (!cancelled) {
          setCategories([]);
          addToast(apiErrorMessage(err, "Failed to load categories"), "error");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [addToast]);

  const persist = async (next) => {
    setCategories(next);
    try {
      await saveExpenseCategories(next);
    } catch (err) {
      addToast(apiErrorMessage(err, "Failed to save categories"), "error");
      const rows = await fetchExpenseCategories();
      setCategories(rows);
    }
  };

  const onSave = async (cat) => {
    const exists = categories.some((c) => c.id === cat.id);
    const next = exists
      ? categories.map((c) => (c.id === cat.id ? { ...c, ...cat } : c))
      : [...categories, cat];
    await persist(next);
    addToast(exists ? "Category updated." : "Category added.");
  };

  const onDelete = async (cat) => {
    if (!cat?.id) return;
    await persist(categories.filter((c) => c.id !== cat.id));
    addToast("Category deleted.");
  };

  if (loading) {
    return (
      <AccountsPageShell>
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader label="Loading categories…" />
        </div>
      </AccountsPageShell>
    );
  }

  return (
    <AccountsPageShell>
      <div className="mx-auto max-w-[900px]">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              to="/settings"
              className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"
              aria-label="Back to Settings"
              title="Back to Settings"
            >
              <ChevronLeft className="h-4 w-4 text-slate-700 dark:text-white" />
            </Link>
            <div>
              <h1 className="text-lg font-bold text-slate-900 dark:text-white">Expense Settings</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">Configure expense categories and account groupings</p>
            </div>
          </div>
          <AccountsPrimaryButton
            onClick={() => {
              setEditCategory(null);
              setModalOpen(true);
            }}
          >
            Add Category
          </AccountsPrimaryButton>
        </div>

        <AccountsCard>
          <ul className="divide-y divide-slate-200 dark:divide-slate-700">
            {categories.map((cat) => {
              const Icon = categoryIcon(cat.icon);
              return (
                <li key={cat.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                  <span
                    className="grid h-9 w-9 place-items-center rounded-lg text-white"
                    style={{ background: cat.color || "#64748B" }}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-semibold text-slate-900 dark:text-white">
                      {cat.name}
                    </p>
                    <p className="text-[12px] text-slate-500 dark:text-slate-400">
                      {cat.account_group}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="text-[12px] font-semibold text-[#6C4CFF] hover:text-[#5a3fe0]"
                    onClick={() => {
                      setEditCategory(cat);
                      setModalOpen(true);
                    }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="text-[12px] font-semibold text-[#dc2626] hover:text-[#b91c1c]"
                    onClick={() => onDelete(cat)}
                  >
                    Delete
                  </button>
                </li>
              );
            })}
          </ul>
        </AccountsCard>
      </div>

      <ExpenseCategoryModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditCategory(null);
        }}
        category={editCategory}
        onSave={onSave}
      />
    </AccountsPageShell>
  );
}
