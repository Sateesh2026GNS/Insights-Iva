import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Camera, LogOut, Palette, Settings, UserRound, Sliders } from "lucide-react";

import useAuth from "../../hooks/useAuth";
import { useToast } from "../../context/ToastContext";
import AdjustProfilePhotoModal from "../settings/AdjustProfilePhotoModal";

function formatRoleLabel(role) {
  if (!role || typeof role !== "string") return "";
  return role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function ClientProfilePanel({ onClose, onRequestLogout }) {
  const navigate = useNavigate();
  const { user, refreshUser, updateUserAvatar } = useAuth();
  const { addToast } = useToast();
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [selectedImageForAdjust, setSelectedImageForAdjust] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    refreshUser?.();
  }, [refreshUser]);

  if (!user) return null;

  const displayName = user.full_name || user.name || "User";
  const displayRole = formatRoleLabel(user.role_name || user.role);

  const go = (path) => {
    onClose?.();
    navigate(path);
  };

  const handleOpenAdjuster = () => {
    if (user?.avatar) {
      setSelectedImageForAdjust(user.avatar);
      setAdjustModalOpen(true);
    } else {
      fileInputRef.current?.click();
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      addToast("Image size must be less than 5MB", "error");
      return;
    }

    const validTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
    if (!validTypes.includes(file.type)) {
      addToast("Only PNG, JPG, and WebP images are supported", "error");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result;
      if (typeof dataUrl === "string") {
        setSelectedImageForAdjust(dataUrl);
        setAdjustModalOpen(true);
      }
    };
    reader.onerror = () => {
      addToast("Failed to read image file", "error");
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleRemoveAvatar = () => {
    updateUserAvatar(null);
    setSelectedImageForAdjust(null);
    addToast("Profile picture removed", "success");
  };

  return (
    <>
      <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-700 dark:bg-slate-800">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="image/png,image/jpeg,image/jpg,image/webp"
          className="hidden"
        />
        <div className="mb-4 flex items-center gap-3 border-b border-slate-100 pb-3 dark:border-slate-700">
          <div className="relative group shrink-0">
            <button
              type="button"
              onClick={handleOpenAdjuster}
              title={user?.avatar ? "Click to view & adjust profile photo" : "Click to upload profile photo"}
              className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full bg-teal-600 text-sm font-bold text-white shadow-sm ring-2 ring-teal-500/20 transition-transform hover:scale-105"
            >
              {user?.avatar ? (
                <img src={user.avatar} alt={displayName} className="h-full w-full object-cover transition-opacity group-hover:opacity-90" />
              ) : (
                String(displayName)[0].toUpperCase()
              )}
            </button>
            <button
              type="button"
              onClick={handleOpenAdjuster}
              title={user?.avatar ? "Adjust profile photo" : "Upload profile photo (PNG, JPG)"}
              className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border border-white bg-slate-900 text-white shadow transition-transform hover:scale-110 hover:bg-teal-600 dark:border-slate-800"
            >
              <Camera className="h-2.5 w-2.5" />
            </button>
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
              {displayName}
            </p>
            {displayRole ? (
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">{displayRole}</p>
            ) : null}
          </div>
        </div>

      <div className="space-y-1">
        <button
          type="button"
          onClick={() => go("/settings/my-account")}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-700/60"
        >
          <UserRound className="h-4 w-4 text-teal-600" />
          My Account
        </button>
        <button
          type="button"
          onClick={() => go("/settings")}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-700/60"
        >
          <Settings className="h-4 w-4 text-slate-500" />
          Settings
        </button>
        <button
          type="button"
          onClick={() => go("/settings/appearance")}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-700/60"
        >
          <Palette className="h-4 w-4 text-indigo-500" />
          Appearance
        </button>
        <button
          type="button"
          onClick={() => {
            onClose?.();
            onRequestLogout?.();
          }}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>

      <p className="mt-3 border-t border-slate-100 pt-3 text-[11px] leading-relaxed text-slate-500 dark:border-slate-700">
        Company and subscription details are available under{" "}
        <Link
          to="/settings/my-account"
          onClick={onClose}
          className="font-semibold text-teal-600 hover:underline dark:text-teal-400"
        >
          Settings → My Account
        </Link>
        .
      </p>
    </div>

    <AdjustProfilePhotoModal
      open={adjustModalOpen}
      onClose={() => setAdjustModalOpen(false)}
      initialImage={selectedImageForAdjust}
      onSave={(dataUrl) => {
        updateUserAvatar(dataUrl);
        setAdjustModalOpen(false);
      }}
      onRemove={handleRemoveAvatar}
      userName={displayName}
    />
  </>
  );
}
