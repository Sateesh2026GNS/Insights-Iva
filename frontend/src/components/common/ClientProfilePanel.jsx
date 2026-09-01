import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Camera, LogOut, Palette, Settings, UserRound } from "lucide-react";

import useAuth from "../../hooks/useAuth";
import { useToast } from "../../context/ToastContext";
import AdjustProfilePhotoModal from "../settings/AdjustProfilePhotoModal";

function formatRoleLabel(role) {
  if (!role || typeof role !== "string") return "";
  return role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const MENU_ITEMS = [
  { id: "account", label: "My Account", icon: UserRound, path: "/settings/my-account", iconBrand: true },
  { id: "settings", label: "Settings", icon: Settings, path: "/settings" },
  { id: "appearance", label: "Appearance", icon: Palette, path: "/settings/appearance" },
];

export default function ClientProfilePanel({ onClose, onRequestLogout }) {
  const navigate = useNavigate();
  const { user, refreshUser, updateUserAvatar } = useAuth();
  const { addToast } = useToast();
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [selectedImageForAdjust, setSelectedImageForAdjust] = useState(null);
  const fileInputRef = useRef(null);
  const menuRef = useRef(null);
  const itemRefs = useRef([]);

  useEffect(() => {
    refreshUser?.();
  }, [refreshUser]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      itemRefs.current[0]?.focus();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose?.();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const go = useCallback(
    (path) => {
      onClose?.();
      navigate(path);
    },
    [navigate, onClose]
  );

  const focusItem = useCallback((index) => {
    const total = itemRefs.current.length;
    if (total === 0) return;
    const next = ((index % total) + total) % total;
    itemRefs.current[next]?.focus();
  }, []);

  const handleItemKeyDown = useCallback(
    (e, index) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        focusItem(index + 1);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        focusItem(index - 1);
      } else if (e.key === "Home") {
        e.preventDefault();
        focusItem(0);
      } else if (e.key === "End") {
        e.preventDefault();
        focusItem(itemRefs.current.length - 1);
      }
    },
    [focusItem]
  );

  if (!user) return null;

  const displayName = user.full_name || user.name || "User";
  const displayRole = formatRoleLabel(user.role_name || user.role);

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

  let menuIndex = 0;

  return (
    <>
      <div
        ref={menuRef}
        role="menu"
        aria-label="Account menu"
        className="profile-dropdown"
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="image/png,image/jpeg,image/jpg,image/webp"
          className="hidden"
          aria-hidden
        />

        <div className="profile-dropdown__header">
          <div className="profile-dropdown__avatar-wrap">
            <button
              type="button"
              onClick={handleOpenAdjuster}
              className="profile-dropdown__avatar-btn"
              aria-label={user?.avatar ? "View or change profile photo" : "Upload profile photo"}
            >
              {user?.avatar ? (
                <img src={user.avatar} alt="" className="h-full w-full object-cover" />
              ) : (
                String(displayName)[0].toUpperCase()
              )}
            </button>
            <button
              type="button"
              onClick={handleOpenAdjuster}
              className="profile-dropdown__camera-btn"
              aria-label={user?.avatar ? "Edit profile photo" : "Upload profile photo"}
              title={user?.avatar ? "Edit photo" : "Upload photo"}
            >
              <Camera className="h-2 w-2" aria-hidden />
            </button>
          </div>
          <div className="profile-dropdown__identity">
            <p className="profile-dropdown__name" title={displayName}>
              {displayName}
            </p>
            {displayRole ? (
              <p className="profile-dropdown__role" title={displayRole}>
                {displayRole}
              </p>
            ) : null}
          </div>
        </div>

        <div className="profile-dropdown__menu">
          {MENU_ITEMS.map((item) => {
            const Icon = item.icon;
            const refIndex = menuIndex;
            menuIndex += 1;
            return (
              <button
                key={item.id}
                type="button"
                role="menuitem"
                ref={(el) => {
                  itemRefs.current[refIndex] = el;
                }}
                onClick={() => go(item.path)}
                onKeyDown={(e) => handleItemKeyDown(e, refIndex)}
                className="profile-dropdown__item"
              >
                <span
                  className={`profile-dropdown__item-icon${
                    item.iconBrand ? " profile-dropdown__item-icon--brand" : ""
                  }`}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
                {item.label}
              </button>
            );
          })}

          <div className="profile-dropdown__divider" role="separator" />

          <button
            type="button"
            role="menuitem"
            ref={(el) => {
              itemRefs.current[menuIndex] = el;
            }}
            onClick={() => {
              onClose?.();
              onRequestLogout?.();
            }}
            onKeyDown={(e) => handleItemKeyDown(e, menuIndex)}
            className="profile-dropdown__item profile-dropdown__item--danger"
          >
            <span className="profile-dropdown__item-icon">
              <LogOut className="h-4 w-4" aria-hidden />
            </span>
            Sign Out
          </button>
        </div>

        <p className="profile-dropdown__footer">
          Company &amp; subscription:{" "}
          <Link
            to="/settings/my-account"
            onClick={onClose}
            className="profile-dropdown__footer-link"
          >
            My Account
          </Link>
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
