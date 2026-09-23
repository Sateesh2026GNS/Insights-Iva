import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Lock, UserRound } from "lucide-react";

import Button from "../../components/common/Button";
import LogoutConfirmModal from "../../components/common/LogoutConfirmModal";
import { Input, Select } from "../../components/common/FormField";
import AdjustProfilePhotoModal from "../../components/settings/AdjustProfilePhotoModal";
import AccountOverviewCard from "../../components/settings/AccountOverviewCard";
import useAuth from "../../hooks/useAuth";
import { useToast } from "../../context/ToastContext";
import { changeAuthPassword, updateAuthProfile } from "../../api/authApi";
import { apiErrorMessage } from "../../utils/apiError";
import { SettingsBackLink } from "./settingsUi";
import "../../styles/my-account-settings.css";

const ACCOUNT_NAV = [
  { to: "/settings/my-account/profile", label: "Your Profile", icon: UserRound, end: true },
  { to: "/settings/my-account/two-factor", label: "Two Factor Authentication", icon: Lock },
];

export function SettingsMyAccountLayout() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async ({ allDevices } = {}) => {
    setLoggingOut(true);
    try {
      await logout({ allDevices });
      navigate("/login", { replace: true });
    } finally {
      setLoggingOut(false);
      setLogoutOpen(false);
    }
  };

  return (
    <div className="my-account-page space-y-5">
      <SettingsBackLink />
      <div className="my-account-shell">
        <aside className="my-account-nav" aria-label="Your Account">
          <h2 className="my-account-nav__title">Your Account</h2>
          <nav className="my-account-nav__list">
            {ACCOUNT_NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `my-account-nav__link${isActive ? " my-account-nav__link--active" : ""}`
                }
              >
                <item.icon className="h-4 w-4 shrink-0" aria-hidden />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>
          <Button
            type="button"
            variant="outline"
            className="my-account-nav__logout"
            onClick={() => setLogoutOpen(true)}
          >
            Logout
          </Button>
        </aside>
        <div className="my-account-main">
          <Outlet />
        </div>
      </div>
      <LogoutConfirmModal
        open={logoutOpen}
        busy={loggingOut}
        onCancel={() => !loggingOut && setLogoutOpen(false)}
        onConfirm={handleLogout}
      />
    </div>
  );
}

function ProfileAvatarColumn({ editing, onEdit, onCancelEdit, onSave, saving }) {
  const { user, updateUserAvatar } = useAuth();
  const { addToast } = useToast();
  const fileInputRef = useRef(null);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);

  const displayName = user?.full_name || user?.name || "User";
  const initial = String(displayName)[0]?.toUpperCase() || "U";

  const openFilePicker = () => fileInputRef.current?.click();

  const onFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      addToast("Image must be under 5MB", "error");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result;
      if (typeof dataUrl === "string") {
        setSelectedImage(dataUrl);
        setAdjustOpen(true);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  return (
    <div className="my-account-profile__avatar-col">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={onFileChange}
      />
      <button
        type="button"
        className="my-account-profile__avatar"
        onClick={editing ? openFilePicker : undefined}
        disabled={!editing}
        aria-label="Profile photo"
      >
        {user?.avatar ? (
          <img src={user.avatar} alt="" className="h-full w-full object-cover" />
        ) : (
          <span>{initial}</span>
        )}
      </button>
      {!editing ? (
        <button type="button" className="my-account-profile__edit-link" onClick={onEdit}>
          Edit
        </button>
      ) : (
        <div className="my-account-profile__edit-actions">
          <Button type="button" variant="outline" size="sm" onClick={onCancelEdit} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" variant="primary" size="sm" onClick={onSave} loading={saving}>
            Save
          </Button>
        </div>
      )}
      <AdjustProfilePhotoModal
        open={adjustOpen}
        onClose={() => setAdjustOpen(false)}
        initialImage={selectedImage}
        onSave={(dataUrl) => {
          updateUserAvatar(dataUrl);
          setAdjustOpen(false);
          addToast("Profile photo updated", "success");
        }}
        onRemove={() => {
          updateUserAvatar(null);
          setAdjustOpen(false);
        }}
        userName={displayName}
      />
    </div>
  );
}

export function MyAccountProfileView() {
  const { user, refreshUser } = useAuth();
  const { addToast } = useToast();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showOverview, setShowOverview] = useState(false);

  const [form, setForm] = useState({
    displayName: "",
    email: "",
    whatsapp: "",
    username: "",
    password: "",
    confirmPassword: "",
    currentPassword: "",
    country: "India",
  });

  const syncFromUser = useCallback(() => {
    const phone = user?.phone || "";
    setForm({
      displayName: user?.full_name || user?.name || "",
      email: user?.email || "",
      whatsapp: phone.replace(/^\+91\s?/, ""),
      username: user?.email || "",
      password: "",
      confirmPassword: "",
      currentPassword: "",
      country: "India",
    });
  }, [user]);

  useEffect(() => {
    syncFromUser();
  }, [syncFromUser]);

  const readOnly = !editing;

  const handleSave = async () => {
    if (!form.displayName.trim()) {
      addToast("Display name is required", "error");
      return;
    }
    const wantsPassword =
      form.password.trim() || form.confirmPassword.trim();
    if (wantsPassword) {
      if (!form.currentPassword.trim()) {
        addToast("Enter your current password to set a new password", "error");
        return;
      }
      if (!form.password.trim()) {
        addToast("Enter a new password", "error");
        return;
      }
      if (form.password !== form.confirmPassword) {
        addToast("Passwords do not match", "error");
        return;
      }
    }

    setSaving(true);
    try {
      const phoneDigits = form.whatsapp.replace(/\D/g, "");
      const phonePayload = phoneDigits ? `+91 ${phoneDigits}` : "";
      await updateAuthProfile({
        full_name: form.displayName.trim(),
        phone: phonePayload || null,
      });
      if (wantsPassword) {
        await changeAuthPassword({
          current_password: form.currentPassword,
          new_password: form.password,
          confirm_password: form.confirmPassword,
        });
      }
      await refreshUser?.();
      addToast("Profile saved", "success");
      setEditing(false);
      setForm((prev) => ({ ...prev, password: "", confirmPassword: "", currentPassword: "" }));
    } catch (err) {
      addToast(apiErrorMessage(err, "Could not save profile"), "error");
    } finally {
      setSaving(false);
    }
  };

  const passwordFields = useMemo(
    () =>
      editing
        ? (
            <>
              <div className="my-account-field">
                <label className="my-account-field__label">Current password</label>
                <Input
                  type="password"
                  value={form.currentPassword}
                  onChange={(e) => setForm((p) => ({ ...p, currentPassword: e.target.value }))}
                  autoComplete="current-password"
                  placeholder="Required to change password"
                />
              </div>
              <div className="my-account-field">
                <label className="my-account-field__label">Password</label>
                <div className="my-account-field__password">
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={form.password}
                    onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                    placeholder="Leave blank to keep current password"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="my-account-field__toggle"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="my-account-field">
                <label className="my-account-field__label">Confirm password</label>
                <div className="my-account-field__password">
                  <Input
                    type={showConfirmPassword ? "text" : "password"}
                    value={form.confirmPassword}
                    onChange={(e) => setForm((p) => ({ ...p, confirmPassword: e.target.value }))}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="my-account-field__toggle"
                    onClick={() => setShowConfirmPassword((v) => !v)}
                    aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </>
          )
        : (
            <div className="my-account-field">
              <label className="my-account-field__label">Password</label>
              <Input type="password" value="••••••••••" readOnly disabled className="my-account-field__readonly" />
            </div>
          ),
    [editing, form.confirmPassword, form.password, showConfirmPassword, showPassword]
  );

  return (
    <section className="my-account-panel" aria-labelledby="my-account-profile-title">
      <h1 id="my-account-profile-title" className="my-account-panel__title">Your Profile</h1>
      <div className="my-account-profile">
        <ProfileAvatarColumn
          editing={editing}
          onEdit={() => setEditing(true)}
          onCancelEdit={() => {
            syncFromUser();
            setEditing(false);
          }}
          onSave={handleSave}
          saving={saving}
        />
        <div className="my-account-profile__fields">
          <div className="my-account-field">
            <label className="my-account-field__label">Display Name</label>
            <Input
              value={form.displayName}
              onChange={(e) => setForm((p) => ({ ...p, displayName: e.target.value }))}
              readOnly={readOnly}
              disabled={readOnly}
              className={readOnly ? "my-account-field__readonly" : ""}
            />
          </div>
          <div className="my-account-field">
            <label className="my-account-field__label">Email</label>
            <Input value={form.email} readOnly disabled className="my-account-field__readonly" />
          </div>
          <div className="my-account-field">
            <label className="my-account-field__label">WhatsApp Number</label>
            <div className="my-account-field__phone-row">
              <Select
                value={form.country}
                onChange={(e) => setForm((p) => ({ ...p, country: e.target.value }))}
                disabled={readOnly}
                className="my-account-field__country"
              >
                <option value="India">India</option>
              </Select>
              <Input
                value={editing ? form.whatsapp : form.whatsapp ? `+91 ${form.whatsapp}` : ""}
                onChange={(e) => setForm((p) => ({ ...p, whatsapp: e.target.value }))}
                readOnly={readOnly}
                disabled={readOnly}
                className={readOnly ? "my-account-field__readonly" : ""}
                placeholder="Phone number"
              />
            </div>
          </div>
          <div className="my-account-field">
            <label className="my-account-field__label">User Name</label>
            <Input value={form.username} readOnly disabled className="my-account-field__readonly" />
          </div>
          {passwordFields}
        </div>
      </div>

      <div className="my-account-more">
        <button
          type="button"
          className="my-account-more__toggle"
          onClick={() => setShowOverview((v) => !v)}
          aria-expanded={showOverview}
        >
          {showOverview ? "Hide" : "Show"} company & subscription details
        </button>
        {showOverview ? <AccountOverviewCard /> : null}
      </div>
    </section>
  );
}

export function MyAccountTwoFactorView() {
  const { user, refreshUser } = useAuth();
  const { addToast } = useToast();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [country, setCountry] = useState("India");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    const raw = user?.phone || "";
    setPhone(raw.replace(/^\+91\s?/, ""));
  }, [user?.phone]);

  const displayPhone = phone ? `+91 ${phone.replace(/\D/g, "")}` : "—";

  const handleSave = async () => {
    const digits = phone.replace(/\D/g, "");
    if (!digits || digits.length < 10) {
      addToast("Enter a valid mobile number for two-factor authentication", "error");
      return;
    }
    setSaving(true);
    try {
      await updateAuthProfile({ phone: `+91 ${digits}` });
      await refreshUser?.();
      addToast("Two-factor authentication number updated", "success");
      setEditing(false);
    } catch (err) {
      addToast(apiErrorMessage(err, "Could not update number"), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="my-account-panel" aria-labelledby="my-account-2fa-title">
      <h1 id="my-account-2fa-title" className="my-account-panel__title">Two Factor Authentication</h1>
      <div className="my-account-2fa-card">
        <h2 className="my-account-2fa-card__title">Update Two-Factor Authentication Number</h2>
        <p className="my-account-2fa-card__desc">
          This number is used to verify your identity when logging into any of your projects.
        </p>
        <div className="my-account-2fa-card__row">
          <Select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            disabled={!editing}
            className="my-account-field__country"
          >
            <option value="India">India</option>
          </Select>
          {editing ? (
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Mobile number"
              className="flex-1"
            />
          ) : (
            <div className="my-account-2fa-card__phone-display">
              <span>{displayPhone}</span>
              <button type="button" className="my-account-profile__edit-link" onClick={() => setEditing(true)}>
                Edit
              </button>
            </div>
          )}
        </div>
        {editing ? (
          <div className="my-account-2fa-card__actions">
            <Button type="button" variant="outline" size="sm" onClick={() => setEditing(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="button" variant="primary" size="sm" onClick={handleSave} loading={saving}>
              Save
            </Button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
