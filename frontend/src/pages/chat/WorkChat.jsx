import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Archive,
  BellOff,
  CheckSquare,
  Download,
  Eye,
  EyeOff,
  File,
  FileSpreadsheet,
  FileText,
  Forward,
  Heart,
  Image as ImageIcon,
  Info,
  Loader2,
  Lock,
  LogOut,
  MessageSquare,
  MinusCircle,
  MoreVertical,
  Palette,
  Paperclip,
  Plus,
  Search,
  Send,
  Smile,
  Trash2,
  Users,
  X,
  XCircle,
} from "lucide-react";

import Button from "../../components/common/Button";
import Loader from "../../components/common/Loader";
import { SearchBar } from "../../components/common/SearchFilter";
import { ListPageShell } from "../../components/common/ListPageShell";
import useAuth from "../../hooks/useAuth";
import api from "../../api/axiosConfig";
import {
  createGroupChat,
  deleteChatMessage,
  forwardChatMessage,
  listConversations,
  listMessages,
  markConversationRead,
  openDirectChat,
  searchChatUsers,
  sendMessage,
  toggleChatMessageReaction,
} from "../../api/workChatApi";
import {
  getDownloadUrl,
  resolveUploadUrl,
  uploadErrorMessage,
  validateFileClient,
} from "../../api/filesApi";
import {
  ensureFileHasName,
  fileFromClipboardEvent,
  uploadFileThroughPipeline,
} from "../../utils/fileUploadPipeline";
import { apiErrorMessage } from "../../utils/apiError";
import { useToast } from "../../context/ToastContext";
import "../../styles/work-chat.css";

const QUICK_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🎉", "🙏", "🔥"];

function initials(name) {
  return String(name || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

function formatTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay
    ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function isImageFile(filename, mimeType) {
  if (mimeType && String(mimeType).startsWith("image/")) return true;
  const ext = String(filename || "").split(".").pop().toLowerCase();
  return ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp"].includes(ext);
}

function formatFileSize(bytes) {
  if (!bytes || isNaN(bytes)) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(filename, mimeType) {
  if (isImageFile(filename, mimeType)) return ImageIcon;
  const ext = String(filename || "").split(".").pop().toLowerCase();
  if (ext === "pdf" || mimeType === "application/pdf") return FileText;
  if (["doc", "docx", "txt", "rtf", "odt"].includes(ext)) return FileText;
  if (["xls", "xlsx", "csv"].includes(ext)) return FileSpreadsheet;
  if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) return Archive;
  return File;
}

function WorkChatImageAttachment({ attachment, own, onOpenLightbox, onDownload }) {
  const fileId = attachment.file_id || attachment.id;
  const [imgSrc, setImgSrc] = useState(() => {
    return attachment.download_url ? resolveUploadUrl(attachment.download_url) : null;
  });
  const [loading, setLoading] = useState(!imgSrc);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    let createdUrl = null;

    if (!imgSrc && fileId) {
      async function fetchImage() {
        setLoading(true);
        setError(false);
        let attempts = 0;
        while (active && attempts < 5) {
          try {
            const { download_url } = await getDownloadUrl(fileId);
            const resolved = resolveUploadUrl(download_url);
            if (active) {
              setImgSrc(resolved);
              setLoading(false);
              return;
            }
          } catch {
            attempts += 1;
            if (attempts >= 5) {
              if (active) setError(true);
              break;
            }
            await new Promise((r) => setTimeout(r, 400));
          }
        }
        if (active) setLoading(false);
      }

      fetchImage();
    }

    return () => {
      active = false;
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl);
      }
    };
  }, [fileId, imgSrc]);

  const handleImageError = async () => {
    try {
      if (!fileId) {
        setError(true);
        return;
      }
      const { download_url } = await getDownloadUrl(fileId);
      const url = resolveUploadUrl(download_url);
      const res = await api.get(url, { responseType: "blob", skipCache: true });
      if (res.data && res.data.type !== "application/json") {
        const objectUrl = URL.createObjectURL(res.data);
        setImgSrc(objectUrl);
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    }
  };

  if (error) {
    return <WorkChatFileAttachment attachment={attachment} own={own} onDownload={onDownload} />;
  }

  if (loading && !imgSrc) {
    return (
      <div className="work-chat-img-skeleton">
        <Loader2 className="h-4 w-4 animate-spin text-[var(--color-text-muted)]" />
        <span className="text-xs text-[var(--color-text-muted)]">Loading image...</span>
      </div>
    );
  }

  return (
    <div className="work-chat-img-container">
      <img
        src={imgSrc}
        alt={attachment.filename}
        className="work-chat-img-thumb"
        onError={handleImageError}
        onClick={() => onOpenLightbox(imgSrc, attachment.filename, fileId)}
      />
      <div className="work-chat-img-overlay">
        <button
          type="button"
          className="work-chat-img-btn"
          title="View full image"
          onClick={(e) => {
            e.stopPropagation();
            onOpenLightbox(imgSrc, attachment.filename, fileId);
          }}
        >
          <Eye className="h-4 w-4" />
        </button>
        <button
          type="button"
          className="work-chat-img-btn"
          title="Download image"
          onClick={(e) => {
            e.stopPropagation();
            onDownload(fileId, attachment.filename, attachment.download_url);
          }}
        >
          <Download className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function WorkChatFileAttachment({ attachment, own, onDownload }) {
  const Icon = getFileIcon(attachment.filename, attachment.mime_type);
  const sizeText = formatFileSize(attachment.file_size);
  const fileId = attachment.file_id || attachment.id;

  return (
    <div
      className={`work-chat-file-card cursor-pointer hover:opacity-95 transition-opacity ${own ? "work-chat-file-card--own" : ""}`}
      onClick={() => onDownload(fileId, attachment.filename, attachment.download_url)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onDownload(fileId, attachment.filename, attachment.download_url);
        }
      }}
    >
      <div className="work-chat-file-icon">
        <Icon className="h-5 w-5" />
      </div>
      <div className="work-chat-file-info min-w-0 flex-1">
        <p className="work-chat-file-name truncate" title={attachment.filename}>
          {attachment.filename}
        </p>
        {sizeText ? <p className="work-chat-file-size">{sizeText}</p> : null}
      </div>
      <button
        type="button"
        className="work-chat-file-download shrink-0"
        title="Download file"
        onClick={(e) => {
          e.stopPropagation();
          onDownload(fileId, attachment.filename, attachment.download_url);
        }}
      >
        <Download className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function WorkChatAttachmentItem({ attachment, own, onOpenLightbox, onDownload }) {
  if (isImageFile(attachment.filename, attachment.mime_type)) {
    return (
      <WorkChatImageAttachment
        attachment={attachment}
        own={own}
        onOpenLightbox={onOpenLightbox}
        onDownload={onDownload}
      />
    );
  }
  return (
    <WorkChatFileAttachment
      attachment={attachment}
      own={own}
      onDownload={onDownload}
    />
  );
}

function PendingFileChip({ file, onRemove }) {
  const [thumb, setThumb] = useState(null);
  const isImg = isImageFile(file.name, file.type);

  useEffect(() => {
    if (!isImg) return;
    const url = URL.createObjectURL(file);
    setThumb(url);
    return () => URL.revokeObjectURL(url);
  }, [file, isImg]);

  const Icon = getFileIcon(file.name, file.type);
  const sizeText = formatFileSize(file.size);

  if (isImg && thumb) {
    return (
      <div className="work-chat-pending-thumb">
        <img src={thumb} alt={file.name} className="work-chat-pending-img" />
        <div className="work-chat-pending-overlay">
          <button
            type="button"
            className="work-chat-pending-remove"
            onClick={onRemove}
            aria-label="Remove image"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="work-chat-pending-card">
      <Icon className="h-4 w-4 text-[var(--color-primary)] shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold text-[var(--color-text)]">{file.name}</p>
        {sizeText ? <p className="text-[10px] text-[var(--color-text-muted)]">{sizeText}</p> : null}
      </div>
      <button
        type="button"
        className="text-[var(--color-text-muted)] hover:text-red-500 transition-colors"
        onClick={onRemove}
        aria-label="Remove file"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function ImageLightbox({ lightbox, onClose, onDownload }) {
  if (!lightbox) return null;

  return (
    <div className="work-chat-lightbox-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="work-chat-lightbox-content" onClick={(e) => e.stopPropagation()}>
        <div className="work-chat-lightbox-header">
          <span className="truncate font-semibold text-white text-sm">{lightbox.filename}</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
              title="Download image"
              onClick={() => onDownload(lightbox.fileId, lightbox.filename)}
            >
              <Download className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
              title="Close"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="work-chat-lightbox-body">
          <img src={lightbox.url} alt={lightbox.filename} className="work-chat-lightbox-img" />
        </div>
      </div>
    </div>
  );
}

function ForwardModal({ message, conversations, onClose, onForward }) {
  const [selectedConvs, setSelectedConvs] = useState([]);
  const [companyUsers, setCompanyUsers] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let active = true;
    if (message) {
      searchChatUsers(query)
        .then((data) => {
          if (active) setCompanyUsers(data?.items || []);
        })
        .catch(() => {});
    }
    return () => {
      active = false;
    };
  }, [message, query]);

  if (!message) return null;

  const q = query.toLowerCase().trim();

  const filteredConvs = conversations.filter((c) =>
    (c.name || "").toLowerCase().includes(q)
  );

  const filteredUsers = companyUsers.filter(
    (u) =>
      (u.full_name || "").toLowerCase().includes(q) ||
      (u.email || "").toLowerCase().includes(q)
  );

  const convTargets = filteredConvs.map((c) => ({
    id: `conv:${c.id}`,
    rawId: c.id,
    type: "conv",
    name: c.name,
    sub: c.type === "group" ? "Group Channel" : "Direct Chat",
  }));

  const userTargets = filteredUsers.map((u) => ({
    id: `user:${u.id}`,
    rawId: u.id,
    type: "user",
    name: u.full_name,
    sub: u.email,
  }));

  const allTargets = [...convTargets, ...userTargets];

  const allSelected =
    allTargets.length > 0 && allTargets.every((t) => selectedConvs.includes(t.id));

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedConvs([]);
    } else {
      setSelectedConvs(allTargets.map((t) => t.id));
    }
  };

  const toggleSelect = (id) => {
    setSelectedConvs((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleConfirm = async () => {
    if (!selectedConvs.length || submitting) return;
    setSubmitting(true);
    try {
      const targetConvIds = [];
      for (const item of selectedConvs) {
        if (item.startsWith("conv:")) {
          targetConvIds.push(Number(item.replace("conv:", "")));
        } else if (item.startsWith("user:")) {
          const uId = Number(item.replace("user:", ""));
          const c = await openDirectChat(uId);
          if (c?.id) targetConvIds.push(c.id);
        }
      }
      const uniqueIds = Array.from(new Set(targetConvIds));
      if (uniqueIds.length) {
        await onForward(message.id, uniqueIds);
      }
      onClose();
    } catch {
      /* ignore */
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="work-chat-modal-backdrop" role="dialog" aria-modal="true">
      <div className="work-chat-modal ui-card">
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
          <h3 className="font-bold text-sm text-[var(--color-text)]">Forward message</h3>
          <div className="flex items-center gap-2">
            {allTargets.length > 0 && (
              <button
                type="button"
                className="px-2.5 py-1 text-xs font-semibold rounded border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-muted)] transition-colors"
                onClick={toggleSelectAll}
              >
                {allSelected ? "Deselect All" : "Select All"}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] p-1 rounded transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        <div className="p-4 space-y-3">
          <div className="p-2.5 rounded-lg bg-[var(--color-surface-muted)] text-xs border border-[var(--color-border-soft)]">
            <p className="font-semibold text-[var(--color-text)] mb-0.5">Message preview:</p>
            <p className="line-clamp-2 text-[var(--color-text-muted)]">
              {message.body || (message.attachments?.length ? "📎 Attachment" : "Message")}
            </p>
          </div>
          <div>
            <SearchBar
              size="compact"
              value={query}
              onChange={setQuery}
              placeholder="Search users or conversations..."
              className="w-full"
              aria-label="Search users or conversations to forward to"
            />
          </div>

          <div className="max-h-60 overflow-y-auto space-y-3 pr-1">
            {convTargets.length > 0 && (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-1">
                  Active Chats ({convTargets.length})
                </p>
                <ul className="space-y-1">
                  {convTargets.map((c) => {
                    const selected = selectedConvs.includes(c.id);
                    return (
                      <li key={c.id}>
                        <button
                          type="button"
                          className={`w-full px-3 py-2 text-left text-sm rounded-lg flex items-center justify-between transition-colors ${
                            selected
                              ? "bg-[var(--color-primary-soft)] text-[var(--color-primary)] font-semibold"
                              : "hover:bg-[var(--color-surface-muted)] text-[var(--color-text)]"
                          }`}
                          onClick={() => toggleSelect(c.id)}
                        >
                          <div className="min-w-0 flex-1">
                            <span className="truncate block font-medium">{c.name}</span>
                            <span className="text-[11px] text-[var(--color-text-muted)] block">{c.sub}</span>
                          </div>
                          {selected ? (
                            <span className="text-xs font-bold px-2 py-0.5 rounded bg-[var(--color-primary)] text-white shrink-0 ml-2">
                              Selected
                            </span>
                          ) : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {userTargets.length > 0 && (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-1">
                  Company Users ({userTargets.length})
                </p>
                <ul className="space-y-1">
                  {userTargets.map((u) => {
                    const selected = selectedConvs.includes(u.id);
                    return (
                      <li key={u.id}>
                        <button
                          type="button"
                          className={`w-full px-3 py-2 text-left text-sm rounded-lg flex items-center justify-between transition-colors ${
                            selected
                              ? "bg-[var(--color-primary-soft)] text-[var(--color-primary)] font-semibold"
                              : "hover:bg-[var(--color-surface-muted)] text-[var(--color-text)]"
                          }`}
                          onClick={() => toggleSelect(u.id)}
                        >
                          <div className="min-w-0 flex-1 flex items-center gap-2">
                            <span className="work-chat-avatar work-chat-avatar--sm shrink-0">{initials(u.name)}</span>
                            <div className="min-w-0 flex-1">
                              <span className="truncate block font-medium">{u.name}</span>
                              <span className="text-[11px] text-[var(--color-text-muted)] block truncate">{u.sub}</span>
                            </div>
                          </div>
                          {selected ? (
                            <span className="text-xs font-bold px-2 py-0.5 rounded bg-[var(--color-primary)] text-white shrink-0 ml-2">
                              Selected
                            </span>
                          ) : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {allTargets.length === 0 && (
              <p className="text-xs text-[var(--color-text-muted)] text-center py-6">
                No users or conversations found.
              </p>
            )}
          </div>

          <Button
            type="button"
            variant="primary"
            className="w-full"
            disabled={!selectedConvs.length || submitting}
            onClick={handleConfirm}
          >
            {submitting ? "Forwarding..." : `Forward (${selectedConvs.length})`}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ChatInfoModal({ conversation, onClose }) {
  if (!conversation) return null;
  const isGroup = conversation.type === "group";

  return (
    <div className="work-chat-modal-backdrop" role="dialog" aria-modal="true">
      <div className="work-chat-modal ui-card">
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
          <h3 className="font-bold text-sm text-[var(--color-text)]">
            {isGroup ? "Group info" : "Contact info"}
          </h3>
          <button type="button" onClick={onClose} aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-4 text-center border-b border-[var(--color-border-soft)]">
          <div className="work-chat-avatar mx-auto mb-2 text-lg h-14 w-14">{initials(conversation.name)}</div>
          <h4 className="font-bold text-base text-[var(--color-text)]">{conversation.name}</h4>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
            {isGroup ? `${conversation.members?.length || 0} members` : "Direct conversation"}
          </p>
          {conversation.description ? (
            <p className="text-xs text-[var(--color-text-muted)] mt-2 bg-[var(--color-surface-muted)] p-2 rounded-lg">
              {conversation.description}
            </p>
          ) : null}
        </div>
        <div className="p-4">
          <h5 className="text-xs font-bold text-[var(--color-text-muted)] uppercase mb-2">Members</h5>
          <ul className="max-h-48 overflow-y-auto space-y-2">
            {(conversation.members || []).map((m) => (
              <li key={m.id} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="work-chat-avatar work-chat-avatar--sm">{initials(m.full_name)}</span>
                  <span className="font-medium text-[var(--color-text)]">{m.full_name}</span>
                </div>
                {m.role === "admin" ? (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">Admin</span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function ThemeModal({ currentTheme, onSelect, onClose }) {
  const themes = [
    { id: "default", label: "Default Light", color: "#f8fafc" },
    { id: "whatsapp", label: "WhatsApp Doodle", color: "#efeae2" },
    { id: "emerald", label: "Emerald Soft", color: "#f0fdf4" },
    { id: "dark", label: "Dark Mode", color: "#0f172a" },
  ];

  return (
    <div className="work-chat-modal-backdrop" role="dialog" aria-modal="true">
      <div className="work-chat-modal ui-card">
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
          <h3 className="font-bold text-sm text-[var(--color-text)]">Select Chat Theme</h3>
          <button type="button" onClick={onClose} aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-4 grid grid-cols-2 gap-3">
          {themes.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`p-3 rounded-xl border text-left flex flex-col gap-2 transition-all ${
                currentTheme === t.id
                  ? "border-[var(--color-primary)] ring-2 ring-[var(--color-primary)]/20"
                  : "border-[var(--color-border)] hover:border-[var(--color-primary)]"
              }`}
              onClick={() => {
                onSelect(t.id);
                onClose();
              }}
            >
              <div
                className="h-10 w-full rounded-lg border border-black/10"
                style={{ backgroundColor: t.color }}
              />
              <span className="text-xs font-semibold text-[var(--color-text)]">{t.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ChatLockModal({ mode, conversation, onClose, onLockSuccess, onUnlockSuccess }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  if (!mode || !conversation) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    setErrorMsg("");

    if (mode === "set") {
      if (!password.trim()) {
        setErrorMsg("Please enter a password.");
        return;
      }
      if (password.length < 3) {
        setErrorMsg("Password must be at least 3 characters.");
        return;
      }
      if (password !== confirmPassword) {
        setErrorMsg("Passwords do not match.");
        return;
      }
      onLockSuccess(conversation.id, password.trim());
    } else if (mode === "enter" || mode === "unlock") {
      if (!password) {
        setErrorMsg("Please enter your password.");
        return;
      }
      if (mode === "enter") {
        onLockSuccess(conversation.id, password);
      } else {
        onUnlockSuccess(conversation.id, password);
      }
    }
  };

  return (
    <div className="work-chat-modal-backdrop" role="dialog" aria-modal="true">
      <div className="work-chat-modal ui-card max-w-sm">
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
          <h3 className="font-bold text-sm text-[var(--color-text)] flex items-center gap-2">
            <Lock className="h-4 w-4 text-amber-500" />
            {mode === "set" ? "Lock Chat with Password" : mode === "unlock" ? "Unlock & Remove Password" : "Enter Chat Password"}
          </h3>
          <button type="button" onClick={onClose} aria-label="Close">
            <X className="h-5 w-5 text-[var(--color-text-muted)] hover:text-[var(--color-text)]" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <p className="text-xs text-[var(--color-text-muted)]">
            {mode === "set"
              ? `Create a password to lock "${conversation.name}".`
              : mode === "unlock"
              ? `Enter password to remove lock for "${conversation.name}".`
              : `"${conversation.name}" is locked. Enter password to access.`}
          </p>

          {errorMsg && (
            <div className="p-2.5 text-xs rounded-lg bg-red-50 text-red-700 border border-red-200">
              {errorMsg}
            </div>
          )}

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-[var(--color-text)] mb-1">
                {mode === "set" ? "Set Password" : "Password"}
              </label>
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password..."
                  className="w-full px-3 py-2 pr-10 border border-[var(--color-border)] rounded-lg text-sm bg-[var(--color-surface)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                  autoFocus
                />
                <button
                  type="button"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                  onClick={() => setShowPass((p) => !p)}
                >
                  {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {mode === "set" && (
              <div>
                <label className="block text-xs font-semibold text-[var(--color-text)] mb-1">
                  Confirm Password
                </label>
                <input
                  type={showPass ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm password..."
                  className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm bg-[var(--color-surface)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                />
              </div>
            )}
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              {mode === "set" ? "Lock Chat" : mode === "unlock" ? "Unlock Chat" : "Access Chat"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ChatLockedPlaceholder({ conversation, onUnlockClick }) {
  const [inputPass, setInputPass] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");

  const handleUnlock = (e) => {
    e.preventDefault();
    if (!inputPass) {
      setError("Please enter password.");
      return;
    }
    const success = onUnlockClick(inputPass);
    if (!success) {
      setError("Incorrect password. Access denied.");
    }
  };

  return (
    <div className="work-chat-empty work-chat-empty--tall flex flex-col items-center justify-center p-8 text-center bg-[var(--color-surface)] rounded-2xl m-4 border border-[var(--color-border-soft)] shadow-sm">
      <div className="p-4 rounded-full bg-amber-50 text-amber-600 mb-4 ring-8 ring-amber-50/50">
        <Lock className="h-10 w-10" />
      </div>
      <h3 className="font-bold text-lg text-[var(--color-text)] mb-1">
        {conversation?.name || "Chat"} is Locked
      </h3>
      <p className="text-xs text-[var(--color-text-muted)] max-w-xs mb-6">
        This conversation is password protected. Enter the password below to view messages.
      </p>

      <form onSubmit={handleUnlock} className="w-full max-w-xs space-y-3">
        {error && (
          <p className="text-xs text-red-600 bg-red-50 p-2 rounded border border-red-200">
            {error}
          </p>
        )}
        <div className="relative">
          <input
            type={showPass ? "text" : "password"}
            value={inputPass}
            onChange={(e) => {
              setInputPass(e.target.value);
              setError("");
            }}
            placeholder="Enter chat password..."
            className="w-full px-3 py-2 pr-10 border border-[var(--color-border)] rounded-lg text-sm bg-[var(--color-surface)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            autoFocus
          />
          <button
            type="button"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            onClick={() => setShowPass((p) => !p)}
          >
            {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <Button type="submit" variant="primary" className="w-full">
          Unlock Conversation
        </Button>
      </form>
    </div>
  );
}

export default function WorkChat() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [conversations, setConversations] = useState([]);
  const [convSearch, setConvSearch] = useState("");
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [composer, setComposer] = useState("");
  const [mobileView, setMobileView] = useState("list");
  const [showNewDirect, setShowNewDirect] = useState(false);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [userQuery, setUserQuery] = useState("");
  const [userHits, setUserHits] = useState([]);
  const [groupName, setGroupName] = useState("");
  const [groupMembers, setGroupMembers] = useState([]);
  const [pendingFiles, setPendingFiles] = useState([]);
  const [sending, setSending] = useState(false);
  const [lightbox, setLightbox] = useState(null);
  const [forwardingMsg, setForwardingMsg] = useState(null);
  const [activeEmojiPickerId, setActiveEmojiPickerId] = useState(null);
  const [showMenu, setShowMenu] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [chatTheme, setChatTheme] = useState("default");
  const [showSearchThread, setShowSearchThread] = useState(false);
  const [threadQuery, setThreadQuery] = useState("");
  const [selectMode, setSelectMode] = useState(false);
  const [selectedMsgIds, setSelectedMsgIds] = useState(new Set());
  const [mutedConvs, setMutedConvs] = useState(new Set());
  const [lockedPasswords, setLockedPasswords] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("smrt-chat-locked-passwords") || "{}");
    } catch {
      return {};
    }
  });
  const [unlockedConvs, setUnlockedConvs] = useState(new Set());
  const [lockModal, setLockModal] = useState({ open: false, mode: "set", convId: null });
  const [favConvs, setFavConvs] = useState(new Set());

  const saveLockedPasswords = (newPasswords) => {
    setLockedPasswords(newPasswords);
    try {
      localStorage.setItem("smrt-chat-locked-passwords", JSON.stringify(newPasswords));
    } catch {}
  };

  const lockedConvs = useMemo(() => {
    return new Set(Object.keys(lockedPasswords).map(Number));
  }, [lockedPasswords]);

  const bottomRef = useRef(null);
  const pollRef = useRef(null);
  const menuRef = useRef(null);

  const activeConv = useMemo(
    () => conversations.find((c) => c.id === activeId) || null,
    [conversations, activeId]
  );

  const sortedConversations = useMemo(() => {
    return [...conversations].sort((a, b) => {
      const aFav = favConvs.has(a.id) ? 1 : 0;
      const bFav = favConvs.has(b.id) ? 1 : 0;
      return bFav - aFav;
    });
  }, [conversations, favConvs]);

  const loadConversations = useCallback(async () => {
    try {
      const data = await listConversations({ search: convSearch || undefined });
      setConversations(data?.items || []);
    } catch {
      addToast("Could not load conversations.", "error");
    } finally {
      setLoading(false);
    }
  }, [convSearch, addToast]);

  const loadMessages = useCallback(
    async (conversationId, beforeId = null, append = false) => {
      const data = await listMessages(conversationId, {
        before_id: beforeId || undefined,
        limit: 50,
      });
      const items = data?.items || [];
      setHasMore(Boolean(data?.has_more));
      setMessages((prev) => (append ? [...items, ...prev] : items));
      if (items.length) {
        const last = items[items.length - 1];
        markConversationRead(conversationId, last.id).catch(() => {});
      }
    },
    []
  );

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (showNewDirect || showNewGroup) {
      searchChatUsers(userQuery)
        .then((data) => setUserHits(data?.items || []))
        .catch(() => {});
    }
  }, [showNewDirect, showNewGroup, userQuery]);

  useEffect(() => {
    const cid = Number(searchParams.get("conversation"));
    if (cid) {
      setActiveId(cid);
      setMobileView("chat");
    }
  }, [searchParams]);

  useEffect(() => {
    if (!activeId) return;
    setMessages([]);
    setShowMenu(false);
    setShowSearchThread(false);
    setSelectMode(false);
    setSelectedMsgIds(new Set());

    if (lockedConvs.has(activeId) && !unlockedConvs.has(activeId)) {
      setLockModal({ open: true, mode: "enter", convId: activeId });
    } else {
      loadMessages(activeId).catch(() => addToast("Could not load messages.", "error"));
    }

    setSearchParams((p) => {
      const next = new URLSearchParams(p);
      next.set("conversation", String(activeId));
      return next;
    });
  }, [activeId, loadMessages, addToast, setSearchParams, lockedConvs, unlockedConvs]);

  useEffect(() => {
    if (!activeId) return;
    if (lockedConvs.has(activeId) && !unlockedConvs.has(activeId)) return;

    pollRef.current = window.setInterval(() => {
      loadMessages(activeId).catch(() => {});
      loadConversations();
    }, 12000);
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, [activeId, loadMessages, loadConversations, lockedConvs, unlockedConvs]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredMessages = useMemo(() => {
    if (!threadQuery.trim()) return messages;
    const term = threadQuery.toLowerCase().trim();
    return messages.filter(
      (m) =>
        m.body?.toLowerCase().includes(term) ||
        m.attachments?.some((a) => a.filename?.toLowerCase().includes(term))
    );
  }, [messages, threadQuery]);

  const selectConversation = (id) => {
    setUnlockedConvs(new Set());
    setActiveId(id);
    setMobileView("chat");
  };

  const handleDownloadFile = async (fileId, filename, initialUrl = null) => {
    const targetId = fileId;
    let attempts = 0;
    let currentUrl = initialUrl;

    while (attempts < 3) {
      try {
        if (!currentUrl) {
          if (!targetId) {
            throw new Error("File ID is missing.");
          }
          const res = await getDownloadUrl(targetId);
          currentUrl = res?.download_url;
        }

        if (!currentUrl) {
          throw new Error("No download URL available.");
        }

        const isExternalCloud =
          (currentUrl.startsWith("http://") || currentUrl.startsWith("https://")) &&
          !currentUrl.includes("/api/files/");

        if (isExternalCloud) {
          try {
            const cloudRes = await fetch(currentUrl);
            if (cloudRes.ok) {
              const blob = await cloudRes.blob();
              const blobUrl = URL.createObjectURL(blob);
              const link = document.createElement("a");
              link.href = blobUrl;
              link.download = filename || "download";
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
              return;
            }
          } catch {
            /* Fall back to direct window/link opening if fetch fails due to CORS */
          }
          const link = document.createElement("a");
          link.href = currentUrl;
          link.download = filename || "download";
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          return;
        }

        // Internal API endpoint — attempt authenticated blob download via axios
        const resolvedUrl = resolveUploadUrl(currentUrl);
        const downloadRes = await api.get(resolvedUrl, { responseType: "blob", skipCache: true });

        if (downloadRes?.data) {
          const blobData = downloadRes.data;

          // Check if server returned a JSON error response wrapped in Blob
          if (blobData.type === "application/json" || (blobData instanceof Blob && blobData.type?.includes("json"))) {
            const text = await blobData.text();
            let errorMessage = "Download failed.";
            try {
              const parsed = JSON.parse(text);
              errorMessage = parsed.detail || parsed.message || errorMessage;
            } catch {
              /* ignore parse error */
            }
            throw new Error(errorMessage);
          }

          const blobUrl = URL.createObjectURL(blobData);
          const link = document.createElement("a");
          link.href = blobUrl;
          link.download = filename || "download";
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
          return;
        }

        throw new Error("Invalid response received during file download.");
      } catch (err) {
        console.error("File download attempt failed:", err);
        // If initialUrl or currentUrl failed, clear it so next attempt fetches a fresh token
        currentUrl = null;
        attempts += 1;
        if (attempts >= 3) {
          const msg = apiErrorMessage(err, err?.message || "Failed to download file.");
          addToast(msg, "error");
          break;
        }
        await new Promise((r) => setTimeout(r, 400));
      }
    }
  };

  const handleToggleReaction = async (messageId, emoji) => {
    try {
      const updatedMsg = await toggleChatMessageReaction(messageId, emoji);
      setMessages((prev) =>
        prev.map((msg) => (msg.id === messageId ? { ...msg, reactions: updatedMsg.reactions } : msg))
      );
    } catch {
      addToast("Could not update reaction.", "error");
    }
  };

  const handleForward = async (messageId, targetConversationIds) => {
    try {
      const res = await forwardChatMessage(messageId, targetConversationIds);
      addToast(
        `Forwarded to ${res.forwarded_count || targetConversationIds.length} conversation(s).`,
        "success"
      );
      loadConversations();
    } catch {
      addToast("Could not forward message.", "error");
    }
  };

  const handleExportChat = async () => {
    if (!activeConv) return;
    try {
      setShowMenu(false);
      addToast("Preparing chat export...", "info");

      // Fetch complete thread messages (paginate up to 1000 items)
      let allMsgs = [];
      let beforeId = null;
      let hasMoreMsgs = true;
      let fetches = 0;

      while (hasMoreMsgs && fetches < 10) {
        fetches += 1;
        const res = await listMessages(activeConv.id, {
          before_id: beforeId || undefined,
          limit: 100,
        });
        const items = res?.items || [];
        if (!items.length) break;
        allMsgs = [...items, ...allMsgs];
        beforeId = items[0].id;
        hasMoreMsgs = Boolean(res?.has_more);
      }

      // Fall back to current messages state if fetch empty
      const messagesToExport = allMsgs.length ? allMsgs : messages;

      const lines = [
        `==================================================`,
        `WORK CHAT TRANSCRIPT: ${activeConv.name || "Conversation"}`,
        `Exported at: ${new Date().toLocaleString()}`,
        `Total messages: ${messagesToExport.length}`,
        `==================================================\n`,
      ];

      messagesToExport.forEach((m) => {
        const time = formatTime(m.created_at);
        const senderName = m.sender?.full_name || "User";
        const text = m.body || "";
        const atts = m.attachments?.map((a) => `[Attachment: ${a.filename || "file"}]`).join(" ") || "";
        const reactions = m.reactions?.map((r) => `${r.emoji} (${r.users?.length || 1})`).join(" ") || "";
        lines.push(`[${time}] ${senderName}: ${text} ${atts} ${reactions ? `{Reactions: ${reactions}}` : ""}`.trim());
      });

      const safeName = String(activeConv.name || "Chat")
        .replace(/[/\\?%*:|"<>]/g, "_")
        .replace(/\s+/g, "_");
      const dateStr = new Date().toISOString().slice(0, 10);
      const filename = `WorkChat_${safeName}_${dateStr}.txt`;

      const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 2500);

      addToast("Chat transcript downloaded successfully.", "success");
    } catch (err) {
      console.error("Export chat error:", err);
      addToast("Failed to export chat transcript.", "error");
    }
  };

  const toggleMute = () => {
    if (!activeId) return;
    setMutedConvs((prev) => {
      const next = new Set(prev);
      if (next.has(activeId)) {
        next.delete(activeId);
        addToast("Notifications unmuted for this chat.", "info");
      } else {
        next.add(activeId);
        addToast("Notifications muted for this chat.", "info");
      }
      return next;
    });
    setShowMenu(false);
  };

  const handleLockSuccess = (convId, password) => {
    if (lockModal.mode === "set") {
      const next = { ...lockedPasswords, [convId]: password };
      saveLockedPasswords(next);
      setUnlockedConvs((prev) => {
        const set = new Set(prev);
        set.delete(convId);
        return set;
      });
      addToast("Chat locked with password.", "success");
      setLockModal({ open: true, mode: "enter", convId });
    } else if (lockModal.mode === "enter") {
      if (lockedPasswords[convId] === password) {
        setUnlockedConvs((prev) => new Set(prev).add(convId));
        addToast("Access granted.", "success");
        setLockModal({ open: false, mode: "enter", convId: null });
        loadMessages(convId).catch(() => {});
      } else {
        addToast("Incorrect password.", "error");
      }
    }
  };

  const handleUnlockSuccess = (convId, password) => {
    if (lockedPasswords[convId] === password) {
      const next = { ...lockedPasswords };
      delete next[convId];
      saveLockedPasswords(next);
      setUnlockedConvs((prev) => {
        const set = new Set(prev);
        set.delete(convId);
        return set;
      });
      addToast("Chat lock removed successfully.", "info");
      setLockModal({ open: false, mode: "unlock", convId: null });
    } else {
      addToast("Incorrect password.", "error");
    }
  };

  const toggleLock = () => {
    if (!activeId) return;
    setShowMenu(false);
    if (lockedConvs.has(activeId)) {
      setLockModal({ open: true, mode: "unlock", convId: activeId });
    } else {
      setLockModal({ open: true, mode: "set", convId: activeId });
    }
  };

  const handlePlaceholderUnlock = (pass) => {
    if (!activeId) return false;
    if (lockedPasswords[activeId] === pass) {
      setUnlockedConvs((prev) => new Set(prev).add(activeId));
      addToast("Access granted.", "success");
      loadMessages(activeId).catch(() => {});
      return true;
    }
    return false;
  };

  const toggleFav = () => {
    if (!activeId) return;
    setFavConvs((prev) => {
      const next = new Set(prev);
      if (next.has(activeId)) {
        next.delete(activeId);
        addToast("Removed from favourites.", "info");
      } else {
        next.add(activeId);
        addToast("Added to favourites.", "success");
      }
      return next;
    });
    setShowMenu(false);
  };

  const handleClearChat = () => {
    if (window.confirm("Are you sure you want to clear all messages in this conversation?")) {
      setMessages([]);
      setShowMenu(false);
      addToast("Chat cleared.", "info");
    }
  };

  const handleDeleteOrExitChat = () => {
    const isGroup = activeConv?.type === "group";
    const title = isGroup ? "Exit group" : "Delete chat";
    if (window.confirm(`Are you sure you want to ${title.toLowerCase()}?`)) {
      setConversations((prev) => prev.filter((c) => c.id !== activeId));
      setActiveId(null);
      setMobileView("list");
      setShowMenu(false);
      addToast(`${title} completed.`, "info");
    }
  };

  const handleSend = async () => {
    if (!activeId || sending) return;
    const text = composer.trim();
    if (!text && !pendingFiles.length) return;
    setSending(true);
    try {
      const fileIds = [];
      for (const file of pendingFiles) {
        const normalized = ensureFileHasName(file, "attachment");
        const err = validateFileClient(normalized, 25 * 1024 * 1024);
        if (err) throw new Error(err);
        const fileId = await uploadFileThroughPipeline(normalized, {
          entityType: "work_chat_message",
          maxBytes: 25 * 1024 * 1024,
        });
        fileIds.push(fileId);
      }
      const msg = await sendMessage(activeId, {
        body: text,
        attachment_file_ids: fileIds,
      });
      setComposer("");
      setPendingFiles([]);
      setMessages((prev) => [...prev, msg]);
      loadConversations();
    } catch (e) {
      addToast(
        e?.message && !String(e.message).includes("status code")
          ? e.message
          : uploadErrorMessage(e, apiErrorMessage(e, "Failed to send message.")),
        "error"
      );
    } finally {
      setSending(false);
    }
  };

  const startDirect = async (userId) => {
    try {
      const conv = await openDirectChat(userId);
      setShowNewDirect(false);
      setUserQuery("");
      await loadConversations();
      selectConversation(conv.id);
    } catch {
      addToast("Could not start chat.", "error");
    }
  };

  const submitGroup = async () => {
    if (!groupName.trim()) return;
    try {
      const conv = await createGroupChat({
        name: groupName.trim(),
        member_ids: groupMembers,
      });
      setShowNewGroup(false);
      setGroupName("");
      setGroupMembers([]);
      await loadConversations();
      selectConversation(conv.id);
    } catch {
      addToast("Could not create group.", "error");
    }
  };

  const onComposerKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <ListPageShell stackClassName="work-chat-page pb-6">
      <header className="work-chat-page__head">
        <div>
          <h1 className="work-chat-page__title">Work Chat</h1>
          <p className="work-chat-page__sub">Message your team without leaving the ERP.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={() => setShowNewDirect(true)}>
            <Plus className="mr-1 h-4 w-4" /> New chat
          </Button>
          <Button type="button" variant="primary" onClick={() => setShowNewGroup(true)}>
            <Users className="mr-1 h-4 w-4" /> New group
          </Button>
        </div>
      </header>

      <div className="work-chat-layout">
        <aside
          className={`work-chat-panel work-chat-panel--list ${
            mobileView === "chat" ? "work-chat-panel--hidden-mobile" : ""
          }`}
          aria-label="Conversations"
        >
          <div className="work-chat-panel__search">
            <SearchBar
              value={convSearch}
              onChange={setConvSearch}
              placeholder="Search conversations..."
              aria-label="Search conversations"
            />
          </div>
          {loading ? (
            <div className="p-6"><Loader /></div>
          ) : conversations.length === 0 ? (
            <div className="work-chat-empty">
              <MessageSquare className="h-8 w-8 text-[var(--color-text-icon)]" aria-hidden />
              <p className="font-semibold text-[var(--color-text)]">No conversations yet</p>
              <p className="text-sm text-[var(--color-text-muted)]">Start a conversation with your team.</p>
            </div>
          ) : (
            <ul className="work-chat-conv-list" role="list">
              {sortedConversations.map((c) => {
                const isFav = favConvs.has(c.id);
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      className={`work-chat-conv-item ${c.id === activeId ? "work-chat-conv-item--active" : ""}`}
                      onClick={() => selectConversation(c.id)}
                    >
                      <span className="work-chat-avatar" aria-hidden>{initials(c.name)}</span>
                      <span className="min-w-0 flex-1 text-left">
                        <span className="flex items-center justify-between gap-2">
                          <span className="truncate font-semibold text-sm text-[var(--color-text)] flex items-center gap-1">
                            {c.name}
                            {lockedConvs.has(c.id) ? <Lock className="h-3.5 w-3.5 text-amber-500 inline shrink-0" title="Locked chat" /> : null}
                            {isFav ? <Heart className="h-3 w-3 fill-red-500 text-red-500 inline shrink-0" /> : null}
                          </span>
                          <span className="shrink-0 text-[11px] text-[var(--color-text-muted)]">
                            {formatTime(c.last_message_at)}
                          </span>
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-[var(--color-text-muted)]">
                          {c.last_message_preview || "No messages yet"}
                        </span>
                      </span>
                      {c.unread_count > 0 ? (
                        <span className="work-chat-unread" aria-label={`${c.unread_count} unread`}>
                          {c.unread_count > 99 ? "99+" : c.unread_count}
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>

        <section
          className={`work-chat-panel work-chat-panel--main ${
            mobileView === "list" ? "work-chat-panel--hidden-mobile" : ""
          }`}
          aria-label="Message thread"
        >
          {!activeConv ? (
            <div className="work-chat-empty work-chat-empty--tall">
              <MessageSquare className="h-10 w-10 text-[var(--color-primary)]" aria-hidden />
              <p className="font-semibold">Select a conversation</p>
              <p className="text-sm text-[var(--color-text-muted)]">Choose a chat or start a new one.</p>
            </div>
          ) : (
            <>
              {/* Thread Header with Search & 3-Dots Dropdown Menu matching user screenshots */}
              <div className="work-chat-thread-head">
                <button
                  type="button"
                  className="work-chat-back md:hidden"
                  onClick={() => setMobileView("list")}
                >
                  Back
                </button>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-base font-bold text-[var(--color-text)] flex items-center gap-1.5">
                    {activeConv.name}
                    {mutedConvs.has(activeConv.id) ? (
                      <BellOff className="h-3.5 w-3.5 text-[var(--color-text-muted)]" title="Muted" />
                    ) : null}
                    {lockedConvs.has(activeConv.id) ? (
                      <Lock className="h-3.5 w-3.5 text-amber-500" title="Locked" />
                    ) : null}
                  </h2>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    {activeConv.type === "group" ? `${activeConv.members?.length || 0} members` : "Direct message"}
                  </p>
                </div>

                {/* Search & 3-Dots Menu Container */}
                <div className="work-chat-thread-actions" ref={menuRef}>
                  <button
                    type="button"
                    className={`work-chat-header-btn ${showSearchThread ? "work-chat-header-btn--active" : ""}`}
                    title="Search in chat"
                    onClick={() => setShowSearchThread((p) => !p)}
                  >
                    <Search className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    className={`work-chat-header-btn ${showMenu ? "work-chat-header-btn--active" : ""}`}
                    aria-label="More options"
                    onClick={() => setShowMenu((p) => !p)}
                  >
                    <MoreVertical className="h-5 w-5" />
                  </button>

                  {/* 3-Dots Dropdown Menu matching media_1790835673402.png and media_1790835813820.png */}
                  {showMenu && (
                    <div className="work-chat-dropdown-menu" role="menu">
                      <button
                        type="button"
                        className="work-chat-dropdown-item"
                        onClick={() => {
                          setShowInfoModal(true);
                          setShowMenu(false);
                        }}
                      >
                        <Info className="h-4 w-4 text-[var(--color-primary)]" />
                        <span>{activeConv.type === "group" ? "Group info" : "Contact info"}</span>
                      </button>

                      <button
                        type="button"
                        className="work-chat-dropdown-item"
                        onClick={() => {
                          setShowSearchThread(true);
                          setShowMenu(false);
                        }}
                      >
                        <Search className="h-4 w-4" />
                        <span>Search</span>
                      </button>

                      <button
                        type="button"
                        className="work-chat-dropdown-item"
                        onClick={() => {
                          setSelectMode((p) => !p);
                          setShowMenu(false);
                        }}
                      >
                        <CheckSquare className="h-4 w-4" />
                        <span>{selectMode ? "Exit select mode" : "Select messages"}</span>
                      </button>

                      <button type="button" className="work-chat-dropdown-item" onClick={toggleMute}>
                        <BellOff className="h-4 w-4" />
                        <span>{mutedConvs.has(activeConv.id) ? "Unmute notifications" : "Mute notifications"}</span>
                      </button>

                      <button type="button" className="work-chat-dropdown-item" onClick={toggleLock}>
                        <Lock className="h-4 w-4" />
                        <span>{lockedConvs.has(activeConv.id) ? "Unlock chat" : "Lock chat"}</span>
                      </button>

                      <button
                        type="button"
                        className="work-chat-dropdown-item"
                        onClick={() => {
                          setShowThemeModal(true);
                          setShowMenu(false);
                        }}
                      >
                        <Palette className="h-4 w-4" />
                        <span>Chat theme</span>
                      </button>

                      <button type="button" className="work-chat-dropdown-item" onClick={toggleFav}>
                        <Heart className="h-4 w-4 text-red-500" />
                        <span>{favConvs.has(activeConv.id) ? "Remove favourite" : "Add to favourites"}</span>
                      </button>

                      <button type="button" className="work-chat-dropdown-item" onClick={handleExportChat}>
                        <Download className="h-4 w-4" />
                        <span>Export chat</span>
                      </button>

                      <button
                        type="button"
                        className="work-chat-dropdown-item"
                        onClick={() => {
                          setActiveId(null);
                          setMobileView("list");
                          setShowMenu(false);
                        }}
                      >
                        <XCircle className="h-4 w-4" />
                        <span>Close chat</span>
                      </button>

                      <div className="work-chat-dropdown-divider" />

                      <button type="button" className="work-chat-dropdown-item" onClick={handleClearChat}>
                        <MinusCircle className="h-4 w-4 text-amber-500" />
                        <span>Clear chat</span>
                      </button>

                      <button
                        type="button"
                        className="work-chat-dropdown-item work-chat-dropdown-item--danger"
                        onClick={handleDeleteOrExitChat}
                      >
                        {activeConv.type === "group" ? (
                          <>
                            <LogOut className="h-4 w-4" />
                            <span>Exit group</span>
                          </>
                        ) : (
                          <>
                            <Trash2 className="h-4 w-4" />
                            <span>Delete chat</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {lockedConvs.has(activeConv.id) && !unlockedConvs.has(activeConv.id) ? (
                <ChatLockedPlaceholder
                  conversation={activeConv}
                  onUnlockClick={handlePlaceholderUnlock}
                />
              ) : (
                <>
                  {/* Inline Search in Chat Bar */}
                  {showSearchThread && (
                    <div className="p-2 border-b border-[var(--color-border-soft)] bg-[var(--color-surface-muted)] flex items-center gap-2">
                      <SearchBar
                        size="compact"
                        value={threadQuery}
                        onChange={setThreadQuery}
                        placeholder="Search in this chat..."
                        className="flex-1"
                        aria-label="Search in this chat"
                      />
                      <button
                        type="button"
                        className="p-1 rounded text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                        onClick={() => {
                          setShowSearchThread(false);
                          setThreadQuery("");
                        }}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  )}

                  {/* Select Messages Action Bar */}
                  {selectMode && (
                    <div className="work-chat-select-bar">
                      <span className="text-xs font-semibold text-[var(--color-text)]">
                        {selectedMsgIds.size} message(s) selected
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="text-xs font-semibold px-2.5 py-1 rounded bg-[var(--color-surface)] border border-[var(--color-border)] hover:bg-[var(--color-surface-muted)]"
                          onClick={() => setSelectMode(false)}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Thread Messages List */}
                  <div
                    className={`work-chat-messages work-chat-messages--${chatTheme}`}
                    role="log"
                    aria-live="polite"
                  >
                    {hasMore ? (
                      <button
                        type="button"
                        className="work-chat-load-more"
                        onClick={() => loadMessages(activeId, messages[0]?.id, true)}
                      >
                        Load earlier messages
                      </button>
                    ) : null}
                    {filteredMessages.length === 0 ? (
                      <p className="text-center text-sm text-[var(--color-text-muted)] py-8">
                        {threadQuery ? "No matching messages found." : "No messages yet. Start the conversation."}
                      </p>
                    ) : (
                      filteredMessages.map((m) => {
                        const own = m.sender?.id === user?.id;
                        const showPicker = activeEmojiPickerId === m.id;
                        const isSelected = selectedMsgIds.has(m.id);

                        return (
                          <div key={m.id} className={`work-chat-bubble-row ${own ? "work-chat-bubble-row--own" : ""}`}>
                            {selectMode ? (
                              <input
                                type="checkbox"
                                className="mr-2 self-center h-4 w-4 accent-[var(--color-primary)]"
                                checked={isSelected}
                                onChange={() => {
                                  setSelectedMsgIds((prev) => {
                                    const next = new Set(prev);
                                    if (next.has(m.id)) next.delete(m.id);
                                    else next.add(m.id);
                                    return next;
                                  });
                                }}
                              />
                            ) : null}
                            <div className="work-chat-bubble-container">
                              <div className={`work-chat-bubble ${own ? "work-chat-bubble--own" : ""}`}>
                                {!own ? (
                                  <p className="text-[11px] font-semibold text-[var(--color-primary)] mb-0.5">
                                    {m.sender?.full_name}
                                  </p>
                                ) : null}
                                {m.reply_to ? (
                                  <p className="work-chat-reply text-xs opacity-80 mb-1">{m.reply_to.body}</p>
                                ) : null}
                                {m.body ? (
                                  <p className="text-sm whitespace-pre-wrap break-words">{m.body}</p>
                                ) : null}
                                {m.links?.length ? (
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    {m.links.map((link) => (
                                      <Link
                                        key={`${link.entity_type}-${link.entity_id}`}
                                        to={link.path || "#"}
                                        className="work-chat-erp-link"
                                      >
                                        {link.label}
                                      </Link>
                                    ))}
                                  </div>
                                ) : null}
                                {m.attachments?.length ? (
                                  <div className="work-chat-attachments">
                                    {m.attachments.map((a) => (
                                      <WorkChatAttachmentItem
                                        key={a.file_id}
                                        attachment={a}
                                        own={own}
                                        onOpenLightbox={(url, filename, fileId) =>
                                          setLightbox({ url, filename, fileId })
                                        }
                                        onDownload={handleDownloadFile}
                                      />
                                    ))}
                                  </div>
                                ) : null}
                                {m.reactions?.length ? (
                                  <div className="work-chat-reactions">
                                    {m.reactions.map((r) => (
                                      <button
                                        key={r.emoji}
                                        type="button"
                                        className={`work-chat-reaction-badge ${
                                          r.reacted ? "work-chat-reaction-badge--active" : ""
                                        }`}
                                        onClick={() => handleToggleReaction(m.id, r.emoji)}
                                        title={`${r.count} reaction(s)`}
                                      >
                                        <span>{r.emoji}</span>
                                        <span>{r.count}</span>
                                      </button>
                                    ))}
                                  </div>
                                ) : null}
                                <p className="mt-1 text-[10px] text-[var(--color-text-muted)]">{formatTime(m.created_at)}</p>
                              </div>

                              {/* Action Buttons matching reference style */}
                              {!m.is_deleted ? (
                                <div className={`work-chat-msg-actions ${showPicker ? "work-chat-msg-actions--active" : ""}`}>
                                  <button
                                    type="button"
                                    className="work-chat-msg-action-btn"
                                    title="Forward message"
                                    onClick={() => setForwardingMsg(m)}
                                  >
                                    <Forward className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    className="work-chat-msg-action-btn"
                                    title="React with emoji"
                                    onClick={() => setActiveEmojiPickerId(showPicker ? null : m.id)}
                                  >
                                    <Smile className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              ) : null}

                              {/* Emoji Quick Picker Popover */}
                              {showPicker ? (
                                <div className="work-chat-emoji-popover">
                                  {QUICK_EMOJIS.map((emoji) => (
                                    <button
                                      key={emoji}
                                      type="button"
                                      className="work-chat-emoji-opt"
                                      onClick={() => {
                                        handleToggleReaction(m.id, emoji);
                                        setActiveEmojiPickerId(null);
                                      }}
                                    >
                                      {emoji}
                                    </button>
                                  ))}
                                </div>
                              ) : null}
                            </div>
                          </div>
                        );
                      })
                    )}
                    <div ref={bottomRef} />
                  </div>

                  {pendingFiles.length ? (
                    <div className="work-chat-pending-files">
                      {pendingFiles.map((f, i) => (
                        <PendingFileChip
                          key={`${f.name}-${i}`}
                          file={f}
                          onRemove={() => setPendingFiles((p) => p.filter((_, j) => j !== i))}
                        />
                      ))}
                    </div>
                  ) : null}

                  <div className="work-chat-composer">
                    <label className="work-chat-attach-btn" title="Attach file">
                      <Paperclip className="h-4 w-4" aria-hidden />
                      <input
                        type="file"
                        className="sr-only"
                        multiple
                        onChange={(e) => {
                          const selected = Array.from(e.target.files || []);
                          if (selected.length) {
                            const renamed = selected.map((f) => ensureFileHasName(f, "attachment"));
                            setPendingFiles((p) => [...p, ...renamed]);
                          }
                          e.target.value = "";
                        }}
                      />
                    </label>
                    <textarea
                      className="work-chat-composer__input"
                      rows={1}
                      value={composer}
                      onChange={(e) => setComposer(e.target.value)}
                      onKeyDown={onComposerKeyDown}
                      onPaste={(e) => {
                        const imageFile = fileFromClipboardEvent(e);
                        if (!imageFile) return;
                        e.preventDefault();
                        setPendingFiles((p) => [...p, ensureFileHasName(imageFile, "pasted-image")]);
                      }}
                      placeholder="Write a message…"
                      aria-label="Message"
                    />
                    <button
                      type="button"
                      className="work-chat-send"
                      disabled={sending}
                      onClick={handleSend}
                      aria-label="Send message"
                    >
                      {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </section>
      </div>

      {(showNewDirect || showNewGroup) && (
        <div className="work-chat-modal-backdrop" role="dialog" aria-modal="true">
          <div className="work-chat-modal ui-card">
            <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
              <h3 className="font-bold">{showNewGroup ? "New group" : "New chat"}</h3>
              <button type="button" onClick={() => { setShowNewDirect(false); setShowNewGroup(false); }} aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              {showNewGroup ? (
                <input
                  className="ui-input w-full"
                  placeholder="Group name"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                />
              ) : null}
              <SearchBar
                size="compact"
                value={userQuery}
                onChange={setUserQuery}
                placeholder="Search users..."
                className="w-full"
                aria-label="Search users"
              />
              <ul className="max-h-48 overflow-y-auto">
                {userHits.map((u) => (
                  <li key={u.id}>
                    <button
                      type="button"
                      className="w-full px-2 py-2 text-left text-sm hover:bg-[var(--color-surface-muted)] rounded-lg"
                      onClick={() => {
                        if (showNewGroup) {
                          setGroupMembers((ids) => (ids.includes(u.id) ? ids : [...ids, u.id]));
                        } else {
                          startDirect(u.id);
                        }
                      }}
                    >
                      {u.full_name} <span className="text-[var(--color-text-muted)]">({u.email})</span>
                    </button>
                  </li>
                ))}
              </ul>
              {showNewGroup ? (
                <Button type="button" variant="primary" className="w-full" onClick={submitGroup}>
                  Create group ({groupMembers.length + 1} members)
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      )}

      <ImageLightbox
        lightbox={lightbox}
        onClose={() => setLightbox(null)}
        onDownload={handleDownloadFile}
      />

      <ForwardModal
        message={forwardingMsg}
        conversations={conversations}
        onClose={() => setForwardingMsg(null)}
        onForward={handleForward}
      />

      {showInfoModal && (
        <ChatInfoModal
          conversation={activeConv}
          onClose={() => setShowInfoModal(false)}
        />
      )}

      {showThemeModal && (
        <ThemeModal
          currentTheme={chatTheme}
          onSelect={setChatTheme}
          onClose={() => setShowThemeModal(false)}
        />
      )}

      {lockModal.open && (
        <ChatLockModal
          mode={lockModal.mode}
          conversation={conversations.find((c) => c.id === lockModal.convId) || activeConv}
          onClose={() => setLockModal({ open: false, mode: "set", convId: null })}
          onLockSuccess={handleLockSuccess}
          onUnlockSuccess={handleUnlockSuccess}
        />
      )}
    </ListPageShell>
  );
}
