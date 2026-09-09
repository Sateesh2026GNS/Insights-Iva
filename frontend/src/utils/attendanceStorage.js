const ATTENDANCE_STORAGE_KEY = "iva_live_attendance_records";
const CHECKIN_SESSION_KEY = "iva_checkin_state";

/**
 * Get all stored live attendance records.
 */
export function getLiveAttendanceRecords() {
  try {
    const raw = localStorage.getItem(ATTENDANCE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Upsert an attendance record by record_date and employee_id or name.
 */
export function saveLiveAttendanceRecord(record) {
  try {
    const list = getLiveAttendanceRecords();
    const recId = String(record.employee_id || "").trim().toLowerCase();
    const recName = String(record.name || record.full_name || "").trim().toLowerCase();

    const idx = list.findIndex((r) => {
      if (r.record_date !== record.record_date) return false;
      const rId = String(r.employee_id || r.employee_code || "").trim().toLowerCase();
      const rName = String(r.name || r.full_name || "").trim().toLowerCase();
      if (rId && recId && rId === recId) return true;
      if (rName && recName && rName === recName) return true;
      if (rName === "admin" && (recName === "admin" || recId.includes("admin"))) return true;
      return false;
    });

    if (idx >= 0) {
      list[idx] = {
        ...list[idx],
        ...record,
        check_in: record.check_in || list[idx].check_in,
        check_out: record.check_out || list[idx].check_out,
        working_hours: record.working_hours || list[idx].working_hours,
      };
    } else {
      list.unshift({
        id: `att_${Date.now()}`,
        ...record,
      });
    }
    localStorage.setItem(ATTENDANCE_STORAGE_KEY, JSON.stringify(list));
    window.dispatchEvent(new Event("attendance-updated"));
  } catch {
    // Ignore storage failure
  }
}

function getUserKey(user) {
  if (!user) return "default";
  return String(user.id || user.employee_id || user.email || user.username || "default");
}

/**
 * Get current user check-in session for today.
 */
export function getCheckInSession(user) {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const uKey = getUserKey(user);
    const raw =
      localStorage.getItem(`${CHECKIN_SESSION_KEY}_${uKey}`) ||
      localStorage.getItem(CHECKIN_SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);
    if (session && session.date === today) {
      if (user && session.userKey && session.userKey !== uKey) {
        return null;
      }
      return session;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Save check-in session state for a user.
 */
export function saveCheckInSession(state, user) {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const uKey = getUserKey(user);
    const data = {
      ...state,
      userKey: uKey,
      date: state.date || today,
    };
    localStorage.setItem(`${CHECKIN_SESSION_KEY}_${uKey}`, JSON.stringify(data));
    localStorage.setItem(CHECKIN_SESSION_KEY, JSON.stringify(data));
    window.dispatchEvent(new Event("attendance-updated"));
  } catch {
    // Ignore storage failure
  }
}
