import { useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  HelpCircle,
  Link2,
  Plus,
  Search,
  Settings,
  Unlink,
  Video,
} from "lucide-react";

import DataTable from "../common/DataTable";
import { SearchBar } from "../common/SearchFilter";
import EmptyState from "../common/EmptyState";
import StatusBadge from "../common/StatusBadge";
import CreateDropdown from "./CreateDropdown";
import GoogleCalendarSetupPanel from "./GoogleCalendarSetupPanel";
import "./meetingsCalendar.css";

const HOUR_START = 8;
const HOUR_END = 20;
const HOUR_HEIGHT = 48;
const WEEKDAY_LABELS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const MINI_WEEKDAY = ["S", "M", "T", "W", "T", "F", "S"];

const TYPE_COLORS = {
  internal: { bg: "#e8f0fe", border: "#4285f4", text: "#174ea6" },
  client: { bg: "#f3e8fd", border: "#9334e6", text: "#7627bb" },
  review: { bg: "#e6f4ea", border: "#34a853", text: "#137333" },
  standup: { bg: "#e8f0fe", border: "#4285f4", text: "#174ea6" },
  interview: { bg: "#fce8e6", border: "#ea4335", text: "#c5221f" },
  training: { bg: "#fef7e0", border: "#fbbc04", text: "#b06000" },
  other: { bg: "#f1f3f4", border: "#70757a", text: "#3c4043" },
};

const CALENDAR_LAYERS = [
  { id: "primary", label: "My Meetings", color: "#4285f4", types: null },
  { id: "work", label: "Work", color: "#34a853", types: ["internal", "standup", "review"] },
  { id: "client", label: "Client", color: "#9334e6", types: ["client"] },
  { id: "interview", label: "Interviews", color: "#ea4335", types: ["interview"] },
  { id: "training", label: "Training", color: "#fbbc04", types: ["training"] },
  { id: "other", label: "Other", color: "#70757a", types: ["other", null, ""] },
];

function pad(n) {
  return String(n).padStart(2, "0");
}

function toIsoDate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseIso(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function startOfWeekSunday(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function parseTimeToMinutes(value) {
  if (!value) return 0;
  const parts = String(value).slice(0, 8).split(":");
  return Number(parts[0] || 0) * 60 + Number(parts[1] || 0);
}

function formatTimeShort(value) {
  const mins = parseTimeToMinutes(value);
  const h24 = Math.floor(mins / 60);
  const m = mins % 60;
  const ampm = h24 >= 12 ? "pm" : "am";
  const h12 = h24 % 12 || 12;
  return m ? `${h12}:${pad(m)}${ampm}` : `${h12}${ampm}`;
}

function formatEventTime(start, end) {
  return `${formatTimeShort(start)} – ${formatTimeShort(end)}`;
}

function formatHourLabel(hour) {
  if (hour === 0) return "12 AM";
  if (hour < 12) return `${hour} AM`;
  if (hour === 12) return "12 PM";
  return `${hour - 12} PM`;
}

function eventColor(type) {
  const key = (type || "other").toLowerCase();
  return TYPE_COLORS[key] || TYPE_COLORS.other;
}

function meetingVisible(meeting, enabledLayers) {
  if (enabledLayers.primary) return true;
  const type = (meeting.meeting_type || "other").toLowerCase();
  return CALENDAR_LAYERS.some(
    (layer) => layer.id !== "primary" && enabledLayers[layer.id] && layer.types?.includes(type)
  );
}

function MiniMonthCalendar({ anchor, selected, onSelect, onMonthChange }) {
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const first = new Date(year, month, 1);
  const startPad = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startPad; i += 1) cells.push(null);
  for (let d = 1; d <= daysInMonth; d += 1) cells.push(d);
  const today = new Date();

  return (
    <div className="meetings-cal__mini-month">
      <div className="meetings-cal__mini-head">
        <button type="button" className="meetings-cal__btn meetings-cal__btn--icon" onClick={() => onMonthChange(-1)} aria-label="Previous month">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span>{anchor.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</span>
        <button type="button" className="meetings-cal__btn meetings-cal__btn--icon" onClick={() => onMonthChange(1)} aria-label="Next month">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <div className="meetings-cal__mini-grid">
        {MINI_WEEKDAY.map((d) => (
          <span key={d} className="text-[var(--gcal-muted)]">{d}</span>
        ))}
        {cells.map((day, idx) => {
          if (!day) return <span key={`e-${idx}`} />;
          const iso = `${year}-${pad(month + 1)}-${pad(day)}`;
          const dateObj = parseIso(iso);
          const isSelected = iso === selected;
          const isToday = isSameDay(dateObj, today);
          return (
            <button
              key={iso}
              type="button"
              className={`${isSelected ? "is-selected" : ""} ${isToday ? "is-today" : ""}`}
              onClick={() => onSelect(iso)}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function MeetingsCalendarView({
  meetings = [],
  googleStatus = {},
  user,
  loading = false,
  onCreate,
  onCreateKind,
  onEdit,
  onDelete,
  onView,
  onJoinMeeting,
  onOpenCalendar,
  onConnectGoogle,
  onDisconnectGoogle,
  onRefresh,
  connecting = false,
  listColumns,
  openMenuId,
  setOpenMenuId,
}) {
  const [viewMode, setViewMode] = useState("week");
  const [weekStart, setWeekStart] = useState(() => startOfWeekSunday(new Date()));
  const [selectedDate, setSelectedDate] = useState(() => toIsoDate(new Date()));
  const [miniMonth, setMiniMonth] = useState(() => new Date());
  const [meetQuery, setMeetQuery] = useState("");
  const [enabledLayers, setEnabledLayers] = useState(() =>
    Object.fromEntries(CALENDAR_LAYERS.map((l) => [l.id, true]))
  );

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  const visibleMeetings = useMemo(() => {
    let list = meetings.filter((m) => meetingVisible(m, enabledLayers));
    if (meetQuery.trim()) {
      const q = meetQuery.toLowerCase();
      list = list.filter(
        (m) =>
          m.title?.toLowerCase().includes(q) ||
          m.organizer?.toLowerCase().includes(q) ||
          (m.participants || []).some((p) => p.email?.toLowerCase().includes(q))
      );
    }
    return list;
  }, [meetings, enabledLayers, meetQuery]);

  const weekMeetings = useMemo(() => {
    const startIso = toIsoDate(weekDays[0]);
    const endIso = toIsoDate(weekDays[6]);
    return visibleMeetings.filter((m) => m.meeting_date >= startIso && m.meeting_date <= endIso);
  }, [visibleMeetings, weekDays]);

  const meetingsByDay = useMemo(() => {
    const map = {};
    weekDays.forEach((d) => {
      map[toIsoDate(d)] = [];
    });
    weekMeetings.forEach((m) => {
      if (map[m.meeting_date]) map[m.meeting_date].push(m);
    });
    Object.values(map).forEach((arr) =>
      arr.sort((a, b) => parseTimeToMinutes(a.start_time) - parseTimeToMinutes(b.start_time))
    );
    return map;
  }, [weekMeetings, weekDays]);

  const monthLabel = weekDays[0].toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const today = new Date();
  const nowMinutes = today.getHours() * 60 + today.getMinutes();
  const nowTop = ((nowMinutes - HOUR_START * 60) / 60) * HOUR_HEIGHT;

  const goToday = () => {
    const now = new Date();
    setWeekStart(startOfWeekSunday(now));
    setSelectedDate(toIsoDate(now));
    setMiniMonth(new Date(now.getFullYear(), now.getMonth(), 1));
  };

  const shiftWeek = (delta) => {
    setWeekStart((prev) => addDays(prev, delta * 7));
  };

  const handleMiniSelect = (iso) => {
    setSelectedDate(iso);
    const d = parseIso(iso);
    setWeekStart(startOfWeekSunday(d));
    setMiniMonth(new Date(d.getFullYear(), d.getMonth(), 1));
  };

  const primaryName = user?.full_name || googleStatus.account_email?.split("@")[0] || "My Calendar";

  return (
    <div className="meetings-cal">
      <div className="meetings-cal__toolbar">
        <div className="meetings-cal__toolbar-left">
          <div className="meetings-cal__brand">
            <div className="meetings-cal__logo" aria-hidden>31</div>
            <span>Calendar</span>
          </div>
          <button type="button" className="meetings-cal__btn meetings-cal__btn--today" onClick={goToday}>
            Today
          </button>
          <button type="button" className="meetings-cal__btn meetings-cal__btn--icon" onClick={() => shiftWeek(-1)} aria-label="Previous week">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button type="button" className="meetings-cal__btn meetings-cal__btn--icon" onClick={() => shiftWeek(1)} aria-label="Next week">
            <ChevronRight className="h-5 w-5" />
          </button>
          <span className="meetings-cal__month-label">{monthLabel}</span>
        </div>
        <div className="meetings-cal__toolbar-right">
          <button type="button" className="meetings-cal__btn meetings-cal__btn--icon" aria-label="Search">
            <Search className="h-4 w-4" />
          </button>
          <button type="button" className="meetings-cal__btn meetings-cal__btn--icon" aria-label="Help">
            <HelpCircle className="h-4 w-4" />
          </button>
          <button type="button" className="meetings-cal__btn meetings-cal__btn--icon" onClick={onRefresh} aria-label="Refresh">
            <Settings className="h-4 w-4" />
          </button>
          <select
            className="meetings-cal__select"
            value={viewMode}
            onChange={(e) => setViewMode(e.target.value)}
            aria-label="Calendar view"
          >
            <option value="week">Week</option>
            <option value="list">List</option>
          </select>
        </div>
      </div>

      <div className="meetings-cal__body">
        <aside className="meetings-cal__sidebar">
          <CreateDropdown
            onSelect={(kind) => onCreateKind?.(kind, selectedDate) ?? onCreate?.(selectedDate)}
          />

          <MiniMonthCalendar
            anchor={miniMonth}
            selected={selectedDate}
            onSelect={handleMiniSelect}
            onMonthChange={(delta) =>
              setMiniMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1))
            }
          />

          <div className="meetings-cal__meet-with-search">
            <SearchBar
              size="compact"
              value={meetQuery}
              onChange={setMeetQuery}
              placeholder="Search"
              className="w-full"
            />
          </div>

          <p className="meetings-cal__section-title">My calendars</p>
          <div className="meetings-cal__cal-list">
            <label>
              <input
                type="checkbox"
                checked={enabledLayers.primary}
                onChange={(e) => setEnabledLayers((s) => ({ ...s, primary: e.target.checked }))}
              />
              <span className="meetings-cal__cal-dot" style={{ background: "#4285f4" }} />
              {primaryName}
            </label>
            {CALENDAR_LAYERS.filter((l) => l.id !== "primary").map((layer) => (
              <label key={layer.id}>
                <input
                  type="checkbox"
                  checked={enabledLayers[layer.id]}
                  onChange={(e) => setEnabledLayers((s) => ({ ...s, [layer.id]: e.target.checked }))}
                />
                <span className="meetings-cal__cal-dot" style={{ background: layer.color }} />
                {layer.label}
              </label>
            ))}
          </div>

          <div className="meetings-cal__connect">
            <GoogleCalendarSetupPanel googleStatus={googleStatus} />
            <p className="mb-2 font-medium text-[var(--gcal-text)]">Google Calendar</p>
            {googleStatus.connected ? (
              <>
                <StatusBadge tone="success">Connected</StatusBadge>
                <a
                  href="https://calendar.google.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 text-xs text-[var(--color-primary)] hover:underline truncate block"
                  title="Open Google Calendar"
                >
                  {googleStatus.account_email}
                </a>
                <a
                  href="https://calendar.google.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="meetings-cal__btn mt-2 w-full justify-center text-xs inline-flex items-center gap-1.5"
                >
                  <ExternalLink className="h-3.5 w-3.5" /> Open Google Calendar
                </a>
                <button type="button" className="meetings-cal__btn mt-1.5 w-full justify-center text-xs text-red-600 hover:text-red-700" onClick={onDisconnectGoogle}>
                  <Unlink className="h-3.5 w-3.5" /> Disconnect
                </button>
              </>
            ) : (
              <>
                <StatusBadge tone="neutral">Not Connected</StatusBadge>
                <a
                  href="https://calendar.google.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="meetings-cal__btn mt-2 w-full justify-center text-xs inline-flex items-center gap-1.5"
                >
                  <ExternalLink className="h-3.5 w-3.5" /> Open Google Calendar
                </a>
                <button
                  type="button"
                  className="meetings-cal__btn mt-1.5 w-full justify-center text-xs"
                  onClick={onConnectGoogle}
                  disabled={connecting || !googleStatus.configured}
                >
                  <Link2 className="h-3.5 w-3.5" />
                  {connecting ? "Redirecting…" : "Connect"}
                </button>
              </>
            )}
          </div>
        </aside>

        <div className="meetings-cal__main">
          {viewMode === "list" ? (
            <div className="meetings-cal__list-wrap">
              <DataTable
                columns={listColumns}
                data={visibleMeetings}
                showSearch={false}
                pageSize={10}
                emptyState={
                  <EmptyState
                    icon="clipboard"
                    title="No meetings yet"
                    description="Create a meeting or connect Google Calendar."
                    actionLabel="Create"
                    onAction={() => onCreate?.()}
                  />
                }
              />
            </div>
          ) : (
            <>
              <div className="meetings-cal__week-head">
                <div />
                {weekDays.map((day) => {
                  const iso = toIsoDate(day);
                  const isToday = isSameDay(day, today);
                  return (
                    <div key={iso} className={`meetings-cal__week-head-cell ${isToday ? "is-today" : ""}`}>
                      {WEEKDAY_LABELS[day.getDay()]}
                      <div className="day-num">{day.getDate()}</div>
                    </div>
                  );
                })}
              </div>
              <div className="meetings-cal__grid-scroll">
                <div
                  className="meetings-cal__grid"
                  style={{ "--gcal-hour-h": `${HOUR_HEIGHT}px`, minHeight: `${(HOUR_END - HOUR_START) * HOUR_HEIGHT}px` }}
                >
                  <div className="meetings-cal__time-col">
                    {Array.from({ length: HOUR_END - HOUR_START }, (_, i) => (
                      <div key={i} className="meetings-cal__time-label">
                        {formatHourLabel(HOUR_START + i)}
                      </div>
                    ))}
                  </div>
                  {weekDays.map((day) => {
                    const iso = toIsoDate(day);
                    const dayMeetings = meetingsByDay[iso] || [];
                    const isToday = isSameDay(day, today);
                    return (
                      <div key={iso} className="meetings-cal__day-col">
                        {Array.from({ length: HOUR_END - HOUR_START }, (_, i) => (
                          <div key={i} className="meetings-cal__hour-line" />
                        ))}
                        {isToday && nowTop >= 0 && nowTop <= (HOUR_END - HOUR_START) * HOUR_HEIGHT ? (
                          <div className="meetings-cal__now-line" style={{ top: `${nowTop}px` }} />
                        ) : null}
                        {dayMeetings.map((m) => {
                          const startMin = parseTimeToMinutes(m.start_time);
                          const endMin = parseTimeToMinutes(m.end_time);
                          const top = ((startMin - HOUR_START * 60) / 60) * HOUR_HEIGHT;
                          const height = Math.max(((endMin - startMin) / 60) * HOUR_HEIGHT, 22);
                          if (top + height < 0 || top > (HOUR_END - HOUR_START) * HOUR_HEIGHT) return null;
                          const colors = eventColor(m.meeting_type);
                          return (
                            <button
                              key={m.id}
                              type="button"
                              className="meetings-cal__event"
                              style={{
                                top: `${Math.max(top, 0)}px`,
                                height: `${height}px`,
                                background: colors.bg,
                                borderLeftColor: colors.border,
                                color: colors.text,
                              }}
                              onClick={() => onView?.(m)}
                              title={m.title}
                            >
                              <div className="meetings-cal__event-title">{m.title}</div>
                              <div className="meetings-cal__event-time">
                                {formatEventTime(m.start_time, m.end_time)}
                              </div>
                              {m.google_meet_url ? (
                                <span className="meetings-cal__event-meet">
                                  <Video className="h-3 w-3" /> Meet
                                </span>
                              ) : null}
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        <aside className="meetings-cal__rail" aria-label="Quick apps">
          {[
            { label: "Keep", color: "#fbbc04", letter: "K" },
            { label: "Tasks", color: "#4285f4", letter: "✓" },
            { label: "Contacts", color: "#4285f4", letter: "👤" },
            { label: "Maps", color: "#34a853", letter: "📍" },
          ].map((item) => (
            <button key={item.label} type="button" className="meetings-cal__rail-btn" title={item.label}>
              <span style={{ color: item.color, fontSize: 16 }}>{item.letter}</span>
            </button>
          ))}
          <button type="button" className="meetings-cal__rail-btn" title="Add">
            <Plus className="h-5 w-5" />
          </button>
        </aside>
      </div>

      {loading ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-white/60 text-sm text-[var(--gcal-muted)]">
          Loading…
        </div>
      ) : null}
    </div>
  );
}
