/**
 * useMeetingNotifications
 *
 * Requests browser notification permission and fires a notification
 * (+ in-app toast) when a meeting is about to start.
 *
 * Logic:
 *  - Checks meetings every 60 s.
 *  - Fires at: reminder_minutes before start (default 10 min).
 *  - Also fires at exactly start time ("Starting now").
 *  - Tracks fired notifications in a ref so they don't repeat.
 */

import { useEffect, useRef } from "react";

const DEFAULT_REMIND_MINUTES = 10;

function getTodayDateStr() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getMeetingStartMs(meeting) {
  const dateStr = meeting.meeting_date;
  const timeStr = meeting.start_time?.slice(0, 5) || "00:00";
  if (!dateStr) return null;
  const [h, min] = timeStr.split(":").map(Number);
  const d = new Date(`${dateStr}T00:00:00`);
  d.setHours(h, min, 0, 0);
  return d.getTime();
}

function fireNotification(title, body, meetUrl) {
  if (typeof window === "undefined") return;
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  try {
    const n = new Notification(title, {
      body,
      icon: "/favicon.ico",
      tag: title, // deduplicates same-title notifications
    });
    if (meetUrl) {
      n.onclick = () => {
        window.open(meetUrl, "_blank", "noopener,noreferrer");
        n.close();
      };
    }
  } catch {
    // some browsers (Firefox on Windows) throw on new Notification()
  }
}

export default function useMeetingNotifications(meetings, addToast) {
  // fired set: "meetingId-type" e.g. "5-remind" | "5-start"
  const firedRef = useRef(new Set());

  useEffect(() => {
    if (!("Notification" in window)) return;
    if (Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (!meetings || meetings.length === 0) return;

    const check = () => {
      const now = Date.now();
      const todayStr = getTodayDateStr();

      meetings.forEach((meeting) => {
        const startMs = getMeetingStartMs(meeting);
        if (!startMs) return;

        // Only notify for today's or upcoming meetings (up to 1 day ahead)
        if (startMs < now - 60_000 || startMs > now + 24 * 60 * 60 * 1000) return;

        const minutesUntil = Math.round((startMs - now) / 60_000);
        const remindAt = meeting.reminder_minutes ?? DEFAULT_REMIND_MINUTES;
        const id = meeting.id;

        // ── Reminder notification ──────────────────────────────────────
        const remindKey = `${id}-remind-${remindAt}`;
        if (
          !firedRef.current.has(remindKey) &&
          minutesUntil <= remindAt &&
          minutesUntil > 0
        ) {
          firedRef.current.add(remindKey);
          const label = minutesUntil === 1 ? "1 minute" : `${minutesUntil} minutes`;
          fireNotification(
            `Meeting in ${label}: ${meeting.title}`,
            `${meeting.organizer ? `Organized by ${meeting.organizer}. ` : ""}Starts at ${meeting.start_time?.slice(0, 5)}.`,
            meeting.google_meet_url
          );
          addToast(
            `⏰ "${meeting.title}" starts in ${label}.${meeting.google_meet_url ? " Click Join to open Google Meet." : ""}`,
            "info"
          );
        }

        // ── Starting now notification ──────────────────────────────────
        const startKey = `${id}-start`;
        if (
          !firedRef.current.has(startKey) &&
          minutesUntil <= 0 &&
          minutesUntil >= -2 // within 2 min after start
        ) {
          firedRef.current.add(startKey);
          fireNotification(
            `Starting now: ${meeting.title}`,
            meeting.google_meet_url
              ? "Click to join Google Meet."
              : `Meeting is starting now.`,
            meeting.google_meet_url
          );
          addToast(
            `🟢 "${meeting.title}" is starting now!${meeting.google_meet_url ? " Click Join to open Google Meet." : ""}`,
            "success"
          );
        }
      });
    };

    // Run immediately, then every 60 s
    check();
    const id = setInterval(check, 60_000);
    return () => clearInterval(id);
  }, [meetings, addToast]);
}
