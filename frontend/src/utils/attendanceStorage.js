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
    const idx = list.findIndex(
      (r) =>
        r.record_date === record.record_date &&
        (r.employee_id === record.employee_id || r.name === record.name)
    );
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...record };
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

/**
 * Get current user check-in session for today.
 */
export function getCheckInSession() {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const raw = localStorage.getItem(CHECKIN_SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);
    if (session && session.date === today) {
      return session;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Save check-in session state.
 */
export function saveCheckInSession(state) {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const data = {
      ...state,
      date: state.date || today,
    };
    localStorage.setItem(CHECKIN_SESSION_KEY, JSON.stringify(data));
    window.dispatchEvent(new Event("attendance-updated"));
  } catch {
    // Ignore storage failure
  }
}
