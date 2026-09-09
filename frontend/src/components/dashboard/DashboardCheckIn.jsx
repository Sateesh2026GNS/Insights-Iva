import { useCallback, useEffect, useState } from "react";
import { Clock, LogOut } from "lucide-react";

import useAuth from "../../hooks/useAuth";
import { useToast } from "../../context/ToastContext";
import { clockIn, clockOut } from "../../api/hrApi";
import {
  getCheckInSession,
  saveCheckInSession,
  saveLiveAttendanceRecord,
} from "../../utils/attendanceStorage";

function formatTimer(secs) {
  const s = Math.max(0, Number(secs) || 0);
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const remainingSecs = s % 60;
  return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(remainingSecs).padStart(2, "0")}`;
}

export default function DashboardCheckIn() {
  const { user } = useAuth();
  const { addToast } = useToast();

  const [checkedIn, setCheckedIn] = useState(false);
  const [startTs, setStartTs] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [checkedOut, setCheckedOut] = useState(false);
  const [checkInTime, setCheckInTime] = useState(null);
  const [checkOutTime, setCheckOutTime] = useState(null);
  const [formattedDuration, setFormattedDuration] = useState("");

  const syncState = useCallback(() => {
    if (!user) return;
    const session = getCheckInSession(user);
    if (session && session.checkedIn) {
      setCheckedIn(true);
      setCheckedOut(false);
      setStartTs(session.startTs);
      setCheckInTime(session.checkInTime || null);
      const diff = Math.max(0, Math.floor((Date.now() - session.startTs) / 1000));
      setElapsed(diff);
    } else if (session && session.checkedOut) {
      setCheckedIn(false);
      setCheckedOut(true);
      setStartTs(null);
      setElapsed(session.finalElapsed || 0);
      setCheckInTime(session.checkInTime || null);
      setCheckOutTime(session.checkOutTime || null);
      const secs = session.finalElapsed || 0;
      const h = Math.floor(secs / 3600);
      const m = Math.floor((secs % 3600) / 60);
      setFormattedDuration(`${String(h).padStart(2, "0")} hrs ${String(m).padStart(2, "0")} min`);
    } else {
      setCheckedIn(false);
      setCheckedOut(false);
      setStartTs(null);
      setElapsed(0);
      setCheckInTime(null);
      setCheckOutTime(null);
      setFormattedDuration("");
    }
  }, [user]);

  useEffect(() => {
    syncState();
    window.addEventListener("attendance-updated", syncState);
    return () => window.removeEventListener("attendance-updated", syncState);
  }, [syncState]);

  useEffect(() => {
    if (!checkedIn || !startTs) return undefined;
    const interval = window.setInterval(() => {
      const diff = Math.max(0, Math.floor((Date.now() - startTs) / 1000));
      setElapsed(diff);
    }, 1000);
    return () => window.clearInterval(interval);
  }, [checkedIn, startTs]);

  if (!user) return null;

  const displayName = user?.full_name || user?.name || "User";
  const displayRole = user?.role_name || user?.role || "Employee";

  const handleCheckIn = async () => {
    const now = Date.now();
    const today = new Date().toISOString().slice(0, 10);
    const timeStr = new Date(now).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });

    const empId =
      user?.employee_id ||
      user?.employee_code ||
      (user?.id ? `EMP-${String(user.id).padStart(3, "0")}` : user?.username === "admin" ? "EMP-001" : "EMP-001");
    const empName = displayName;
    const userCompany = user?.company_name || user?.tenant_name || user?.company_id || user?.tenant_id || "";

    setCheckedIn(true);
    setCheckedOut(false);
    setStartTs(now);
    setElapsed(0);
    setCheckInTime(timeStr);

    saveCheckInSession(
      {
        checkedIn: true,
        checkedOut: false,
        startTs: now,
        date: today,
        checkInTime: timeStr,
      },
      user
    );

    const empEmail =
      user?.email ||
      user?.mail ||
      (user?.username ? `${user.username.toLowerCase()}@iva.com` : `${empName.toLowerCase().replace(/\s+/g, ".")}@iva.com`);
    const empRole =
      user?.username === "admin" || user?.role === "Admin" || user?.role_name === "Admin"
        ? "Admin"
        : displayRole;

    saveLiveAttendanceRecord({
      employee_id: empId,
      name: empName,
      email: empEmail,
      role: empRole,
      department: user?.department || "General",
      company: userCompany,
      record_date: today,
      check_in: timeStr,
      check_out: null,
      working_hours: "00 hrs 00 min",
      status: "present",
    });

    try {
      await clockIn({
        employee_id: user?.employee_id || user?.id || null,
        record_date: today,
      });
    } catch {
      // Local state is authoritative
    }

    addToast(`Checked in successfully at ${timeStr}`, "success");
  };

  const handleCheckOut = async () => {
    const now = Date.now();
    const today = new Date().toISOString().slice(0, 10);
    const timeStr = new Date(now).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });

    const finalSecs = elapsed;
    const hoursPart = Math.floor(finalSecs / 3600);
    const minsPart = Math.floor((finalSecs % 3600) / 60);
    const duration = `${String(hoursPart).padStart(2, "0")} hrs ${String(minsPart).padStart(2, "0")} min`;

    const session = getCheckInSession(user);
    const inTime = session?.checkInTime || checkInTime || timeStr;
    const empId =
      user?.employee_id ||
      user?.employee_code ||
      (user?.id ? `EMP-${String(user.id).padStart(3, "0")}` : user?.username === "admin" ? "EMP-001" : "EMP-001");
    const empName = displayName;
    const empEmail =
      user?.email ||
      user?.mail ||
      (user?.username ? `${user.username.toLowerCase()}@iva.com` : `${empName.toLowerCase().replace(/\s+/g, ".")}@iva.com`);
    const empRole =
      user?.username === "admin" || user?.role === "Admin" || user?.role_name === "Admin"
        ? "Admin"
        : displayRole;
    const userCompany = user?.company_name || user?.tenant_name || user?.company_id || user?.tenant_id || "";

    setCheckedIn(false);
    setCheckedOut(true);
    setStartTs(null);
    setCheckOutTime(timeStr);
    setFormattedDuration(duration);

    saveCheckInSession(
      {
        checkedIn: false,
        checkedOut: true,
        finalElapsed: finalSecs,
        date: today,
        checkInTime: inTime,
        checkOutTime: timeStr,
      },
      user
    );

    saveLiveAttendanceRecord({
      employee_id: empId,
      name: empName,
      email: empEmail,
      role: empRole,
      department: user?.department || "General",
      company: userCompany,
      record_date: today,
      check_in: inTime,
      check_out: timeStr,
      working_hours: duration,
      status: "present",
    });

    try {
      await clockOut({
        employee_id: user?.employee_id || user?.id || null,
        record_date: today,
      });
    } catch {
      // Local state is authoritative
    }

    addToast(`Checked out at ${timeStr} (${duration})`, "success");
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-surface)] p-3.5 shadow-xs transition sm:flex-row sm:items-center sm:justify-between sm:p-4">
      {/* Left: Employee Info & Live Status */}
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
          <Clock className="h-5 w-5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-[var(--color-text)]">{displayName}</p>
            <span className="rounded bg-[var(--color-surface-muted)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--color-text-muted)]">
              {displayRole}
            </span>
          </div>
          {checkedIn ? (
            <p className="text-xs text-emerald-600 dark:text-emerald-400">
              Checked in today at {checkInTime || "—"}
            </p>
          ) : checkedOut ? (
            <p className="text-xs text-[var(--color-text-muted)]">
              Shift completed • In: {checkInTime || "—"} | Out: {checkOutTime || "—"} ({formattedDuration})
            </p>
          ) : (
            <p className="text-xs text-[var(--color-text-muted)]">
              Not checked in yet today • Click Check In to start your work shift
            </p>
          )}
        </div>
      </div>

      {/* Right: Actions & Live Timer */}
      <div className="flex flex-wrap items-center gap-3 sm:justify-end">
        {checkedIn ? (
          <>
            <div className="flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
              </span>
              <span className="font-mono text-xs tabular-nums">{formatTimer(elapsed)}</span>
            </div>

            <button
              type="button"
              onClick={handleCheckOut}
              className="inline-flex items-center gap-2 rounded-full bg-rose-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700 active:scale-95"
            >
              <LogOut className="h-4 w-4" />
              <span>Check Out</span>
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={handleCheckIn}
            className="inline-flex items-center gap-2 rounded-full bg-[#15803d] px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#166534] active:scale-95"
          >
            <span className="grid h-5 w-5 place-items-center rounded-full border border-white/40 bg-white/20">
              <Clock className="h-3 w-3 text-white" />
            </span>
            <span>Check In</span>
          </button>
        )}
      </div>
    </div>
  );
}
