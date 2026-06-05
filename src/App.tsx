import { useState, useEffect } from "react";
import "./App.css";

interface PlanItem {
  id: string;
  type: "event" | "reminder";
  text: string;
  date: string; // ISO "YYYY-MM-DD"
  time?: string; // "HH:MM" for reminders
  createdAt: number;
}

type MainTab = "schedule" | "history";
type ScheduleTab = "today" | "week" | "future";

/* ──────────── Date helpers ──────────── */

function getToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getNowTime(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function getNextWeekday(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
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

const DAY_NAMES: Record<number, string> = {
  0: "周日", 1: "周一", 2: "周二", 3: "周三",
  4: "周四", 5: "周五", 6: "周六",
};

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

function isItemExpired(item: PlanItem): boolean {
  if (item.type === "reminder" && item.time) {
    return new Date(`${item.date}T${item.time}`) < new Date();
  }
  return isDateBeforeToday(item.date);
}

/* ──────────── Urgency / Color helpers ──────────── */

type Urgency = "normal" | "warning" | "danger" | "expired";

function getUrgency(item: PlanItem): Urgency {
  if (item.type === "reminder" && item.time) {
    const deadline = new Date(`${item.date}T${item.time}`);
    const now = new Date();
    const createdAt = new Date(item.createdAt);
    const totalMs = deadline.getTime() - createdAt.getTime();
    const remainingMs = deadline.getTime() - now.getTime();

    if (now > deadline) return "expired";
    if (remainingMs <= 2 * 60 * 60 * 1000) return "danger";
    if (totalMs > 0) {
      const elapsed = now.getTime() - createdAt.getTime();
      if (elapsed / totalMs > 0.5) return "warning";
    }
    return "normal";
  }

  if (isDateBeforeToday(item.date)) return "expired";
  return "normal";
}

/* ──────────── Event item ──────────── */

interface EventItemProps {
  item: PlanItem;
  editing: boolean;
  editText: string;
  rebuilding: boolean;
  rebuildDate: string;
  rebuildTime: string;
  onEditTextChange: (v: string) => void;
  onStartEdit: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onDelete: () => void;
  onCopy: () => void;
  onStartRebuild: () => void;
  onRebuildDateChange: (v: string) => void;
  onRebuildTimeChange: (v: string) => void;
  onSaveRebuild: () => void;
  onCancelRebuild: () => void;
}

function EventItem({
  item,
  editing,
  editText,
  rebuilding,
  rebuildDate,
  rebuildTime,
  onEditTextChange,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onDelete,
  onCopy,
  onStartRebuild,
  onRebuildDateChange,
  onRebuildTimeChange,
  onSaveRebuild,
  onCancelRebuild,
}: EventItemProps) {
  const urgency = getUrgency(item);
  const isPast = urgency === "expired";

  if (rebuilding) {
    return (
      <div className={`event-item rebuilding-mode urgency-${urgency}`}>
        <div className="event-rebuild-row">
          <input
            type="date"
            className="rebuild-date-input"
            value={rebuildDate}
            min={getToday()}
            onChange={(e) => onRebuildDateChange(e.target.value)}
          />
          <input
            type="time"
            className="rebuild-time-input"
            value={rebuildTime}
            onChange={(e) => onRebuildTimeChange(e.target.value)}
          />
          <button className="event-btn save-btn" onClick={onSaveRebuild} title="保存">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </button>
          <button className="event-btn cancel-btn" onClick={onCancelRebuild} title="取消">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`event-item ${isPast ? "past" : ""} urgency-${urgency}`}>
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
          <div className="event-content">
            {item.type === "reminder" && item.time && (
              <span className="event-time-badge">{item.time}</span>
            )}
            <span className="event-text" onClick={onStartEdit}>
              {item.text}
            </span>
          </div>
          <div className="event-actions">
            {!isPast && item.type === "reminder" && (
              <button className="event-btn icon-btn rebuild-btn" onClick={onStartRebuild} title="重建">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="23 4 23 10 17 10" />
                  <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
                </svg>
              </button>
            )}
            <button className="event-btn icon-btn copy-btn" onClick={onCopy} title="复制">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
              </svg>
            </button>
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
  items: PlanItem[];
  editingItemId: string | null;
  editText: string;
  rebuildingId: string | null;
  rebuildDate: string;
  rebuildTime: string;
  newItemDate: string | null;
  newItemText: string;
  newItemType: "event" | "reminder";
  newItemTime: string;
  onEditTextChange: (v: string) => void;
  onStartEdit: (id: string) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onDelete: (id: string) => void;
  onCopy: (id: string) => void;
  onStartRebuild: (id: string) => void;
  onRebuildDateChange: (v: string) => void;
  onRebuildTimeChange: (v: string) => void;
  onSaveRebuild: () => void;
  onCancelRebuild: () => void;
  newItemDateChange: (date: string | null) => void;
  newItemTextChange: (v: string) => void;
  newItemTypeChange: (t: "event" | "reminder") => void;
  newItemTimeChange: (v: string) => void;
  onAddItem: (date: string) => void;
  isToday?: boolean;
}

function DayCard({
  date,
  items,
  editingItemId,
  editText,
  rebuildingId,
  rebuildDate,
  rebuildTime,
  newItemDate,
  newItemText,
  newItemType,
  newItemTime,
  onEditTextChange,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onDelete,
  onCopy,
  onStartRebuild,
  onRebuildDateChange,
  onRebuildTimeChange,
  onSaveRebuild,
  onCancelRebuild,
  newItemDateChange,
  newItemTextChange,
  newItemTypeChange,
  newItemTimeChange,
  onAddItem,
  isToday,
}: DayCardProps) {
  const isPast = isDateBeforeToday(date);
  const isAdding = newItemDate === date;

  return (
    <div className={`day-card ${isPast ? "past" : ""} ${isToday ? "today" : ""}`}>
      <div className="day-card-header">
        <div className="day-card-title">
          <span className="day-name">{getDayName(date)}</span>
          <span className="day-date">{getMonthDay(date)}</span>
          {isToday && <span className="today-tag">今天</span>}
        </div>
        <span className="event-count">{items.length} 项</span>
      </div>

      <div className="day-card-body">
        {items.length === 0 && !isAdding && (
          <div className="day-empty">暂无安排</div>
        )}

        {items.map((item) => (
          <EventItem
            key={item.id}
            item={item}
            editing={editingItemId === item.id}
            editText={editText}
            rebuilding={rebuildingId === item.id}
            rebuildDate={rebuildDate}
            rebuildTime={rebuildTime}
            onEditTextChange={onEditTextChange}
            onStartEdit={() => onStartEdit(item.id)}
            onSaveEdit={onSaveEdit}
            onCancelEdit={onCancelEdit}
            onDelete={() => onDelete(item.id)}
            onCopy={() => onCopy(item.id)}
            onStartRebuild={() => onStartRebuild(item.id)}
            onRebuildDateChange={onRebuildDateChange}
            onRebuildTimeChange={onRebuildTimeChange}
            onSaveRebuild={onSaveRebuild}
            onCancelRebuild={onCancelRebuild}
          />
        ))}

        {isAdding && (
          <div className="add-item-row">
            <input
              className="add-item-input"
              type="text"
              placeholder={newItemType === "reminder" ? "输入提醒..." : "输入事件..."}
              value={newItemText}
              onChange={(e) => newItemTextChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onAddItem(date);
                if (e.key === "Escape") newItemDateChange(null);
              }}
              autoFocus
              maxLength={200}
            />
            <div className="add-item-extra">
              <div className="add-type-toggle">
                <button
                  className={`type-btn ${newItemType === "event" ? "active" : ""}`}
                  onClick={() => newItemTypeChange("event")}
                >
                  事件
                </button>
                <button
                  className={`type-btn ${newItemType === "reminder" ? "active" : ""}`}
                  onClick={() => newItemTypeChange("reminder")}
                >
                  提醒
                </button>
              </div>
              {newItemType === "reminder" && (
                <input
                  type="time"
                  className="add-time-input"
                  value={newItemTime}
                  onChange={(e) => newItemTimeChange(e.target.value)}
                />
              )}
            </div>
            <button
              className="event-btn add-confirm-btn"
              onClick={() => onAddItem(date)}
              disabled={!newItemText.trim() || (newItemType === "reminder" && !newItemTime)}
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
          if (newItemDate === date) {
            newItemDateChange(null);
          } else {
            newItemDateChange(date);
            newItemTextChange("");
          }
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        {isAdding ? "取消" : "添加"}
      </button>
    </div>
  );
}

/* ──────────── Grouped items ──────────── */

interface ItemGroup {
  date: string;
  items: PlanItem[];
}

function groupByDate(items: PlanItem[]): ItemGroup[] {
  const map = new Map<string, PlanItem[]>();
  for (const ev of items) {
    if (!map.has(ev.date)) map.set(ev.date, []);
    map.get(ev.date)!.push(ev);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, evs]) => ({ date, items: evs }));
}

/* ──────────── App ──────────── */

const STORAGE_KEY = "tooplan-items";

function migrateOldData(): PlanItem[] {
  try {
    const old = JSON.parse(localStorage.getItem("tooplan-events") || "null");
    if (Array.isArray(old)) {
      const migrated: PlanItem[] = old.map((e: any) => ({
        id: e.id || crypto.randomUUID(),
        type: "event",
        text: e.text || "",
        date: e.date || getToday(),
        createdAt: e.createdAt || Date.now(),
      }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
      localStorage.removeItem("tooplan-events");
      return migrated;
    }
  } catch {}
  return [];
}

function App() {
  const [items, setItems] = useState<PlanItem[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (Array.isArray(saved)) return saved;
    } catch {}
    return migrateOldData();
  });

  const [mainTab, setMainTab] = useState<MainTab>("schedule");
  const [scheduleTab, setScheduleTab] = useState<ScheduleTab>("today");
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [newItemDate, setNewItemDate] = useState<string | null>(null);
  const [newItemText, setNewItemText] = useState("");
  const [newItemType, setNewItemType] = useState<"event" | "reminder">("event");
  const [newItemTime, setNewItemTime] = useState(getNowTime());
  const [rebuildingId, setRebuildingId] = useState<string | null>(null);
  const [rebuildDate, setRebuildDate] = useState(getToday());
  const [rebuildTime, setRebuildTime] = useState(getNowTime());

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  /* ── item CRUD ── */

  const addItem = (date: string) => {
    const trimmed = newItemText.trim();
    if (!trimmed || newItemDate !== date) return;
    if (newItemType === "reminder" && !newItemTime) return;
    const item: PlanItem = {
      id: crypto.randomUUID(),
      type: newItemType,
      text: trimmed,
      date,
      time: newItemType === "reminder" ? newItemTime : undefined,
      createdAt: Date.now(),
    };
    setItems((prev) => [item, ...prev]);
    setNewItemText("");
    setNewItemTime(getNowTime());
    setNewItemType("event");
    setNewItemDate(null);
  };

  const deleteItem = (id: string) => {
    setItems((prev) => prev.filter((e) => e.id !== id));
  };

  const startEdit = (id: string) => {
    const ev = items.find((e) => e.id === id);
    if (!ev) return;
    setEditingItemId(id);
    setEditText(ev.text);
  };

  const saveEdit = () => {
    if (!editingItemId) return;
    const trimmed = editText.trim();
    if (!trimmed) {
      deleteItem(editingItemId);
      return;
    }
    setItems((prev) =>
      prev.map((e) => (e.id === editingItemId ? { ...e, text: trimmed } : e)),
    );
    setEditingItemId(null);
    setEditText("");
  };

  const cancelEdit = () => {
    setEditingItemId(null);
    setEditText("");
  };

  const copyItem = (id: string) => {
    const original = items.find((e) => e.id === id);
    if (!original) return;
    const copy: PlanItem = {
      ...original,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
    };
    setItems((prev) => [copy, ...prev]);
  };

  const startRebuild = (id: string) => {
    const item = items.find((e) => e.id === id);
    if (!item) return;
    setRebuildingId(id);
    setRebuildDate(item.date);
    setRebuildTime(item.time || getNowTime());
  };

  const saveRebuild = () => {
    if (!rebuildingId) return;
    setItems((prev) =>
      prev.map((e) =>
        e.id === rebuildingId
          ? { ...e, date: rebuildDate, time: rebuildTime, createdAt: Date.now() }
          : e,
      ),
    );
    setRebuildingId(null);
  };

  const cancelRebuild = () => {
    setRebuildingId(null);
  };

  /* ── derived data ── */

  const today = getToday();
  const weekDates = getWeekDates();

  const getItemsForDay = (d: string) => items.filter((e) => e.date === d);

  const todayItems = getItemsForDay(today);

  // Future: items after this week
  const futureItems = items.filter((e) => e.date > weekDates[6]);
  const futureGroups = groupByDate(futureItems);

  // History: only expired items, sorted newest-first
  const historyItems = items
    .filter((e) => isItemExpired(e))
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  const historyGroups = groupByDate(historyItems);

  /* ── future date picker ── */
  const [futurePickerDate, setFuturePickerDate] = useState(getNextWeekday());
  const [futurePickerText, setFuturePickerText] = useState("");
  const [futurePickerType, setFuturePickerType] = useState<"event" | "reminder">("event");
  const [futurePickerTime, setFuturePickerTime] = useState(getNowTime());

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
          {todayItems.length > 0 && <span className="main-badge">{todayItems.length}</span>}
        </button>
        <button
          className={`main-tab ${mainTab === "history" ? "active" : ""}`}
          onClick={() => setMainTab("history")}
        >
          历史记录
          <span className="main-badge muted">{historyItems.length}</span>
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
              items={todayItems}
              editingItemId={editingItemId}
              editText={editText}
              rebuildingId={rebuildingId}
              rebuildDate={rebuildDate}
              rebuildTime={rebuildTime}
              newItemDate={newItemDate}
              newItemText={newItemText}
              newItemType={newItemType}
              newItemTime={newItemTime}
              onEditTextChange={setEditText}
              onStartEdit={startEdit}
              onSaveEdit={saveEdit}
              onCancelEdit={cancelEdit}
              onDelete={deleteItem}
              onCopy={copyItem}
              onStartRebuild={startRebuild}
              onRebuildDateChange={setRebuildDate}
              onRebuildTimeChange={setRebuildTime}
              onSaveRebuild={saveRebuild}
              onCancelRebuild={cancelRebuild}
              newItemDateChange={setNewItemDate}
              newItemTextChange={setNewItemText}
              newItemTypeChange={setNewItemType}
              newItemTimeChange={setNewItemTime}
              onAddItem={addItem}
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
                items={getItemsForDay(date)}
                editingItemId={editingItemId}
                editText={editText}
                rebuildingId={rebuildingId}
                rebuildDate={rebuildDate}
                rebuildTime={rebuildTime}
                newItemDate={newItemDate}
                newItemText={newItemText}
                newItemType={newItemType}
                newItemTime={newItemTime}
                onEditTextChange={setEditText}
                onStartEdit={startEdit}
                onSaveEdit={saveEdit}
                onCancelEdit={cancelEdit}
                onDelete={deleteItem}
                onCopy={copyItem}
                onStartRebuild={startRebuild}
                onRebuildDateChange={setRebuildDate}
                onRebuildTimeChange={setRebuildTime}
                onSaveRebuild={saveRebuild}
                onCancelRebuild={cancelRebuild}
                newItemDateChange={setNewItemDate}
                newItemTextChange={setNewItemText}
                newItemTypeChange={setNewItemType}
                newItemTimeChange={setNewItemTime}
                onAddItem={addItem}
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
                  className="add-item-input"
                  type="text"
                  placeholder="输入内容..."
                  value={futurePickerText}
                  onChange={(e) => setFuturePickerText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && futurePickerText.trim()) {
                      const trimmed = futurePickerText.trim();
                      const item: PlanItem = {
                        id: crypto.randomUUID(),
                        type: futurePickerType,
                        text: trimmed,
                        date: futurePickerDate,
                        time: futurePickerType === "reminder" ? futurePickerTime : undefined,
                        createdAt: Date.now(),
                      };
                      setItems((prev) => [item, ...prev]);
                      setFuturePickerText("");
                    }
                  }}
                  maxLength={200}
                />
                <button
                  className="event-btn add-confirm-btn"
                  onClick={() => {
                    if (futurePickerText.trim()) {
                      const trimmed = futurePickerText.trim();
                      const item: PlanItem = {
                        id: crypto.randomUUID(),
                        type: futurePickerType,
                        text: trimmed,
                        date: futurePickerDate,
                        time: futurePickerType === "reminder" ? futurePickerTime : undefined,
                        createdAt: Date.now(),
                      };
                      setItems((prev) => [item, ...prev]);
                      setFuturePickerText("");
                    }
                  }}
                  disabled={!futurePickerText.trim() || (futurePickerType === "reminder" && !futurePickerTime)}
                  title="添加"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </button>
              </div>
              <div className="future-add-meta">
                <div className="add-type-toggle">
                  <button
                    className={`type-btn ${futurePickerType === "event" ? "active" : ""}`}
                    onClick={() => setFuturePickerType("event")}
                  >
                    事件
                  </button>
                  <button
                    className={`type-btn ${futurePickerType === "reminder" ? "active" : ""}`}
                    onClick={() => setFuturePickerType("reminder")}
                  >
                    提醒
                  </button>
                </div>
                {futurePickerType === "reminder" && (
                  <input
                    type="time"
                    className="add-time-input"
                    value={futurePickerTime}
                    onChange={(e) => setFuturePickerTime(e.target.value)}
                  />
                )}
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
                    {group.items.map((item) => (
                      <EventItem
                        key={item.id}
                        item={item}
                        editing={editingItemId === item.id}
                        editText={editText}
                        rebuilding={rebuildingId === item.id}
                        rebuildDate={rebuildDate}
                        rebuildTime={rebuildTime}
                        onEditTextChange={setEditText}
                        onStartEdit={() => startEdit(item.id)}
                        onSaveEdit={saveEdit}
                        onCancelEdit={cancelEdit}
                        onDelete={() => deleteItem(item.id)}
                        onCopy={() => copyItem(item.id)}
                        onStartRebuild={() => startRebuild(item.id)}
                        onRebuildDateChange={setRebuildDate}
                        onRebuildTimeChange={setRebuildTime}
                        onSaveRebuild={saveRebuild}
                        onCancelRebuild={cancelRebuild}
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
                <p className="empty-text">暂无过期记录</p>
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
                      {group.items.map((item) => (
                        <EventItem
                          key={item.id}
                          item={item}
                          editing={editingItemId === item.id}
                          editText={editText}
                          rebuilding={rebuildingId === item.id}
                          rebuildDate={rebuildDate}
                          rebuildTime={rebuildTime}
                          onEditTextChange={setEditText}
                          onStartEdit={() => startEdit(item.id)}
                          onSaveEdit={saveEdit}
                          onCancelEdit={cancelEdit}
                          onDelete={() => deleteItem(item.id)}
                          onCopy={() => copyItem(item.id)}
                          onStartRebuild={() => startRebuild(item.id)}
                          onRebuildDateChange={setRebuildDate}
                          onRebuildTimeChange={setRebuildTime}
                          onSaveRebuild={saveRebuild}
                          onCancelRebuild={cancelRebuild}
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
