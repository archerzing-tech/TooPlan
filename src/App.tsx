import { useState, useEffect } from "react";
import "./App.css";

interface PlanEvent {
  id: string;
  text: string;
  date: string; // ISO "YYYY-MM-DD"
  createdAt: number;
}

type MainTab = "schedule" | "history";
type ScheduleTab = "today" | "week" | "future";

/* ──────────── Date helpers ──────────── */

function getToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getWeekDates(): string[] {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now);
  monday.setDate(diff);
  monday.setHours(12, 0, 0, 0);
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    dates.push(d.toISOString().split("T")[0]);
  }
  return dates;
}

const DAY_NAMES: Record<number, string> = { 0: "周日", 1: "周一", 2: "周二", 3: "周三", 4: "周四", 5: "周五", 6: "周六" };

function getDayName(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return DAY_NAMES[d.getDay()];
}

function getMonthDay(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function isDateBeforeToday(dateStr: string): boolean {
  return dateStr < getToday();
}

/* ──────────── Event item ──────────── */

interface EventItemProps {
  event: PlanEvent;
  editing: boolean;
  editText: string;
  onEditTextChange: (v: string) => void;
  onStartEdit: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onDelete: () => void;
  isPast?: boolean;
}

function EventItem({
  event,
  editing,
  editText,
  onEditTextChange,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onDelete,
  isPast,
}: EventItemProps) {
  return (
    <div className={`event-item ${isPast ? "past" : ""}`}>
      {editing ? (
        <div className="event-edit-row">
          <input
            className="event-edit-input"
            type="text"
            value={editText}
            onChange={(e) => onEditTextChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onSaveEdit();
              if (e.key === "Escape") onCancelEdit();
            }}
            autoFocus
            maxLength={200}
          />
          <button className="event-btn save-btn" onClick={onSaveEdit} title="保存">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </button>
          <button className="event-btn cancel-btn" onClick={onCancelEdit} title="取消">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      ) : (
        <>
          <span className="event-text" onClick={onStartEdit}>
            {event.text}
          </span>
          <div className="event-actions">
            <button className="event-btn icon-btn" onClick={onStartEdit} title="编辑">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
            <button className="event-btn icon-btn delete-btn" onClick={onDelete} title="删除">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
              </svg>
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/* ──────────── Day card ──────────── */

interface DayCardProps {
  date: string;
  events: PlanEvent[];
  editingEventId: string | null;
  editText: string;
  onEditTextChange: (v: string) => void;
  onStartEdit: (id: string) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onDelete: (id: string) => void;
  newEventDate: string | null;
  newEventText: string;
  onNewEventDateChange: (date: string | null) => void;
  onNewEventTextChange: (v: string) => void;
  onAddEvent: (date: string) => void;
  isToday?: boolean;
}

function DayCard({
  date,
  events,
  editingEventId,
  editText,
  onEditTextChange,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onDelete,
  newEventDate,
  newEventText,
  onNewEventDateChange,
  onNewEventTextChange,
  onAddEvent,
  isToday,
}: DayCardProps) {
  const isPast = isDateBeforeToday(date);
  const dayName = getDayName(date);
  const monthDay = getMonthDay(date);
  const isAdding = newEventDate === date;

  return (
    <div className={`day-card ${isPast ? "past" : ""} ${isToday ? "today" : ""}`}>
      <div className="day-card-header">
        <div className="day-card-title">
          <span className="day-name">{dayName}</span>
          <span className="day-date">{monthDay}</span>
          {isToday && <span className="today-tag">今天</span>}
        </div>
        <span className="event-count">{events.length} 项</span>
      </div>

      <div className="day-card-body">
        {events.length === 0 && !isAdding && (
          <div className="day-empty">暂无安排</div>
        )}

        {events.map((ev) => (
          <EventItem
            key={ev.id}
            event={ev}
            editing={editingEventId === ev.id}
            editText={editText}
            onEditTextChange={onEditTextChange}
            onStartEdit={() => onStartEdit(ev.id)}
            onSaveEdit={onSaveEdit}
            onCancelEdit={onCancelEdit}
            onDelete={() => onDelete(ev.id)}
            isPast={isPast}
          />
        ))}

        {isAdding && (
          <div className="add-event-row">
            <input
              className="add-event-input"
              type="text"
              placeholder="输入事件..."
              value={newEventText}
              onChange={(e) => onNewEventTextChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onAddEvent(date);
                if (e.key === "Escape") onNewEventDateChange(null);
              }}
              autoFocus
              maxLength={200}
            />
            <button
              className="event-btn add-confirm-btn"
              onClick={() => onAddEvent(date)}
              disabled={!newEventText.trim()}
              title="添加"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
          </div>
        )}
      </div>

      <button
        className="add-event-btn"
        onClick={() => {
          if (newEventDate === date) {
            onNewEventDateChange(null);
          } else {
            onNewEventDateChange(date);
            onNewEventTextChange("");
          }
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        {isAdding ? "取消" : "添加事件"}
      </button>
    </div>
  );
}

/* ──────────── Grouped future / history events ──────────── */

interface EventGroup {
  date: string;
  events: PlanEvent[];
}

function groupByDate(events: PlanEvent[]): EventGroup[] {
  const map = new Map<string, PlanEvent[]>();
  for (const ev of events) {
    if (!map.has(ev.date)) map.set(ev.date, []);
    map.get(ev.date)!.push(ev);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, evs]) => ({ date, events: evs }));
}

/* ──────────── App ──────────── */

function App() {
  const [events, setEvents] = useState<PlanEvent[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("tooplan-events") || "[]");
    } catch {
      return [];
    }
  });

  const [mainTab, setMainTab] = useState<MainTab>("schedule");
  const [scheduleTab, setScheduleTab] = useState<ScheduleTab>("today");
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [newEventDate, setNewEventDate] = useState<string | null>(null);
  const [newEventText, setNewEventText] = useState("");

  useEffect(() => {
    localStorage.setItem("tooplan-events", JSON.stringify(events));
  }, [events]);

  /* ── event CRUD ── */

  const addEvent = (date: string) => {
    const trimmed = newEventText.trim();
    if (!trimmed || newEventDate !== date) return;
    const ev: PlanEvent = {
      id: crypto.randomUUID(),
      text: trimmed,
      date,
      createdAt: Date.now(),
    };
    setEvents((prev) => [ev, ...prev]);
    setNewEventText("");
    setNewEventDate(null);
  };

  const deleteEvent = (id: string) => {
    setEvents((prev) => prev.filter((e) => e.id !== id));
  };

  const startEdit = (id: string) => {
    const ev = events.find((e) => e.id === id);
    if (!ev) return;
    setEditingEventId(id);
    setEditText(ev.text);
  };

  const saveEdit = () => {
    if (!editingEventId) return;
    const trimmed = editText.trim();
    if (!trimmed) {
      deleteEvent(editingEventId);
      return;
    }
    setEvents((prev) => prev.map((e) => (e.id === editingEventId ? { ...e, text: trimmed } : e)));
    setEditingEventId(null);
    setEditText("");
  };

  const cancelEdit = () => {
    setEditingEventId(null);
    setEditText("");
  };

  /* ── derived data ── */

  const today = getToday();
  const weekDates = getWeekDates();

  const getEventsForDay = (d: string) => events.filter((e) => e.date === d);

  const todayEvents = getEventsForDay(today);

  // Events visible in "未来" tab = dates after this week
  const futureEvents = events.filter((e) => e.date > weekDates[6]);
  const futureGroups = groupByDate(futureEvents);

  // History: all events sorted newest-first, grouped by date
  const historySorted = [...events].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  const historyGroups = groupByDate(historySorted);

  /* ── future date picker ── */
  const [futurePickerDate, setFuturePickerDate] = useState(getNextWeekday());
  const [futurePickerText, setFuturePickerText] = useState("");

  function getNextWeekday(): string {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split("T")[0];
  }

  return (
    <div className="app">
      {/* ── Header ── */}
      <header className="header">
        <div className="header-left">
          <svg className="header-bell" width="30" height="30" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="bellG" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#6c63ff" />
                <stop offset="100%" stopColor="#ff6b9d" />
              </linearGradient>
            </defs>
            <ellipse cx="256" cy="165" rx="100" ry="65" fill="url(#bellG)" />
            <path d="M156 165 L170 280 Q256 300 342 280 L356 165 Z" fill="url(#bellG)" />
            <ellipse cx="256" cy="395" rx="110" ry="15" fill="#6c63ff" />
            <ellipse cx="256" cy="385" rx="55" ry="10" fill="var(--bg)" />
            <circle cx="256" cy="435" r="14" fill="#6c63ff" />
            <line x1="256" y1="400" x2="256" y2="422" stroke="#6c63ff" strokeWidth="3" />
          </svg>
          <h1>TooPlan</h1>
        </div>
      </header>

      {/* ── Main tab bar ── */}
      <nav className="main-tabs">
        <button
          className={`main-tab ${mainTab === "schedule" ? "active" : ""}`}
          onClick={() => setMainTab("schedule")}
        >
          安排
          {todayEvents.length > 0 && <span className="main-badge">{todayEvents.length}</span>}
        </button>
        <button
          className={`main-tab ${mainTab === "history" ? "active" : ""}`}
          onClick={() => setMainTab("history")}
        >
          历史记录
          <span className="main-badge muted">{events.length}</span>
        </button>
      </nav>

      {/* ── Schedule sub-tabs ── */}
      {mainTab === "schedule" && (
        <nav className="sub-tabs">
          {(["today", "week", "future"] as ScheduleTab[]).map((tab) => (
            <button
              key={tab}
              className={`sub-tab ${scheduleTab === tab ? "active" : ""}`}
              onClick={() => setScheduleTab(tab)}
            >
              {tab === "today" ? "今天" : tab === "week" ? "本周" : "未来"}
            </button>
          ))}
        </nav>
      )}

      {/* ── Content ── */}
      <main className="content">
        {/* ── Schedule: Today ── */}
        {mainTab === "schedule" && scheduleTab === "today" && (
          <div className="day-view">
            <DayCard
              date={today}
              isToday
              events={todayEvents}
              editingEventId={editingEventId}
              editText={editText}
              onEditTextChange={setEditText}
              onStartEdit={startEdit}
              onSaveEdit={saveEdit}
              onCancelEdit={cancelEdit}
              onDelete={deleteEvent}
              newEventDate={newEventDate}
              newEventText={newEventText}
              onNewEventDateChange={setNewEventDate}
              onNewEventTextChange={setNewEventText}
              onAddEvent={addEvent}
            />
          </div>
        )}

        {/* ── Schedule: Week ── */}
        {mainTab === "schedule" && scheduleTab === "week" && (
          <div className="week-grid">
            {weekDates.map((date) => (
              <DayCard
                key={date}
                date={date}
                isToday={date === today}
                events={getEventsForDay(date)}
                editingEventId={editingEventId}
                editText={editText}
                onEditTextChange={setEditText}
                onStartEdit={startEdit}
                onSaveEdit={saveEdit}
                onCancelEdit={cancelEdit}
                onDelete={deleteEvent}
                newEventDate={newEventDate}
                newEventText={newEventText}
                onNewEventDateChange={setNewEventDate}
                onNewEventTextChange={setNewEventText}
                onAddEvent={addEvent}
              />
            ))}
          </div>
        )}

        {/* ── Schedule: Future ── */}
        {mainTab === "schedule" && scheduleTab === "future" && (
          <div className="grouped-list">
            <div className="future-add-card">
              <div className="future-add-row">
                <input
                  type="date"
                  className="future-date-input"
                  value={futurePickerDate}
                  min={getNextWeekday()}
                  onChange={(e) => setFuturePickerDate(e.target.value)}
                />
                <input
                  className="add-event-input"
                  type="text"
                  placeholder="输入未来安排..."
                  value={futurePickerText}
                  onChange={(e) => setFuturePickerText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && futurePickerText.trim()) {
                      const ev: PlanEvent = {
                        id: crypto.randomUUID(),
                        text: futurePickerText.trim(),
                        date: futurePickerDate,
                        createdAt: Date.now(),
                      };
                      setEvents((prev) => [ev, ...prev]);
                      setFuturePickerText("");
                    }
                  }}
                  maxLength={200}
                />
                <button
                  className="event-btn add-confirm-btn"
                  onClick={() => {
                    if (futurePickerText.trim()) {
                      const ev: PlanEvent = {
                        id: crypto.randomUUID(),
                        text: futurePickerText.trim(),
                        date: futurePickerDate,
                        createdAt: Date.now(),
                      };
                      setEvents((prev) => [ev, ...prev]);
                      setFuturePickerText("");
                    }
                  }}
                  disabled={!futurePickerText.trim()}
                  title="添加"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </button>
              </div>
            </div>

            {futureGroups.length === 0 ? (
              <div className="empty-state">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="empty-icon">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 6v6l4 2" />
                </svg>
                <p className="empty-text">暂无未来安排，在上方添加</p>
              </div>
            ) : (
              futureGroups.map((group) => (
                <div key={group.date} className="date-group">
                  <div className="date-group-header">
                    <span className="date-label">{getDayName(group.date)}</span>
                    <span className="date-value">{group.date}</span>
                  </div>
                  <div className="date-group-body">
                    {group.events.map((ev) => (
                      <EventItem
                        key={ev.id}
                        event={ev}
                        editing={editingEventId === ev.id}
                        editText={editText}
                        onEditTextChange={setEditText}
                        onStartEdit={() => startEdit(ev.id)}
                        onSaveEdit={saveEdit}
                        onCancelEdit={cancelEdit}
                        onDelete={() => deleteEvent(ev.id)}
                      />
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ── History ── */}
        {mainTab === "history" && (
          <div className="grouped-list">
            {historyGroups.length === 0 ? (
              <div className="empty-state">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="empty-icon">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                <p className="empty-text">暂无记录</p>
              </div>
            ) : (
              historyGroups.map((group) => {
                const isPastGroup = isDateBeforeToday(group.date);
                return (
                  <div key={group.date} className={`date-group ${isPastGroup ? "past-group" : ""}`}>
                    <div className="date-group-header">
                      <span className="date-label">{getDayName(group.date)}</span>
                      <span className="date-value">{group.date}</span>
                    </div>
                    <div className="date-group-body">
                      {group.events.map((ev) => (
                        <EventItem
                          key={ev.id}
                          event={ev}
                          editing={editingEventId === ev.id}
                          editText={editText}
                          onEditTextChange={setEditText}
                          onStartEdit={() => startEdit(ev.id)}
                          onSaveEdit={saveEdit}
                          onCancelEdit={cancelEdit}
                          onDelete={() => deleteEvent(ev.id)}
                          isPast={isPastGroup}
                        />
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
