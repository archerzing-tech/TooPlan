import { useState, useEffect, useRef } from "react";
import { Calendar, Bell, ChevronDown } from "lucide-react";
import "./App.css";

interface PlanItem {
  id: string;
  type: "event" | "reminder";
  text: string;
  date: string; // ISO "YYYY-MM-DD"
  time?: string; // "HH:MM" for reminders
  createdAt: number;
  sortOrder: number; // for drag-reordering within a day
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

/* ──────────── TimePicker: hour + minute dropdowns ──────────── */

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"));

function getDefaultPreset(minutesFromNow: number): string {
  const d = new Date(Date.now() + minutesFromNow * 60 * 1000);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function snapTo5(m: number): string {
  return String(Math.round(m / 5) * 5).padStart(2, "0");
}

function TimePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [hStr, mStr] = value.split(":");
  const h = HOURS.includes(hStr) ? hStr : "00";
  const mNum = parseInt(mStr, 10);
  const m = !isNaN(mNum) && MINUTES.includes(snapTo5(mNum)) ? snapTo5(mNum) : "00";

  return (
    <div className="time-picker">
      <select
        className="time-picker-select"
        value={h}
        onChange={(e) => onChange(`${e.target.value}:${m}`)}
      >
        {HOURS.map((hVal) => (
          <option key={hVal} value={hVal}>{hVal}</option>
        ))}
      </select>
      <span className="time-picker-sep">:</span>
      <select
        className="time-picker-select"
        value={m}
        onChange={(e) => onChange(`${h}:${e.target.value}`)}
      >
        {MINUTES.map((mVal) => (
          <option key={mVal} value={mVal}>{mVal}</option>
        ))}
      </select>
      {/* Quick presets */}
      <div className="time-presets">
        <button
          type="button"
          className={`time-preset-btn ${value === getDefaultPreset(30) ? "active" : ""}`}
          onClick={() => onChange(getDefaultPreset(30))}
          title="30分钟后"
        >
          +30
        </button>
        <button
          type="button"
          className={`time-preset-btn ${value === getDefaultPreset(60) ? "active" : ""}`}
          onClick={() => onChange(getDefaultPreset(60))}
          title="1小时后"
        >
          +1h
        </button>
        <button
          type="button"
          className={`time-preset-btn ${value === getDefaultPreset(120) ? "active" : ""}`}
          onClick={() => onChange(getDefaultPreset(120))}
          title="2小时后"
        >
          +2h
        </button>
        <button
          type="button"
          className={`time-preset-btn ${value === getDefaultPreset(1440) ? "active" : ""}`}
          onClick={() => onChange(getDefaultPreset(1440))}
          title="明天此时"
        >
          明天
        </button>
      </div>
    </div>
  );
}

/* ──────────── Keyboard helper ──────────── */

function scrollInputIntoView(e: React.FocusEvent<HTMLInputElement>) {
  setTimeout(() => {
    e.target.scrollIntoView({ behavior: "smooth", block: "center" });
  }, 350);
}

/* ──────────── Event item ──────────── */

interface EventItemProps {
  item: PlanItem;
  editing: boolean;
  editText: string;
  editTime: string;
  editType: "event" | "reminder";
  rebuilding: boolean;
  rebuildDate: string;
  rebuildTime: string;
  isDragging: boolean;
  isDragOver: boolean;
  onEditTextChange: (v: string) => void;
  onEditTimeChange: (v: string) => void;
  onEditTypeChange: (t: "event" | "reminder") => void;
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
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onTouchDragStart: (id: string, e: React.TouchEvent) => void;
  onTouchDragMove: (e: React.TouchEvent) => void;
  onTouchDragEnd: (e: React.TouchEvent) => void;
}

function EventItem({
  item,
  editing,
  editText,
  editTime,
  editType,
  rebuilding,
  rebuildDate,
  rebuildTime,
  isDragging,
  isDragOver,
  onEditTextChange,
  onEditTimeChange,
  onEditTypeChange,
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
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  onTouchDragStart,
  onTouchDragMove,
  onTouchDragEnd,
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
            onFocus={scrollInputIntoView}
          />
          <TimePicker value={rebuildTime} onChange={onRebuildTimeChange} />
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

  const canDrag = !editing;

  return (
    <div
      className={`event-item ${isPast ? "past" : ""} urgency-${urgency} ${isDragging ? "dragging" : ""} ${isDragOver ? "drag-over" : ""}`}
      data-item-id={item.id}
      draggable={canDrag}
      onDragStart={canDrag ? onDragStart : undefined}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      onTouchStart={canDrag ? (e) => onTouchDragStart(item.id, e) : undefined}
      onTouchMove={canDrag ? onTouchDragMove : undefined}
      onTouchEnd={canDrag ? onTouchDragEnd : undefined}
    >
      {canDrag && (
        <span className="drag-handle" title="拖拽排序">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="8" cy="6" r="1.5" />
            <circle cx="16" cy="6" r="1.5" />
            <circle cx="8" cy="12" r="1.5" />
            <circle cx="16" cy="12" r="1.5" />
            <circle cx="8" cy="18" r="1.5" />
            <circle cx="16" cy="18" r="1.5" />
          </svg>
        </span>
      )}
      {editing ? (
        <div className="event-edit-wrapper">
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
              onFocus={scrollInputIntoView}
              autoFocus
              maxLength={200}
            />
            {editType === "reminder" && (
              <TimePicker value={editTime} onChange={onEditTimeChange} />
            )}
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
          <div className="edit-meta-row">
            <div className="add-type-toggle">
              <button
                className={`type-btn ${editType === "event" ? "active" : ""}`}
                onClick={() => onEditTypeChange("event")}
              >
                事件
              </button>
              <button
                className={`type-btn ${editType === "reminder" ? "active" : ""}`}
                onClick={() => onEditTypeChange("reminder")}
              >
                提醒
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="event-content">
            {item.type === "reminder" && item.time && (
              <span className="event-time-badge">{item.time}</span>
            )}
            {item.type === "event" ? (
              <Calendar size={14} className="event-type-icon event-type-icon-calendar" />
            ) : (
              <Bell size={14} className="event-type-icon event-type-icon-bell" />
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
  editTime: string;
  editType: "event" | "reminder";
  rebuildingId: string | null;
  rebuildDate: string;
  rebuildTime: string;
  newItemDate: string | null;
  newItemText: string;
  newItemType: "event" | "reminder";
  newItemTime: string;
  dragId: string | null;
  dragOverId: string | null;
  onEditTextChange: (v: string) => void;
  onEditTimeChange: (v: string) => void;
  onEditTypeChange: (t: "event" | "reminder") => void;
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
  onMoveItem: (dragId: string, targetId: string, position: "before" | "after") => void;
  onSetDragId: (id: string | null) => void;
  onSetDragOverId: (id: string | null) => void;
  onTouchDragStart: (id: string, e: React.TouchEvent) => void;
  onTouchDragMove: (e: React.TouchEvent) => void;
  onTouchDragEnd: (e: React.TouchEvent) => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  isToday?: boolean;
}

function DayCard({
  date,
  items,
  editingItemId,
  editText,
  editTime,
  editType,
  rebuildingId,
  rebuildDate,
  rebuildTime,
  newItemDate,
  newItemText,
  newItemType,
  newItemTime,
  dragId,
  dragOverId,
  onEditTextChange,
  onEditTimeChange,
  onEditTypeChange,
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
  onMoveItem,
  onSetDragId,
  onSetDragOverId,
  onTouchDragStart,
  onTouchDragMove,
  onTouchDragEnd,
  collapsed,
  onToggleCollapse,
  isToday,
}: DayCardProps) {
  const isPast = isDateBeforeToday(date);
  const isAdding = newItemDate === date;

  return (
    <div className={`day-card ${isPast ? "past" : ""} ${isToday ? "today" : ""} ${collapsed ? "collapsed" : ""}`}>
      {collapsed ? (
        <>
          <div className="day-card-header collapse-header" onClick={onToggleCollapse}>
            <div className="day-card-title">
              <ChevronDown size={14} className="collapse-chevron" />
              <span className="day-name">{getDayName(date)}</span>
              <span className="day-date">{getMonthDay(date)}</span>
              {isToday && <span className="today-tag">今天</span>}
            </div>
            <span className="event-count">{items.length} 项</span>
          </div>
          {items.length > 0 && (
            <div className="collapse-preview" onClick={onToggleCollapse}>
              {items.slice(0, 2).map((item, idx) => (
                <span key={idx} className="collapse-preview-text">
                  {item.type === "event" ? "📅" : "🔔"} {item.text}
                </span>
              ))}
              {items.length > 2 && <span className="collapse-preview-more">等 {items.length} 项</span>}
            </div>
          )}
        </>
      ) : (
        <>
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
                editTime={editTime}
                editType={editType}
                rebuilding={rebuildingId === item.id}
                rebuildDate={rebuildDate}
                rebuildTime={rebuildTime}
                isDragging={dragId === item.id}
                isDragOver={dragOverId === item.id}
                onEditTextChange={onEditTextChange}
                onEditTimeChange={onEditTimeChange}
                onEditTypeChange={onEditTypeChange}
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
                onDragStart={(e) => {
                  e.dataTransfer.setData("text/plain", item.id);
                  e.dataTransfer.effectAllowed = "move";
                  onSetDragId(item.id);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  if (dragId && dragId !== item.id) {
                    onSetDragOverId(item.id);
                  }
                }}
                onDragLeave={() => {
                  if (dragOverId === item.id) {
                    onSetDragOverId(null);
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const draggedId = e.dataTransfer.getData("text/plain");
                  if (draggedId && draggedId !== item.id) {
                    onMoveItem(draggedId, item.id, "before");
                  }
                  onSetDragId(null);
                  onSetDragOverId(null);
                }}
                onDragEnd={() => {
                  onSetDragId(null);
                  onSetDragOverId(null);
                }}
                onTouchDragStart={onTouchDragStart}
                onTouchDragMove={onTouchDragMove}
                onTouchDragEnd={onTouchDragEnd}
              />
            ))}

            {/* Drop zone at the end of the list */}
            {dragId && items.length > 0 && (
              <div
                className={`drop-zone-bottom ${dragOverId === "__bottom__" ? "drag-over" : ""}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  onSetDragOverId("__bottom__");
                }}
                onDragLeave={() => {
                  if (dragOverId === "__bottom__") onSetDragOverId(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const draggedId = e.dataTransfer.getData("text/plain");
                  if (draggedId) {
                    onMoveItem(draggedId, items[items.length - 1].id, "after");
                  }
                  onSetDragId(null);
                  onSetDragOverId(null);
                }}
              >
                <span>拖放到此处</span>
              </div>
            )}

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
                  onFocus={scrollInputIntoView}
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
                    <TimePicker value={newItemTime} onChange={newItemTimeChange} />
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
        </>
      )}
    </div>
  );
}

/* ──────────── Grouped items list ──────────── */

interface DraggableEventListProps {
  items: PlanItem[];
  editingItemId: string | null;
  editText: string;
  editTime: string;
  editType: "event" | "reminder";
  rebuildingId: string | null;
  rebuildDate: string;
  rebuildTime: string;
  dragId: string | null;
  dragOverId: string | null;
  onEditTextChange: (v: string) => void;
  onEditTimeChange: (v: string) => void;
  onEditTypeChange: (t: "event" | "reminder") => void;
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
  onMoveItem: (dragId: string, targetId: string, position: "before" | "after") => void;
  onSetDragId: (id: string | null) => void;
  onSetDragOverId: (id: string | null) => void;
  onTouchDragStart: (id: string, e: React.TouchEvent) => void;
  onTouchDragMove: (e: React.TouchEvent) => void;
  onTouchDragEnd: (e: React.TouchEvent) => void;
}

function DraggableEventList({
  items,
  editingItemId,
  editText,
  editTime,
  editType,
  rebuildingId,
  rebuildDate,
  rebuildTime,
  dragId,
  dragOverId,
  onEditTextChange,
  onEditTimeChange,
  onEditTypeChange,
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
  onMoveItem,
  onSetDragId,
  onSetDragOverId,
  onTouchDragStart,
  onTouchDragMove,
  onTouchDragEnd,
}: DraggableEventListProps) {
  return (
    <>
      {items.map((item) => (
        <EventItem
          key={item.id}
          item={item}
          editing={editingItemId === item.id}
          editText={editText}
          editTime={editTime}
          editType={editType}
          rebuilding={rebuildingId === item.id}
          rebuildDate={rebuildDate}
          rebuildTime={rebuildTime}
          isDragging={dragId === item.id}
          isDragOver={dragOverId === item.id}
          onEditTextChange={onEditTextChange}
          onEditTimeChange={onEditTimeChange}
          onEditTypeChange={onEditTypeChange}
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
          onDragStart={(e) => {
            e.dataTransfer.setData("text/plain", item.id);
            e.dataTransfer.effectAllowed = "move";
            onSetDragId(item.id);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
            if (dragId && dragId !== item.id) {
              onSetDragOverId(item.id);
            }
          }}
          onDragLeave={() => {
            if (dragOverId === item.id) onSetDragOverId(null);
          }}
          onDrop={(e) => {
            e.preventDefault();
            const draggedId = e.dataTransfer.getData("text/plain");
            if (draggedId && draggedId !== item.id) {
              onMoveItem(draggedId, item.id, "before");
            }
            onSetDragId(null);
            onSetDragOverId(null);
          }}
          onDragEnd={() => {
            onSetDragId(null);
            onSetDragOverId(null);
          }}
          onTouchDragStart={onTouchDragStart}
          onTouchDragMove={onTouchDragMove}
          onTouchDragEnd={onTouchDragEnd}
        />
      ))}
      {dragId && items.length > 0 && (
        <div
          className={`drop-zone-bottom ${dragOverId === "__bottom__" ? "drag-over" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
            onSetDragOverId("__bottom__");
          }}
          onDragLeave={() => {
            if (dragOverId === "__bottom__") onSetDragOverId(null);
          }}
          onDrop={(e) => {
            e.preventDefault();
            const draggedId = e.dataTransfer.getData("text/plain");
            if (draggedId) {
              onMoveItem(draggedId, items[items.length - 1].id, "after");
            }
            onSetDragId(null);
            onSetDragOverId(null);
          }}
        >
          <span>拖放到此处</span>
        </div>
      )}
    </>
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

/** Sort items by sortOrder (ascending = first to last) */
function sortByOrder(items: PlanItem[]): PlanItem[] {
  return [...items].sort((a, b) => a.sortOrder - b.sortOrder);
}

/* ──────────── App ──────────── */

const STORAGE_KEY = "tooplan-items";

function migrateOldData(): PlanItem[] {
  try {
    const old = JSON.parse(localStorage.getItem("tooplan-events") || "null");
    if (Array.isArray(old)) {
      const migrated: PlanItem[] = old.map((e: any, idx: number) => ({
        id: e.id || crypto.randomUUID(),
        type: "event",
        text: e.text || "",
        date: e.date || getToday(),
        createdAt: e.createdAt || Date.now(),
        sortOrder: idx * 1000,
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
      if (Array.isArray(saved)) {
        return saved.map((e: any, idx: number) => ({
          ...e,
          sortOrder: e.sortOrder ?? idx * 1000,
        }));
      }
    } catch {}
    return migrateOldData();
  });

  // Default sample data for first launch
  const hasSeenSampleRef = useRef(false);
  useEffect(() => {
    if (items.length === 0 && !hasSeenSampleRef.current) {
      hasSeenSampleRef.current = true;
      setItems([
        {
          id: crypto.randomUUID(),
          type: "event",
          text: "欢迎使用 TooPlan! 这是一个示例事件，点击可编辑",
          date: getToday(),
          createdAt: Date.now(),
          sortOrder: 0,
        },
        {
          id: crypto.randomUUID(),
          type: "reminder",
          text: "这是一个提醒示例，可设置具体时间",
          date: getToday(),
          time: getNowTime(),
          createdAt: Date.now(),
          sortOrder: 1000,
        },
      ]);
    }
  }, [items.length]);

  const [mainTab, setMainTab] = useState<MainTab>("schedule");
  const [scheduleTab, setScheduleTab] = useState<ScheduleTab>("today");
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [editTime, setEditTime] = useState("");
  const [editType, setEditType] = useState<"event" | "reminder">("event");
  const [newItemDate, setNewItemDate] = useState<string | null>(null);
  const [newItemText, setNewItemText] = useState("");
  const [newItemType, setNewItemType] = useState<"event" | "reminder">("event");
  const [newItemTime, setNewItemTime] = useState(getNowTime());
  const [rebuildingId, setRebuildingId] = useState<string | null>(null);
  const [rebuildDate, setRebuildDate] = useState(getToday());
  const [rebuildTime, setRebuildTime] = useState(getNowTime());
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());

  const toggleExpandDay = (date: string) => {
    setExpandedDays((prev) => {
      const next = new Set(prev);
      if (next.has(date)) {
        next.delete(date);
      } else {
        next.add(date);
      }
      return next;
    });
  };

  /* ── Toggle expand for a day in week view ── */

  const touchState = useRef({
    active: false,
    dragId: "",
    startX: 0,
    startY: 0,
  });
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const cloneRef = useRef<HTMLDivElement>(null);

  // Stable refs for global listener cleanup
  const onGlobalTouchMoveRef = useRef<(e: TouchEvent) => void>(() => {});
  const onGlobalTouchEndRef = useRef<(e: TouchEvent) => void>(() => {});

  // Clean up global listeners on unmount
  useEffect(() => {
    return () => {
      clearTimeout(longPressTimer.current);
      document.removeEventListener("touchmove", onGlobalTouchMoveRef.current);
      document.removeEventListener("touchend", onGlobalTouchEndRef.current);
    };
  }, []);

  function onGlobalTouchMove(e: TouchEvent) {
    e.preventDefault();
    const touch = e.touches[0];
    const x = touch.clientX;
    const y = touch.clientY;

    // Move clone
    if (cloneRef.current) {
      cloneRef.current.style.left = `${x}px`;
      cloneRef.current.style.top = `${y}px`;
    }

    // Detect element under finger
    if (cloneRef.current) cloneRef.current.style.display = "none";
    const el = document.elementFromPoint(x, y);
    if (cloneRef.current) cloneRef.current.style.display = "block";

    const itemEl = el?.closest("[data-item-id]") as HTMLElement | null;
    if (itemEl) {
      const targetId = itemEl.dataset.itemId;
      if (targetId && targetId !== touchState.current.dragId) {
        setDragOverId(targetId);
        return;
      }
    }
    setDragOverId(null);
  }

  const moveItemRef = useRef<(id: string, target: string, pos: "before" | "after") => void>(null!);

  function onGlobalTouchEnd(e: TouchEvent) {
    const touch = e.changedTouches[0];
    const x = touch.clientX;
    const y = touch.clientY;
    const dragIdValue = touchState.current.dragId;

    // Cleanup global listeners
    document.removeEventListener("touchmove", onGlobalTouchMoveRef.current);
    document.removeEventListener("touchend", onGlobalTouchEndRef.current);

    // Hide clone to detect element under finger
    if (cloneRef.current) cloneRef.current.style.display = "none";
    const el = document.elementFromPoint(x, y);
    if (cloneRef.current) cloneRef.current.style.display = "none";

    if (touchState.current.active && dragIdValue) {
      const itemEl = el?.closest("[data-item-id]") as HTMLElement | null;
      if (itemEl) {
        const targetId = itemEl.dataset.itemId;
        if (targetId && targetId !== dragIdValue) {
          moveItemRef.current(dragIdValue, targetId, "before");
        }
      }
    }

    // Cleanup
    touchState.current.active = false;
    setDragId(null);
    setDragOverId(null);
  }

  const handleTouchDragStart = (id: string, e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchState.current = {
      active: false,
      dragId: id,
      startX: touch.clientX,
      startY: touch.clientY,
    };

    clearTimeout(longPressTimer.current);
    longPressTimer.current = setTimeout(() => {
      touchState.current.active = true;
      setDragId(id);

      // Show floating clone
      if (cloneRef.current) {
        const item = items.find((i) => i.id === id);
        cloneRef.current.textContent = item?.text || "";
        cloneRef.current.style.display = "block";
        cloneRef.current.style.left = `${touch.clientX}px`;
        cloneRef.current.style.top = `${touch.clientY}px`;
      }

      // Assign current handlers to refs for consistent cleanup
      onGlobalTouchMoveRef.current = onGlobalTouchMove;
      onGlobalTouchEndRef.current = onGlobalTouchEnd;
      // Add global listeners using refs (ensures removeEventListener works)
      document.addEventListener("touchmove", onGlobalTouchMoveRef.current, { passive: false });
      document.addEventListener("touchend", onGlobalTouchEndRef.current);
    }, 400);
  };

  const handleTouchDragMove = (e: React.TouchEvent) => {
    if (!touchState.current.active && longPressTimer.current) {
      const touch = e.touches[0];
      const dx = touch.clientX - touchState.current.startX;
      const dy = touch.clientY - touchState.current.startY;
      if (Math.abs(dx) > 12 || Math.abs(dy) > 12) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = undefined;
      }
    }
  };

  const handleTouchDragEnd = (_e: React.TouchEvent) => {
    clearTimeout(longPressTimer.current);
  };

  /* ── localStorage ── */

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  /* ── visualViewport ── */

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const onResize = () => {
      const keyboardHeight = window.innerHeight - vv.height;
      document.documentElement.style.setProperty("--keyboard-height", `${keyboardHeight}px`);
    };
    vv.addEventListener("resize", onResize);
    return () => vv.removeEventListener("resize", onResize);
  }, []);

  /* ── item CRUD ── */

  const addItem = (date: string) => {
    const trimmed = newItemText.trim();
    if (!trimmed || newItemDate !== date) return;
    if (newItemType === "reminder" && !newItemTime) return;
    const dayItems = items.filter((e) => e.date === date);
    const maxOrder = dayItems.reduce((max, e) => Math.max(max, e.sortOrder), 0);
    const item: PlanItem = {
      id: crypto.randomUUID(),
      type: newItemType,
      text: trimmed,
      date,
      time: newItemType === "reminder" ? newItemTime : undefined,
      createdAt: Date.now(),
      sortOrder: maxOrder + 1000,
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
    setEditTime(ev.time || getNowTime());
    setEditType(ev.type);
  };

  const doSaveEdit = () => {
    if (!editingItemId) return;
    const trimmed = editText.trim();
    if (!trimmed) {
      deleteItem(editingItemId);
      return;
    }
    setItems((prev) =>
      prev.map((e) =>
        e.id === editingItemId
          ? { ...e, text: trimmed, type: editType, time: editType === "reminder" ? editTime : undefined }
          : e,
      ),
    );
    setEditingItemId(null);
    setEditText("");
    setEditTime("");
    setEditType("event");
  };

  const doCancelEdit = () => {
    setEditingItemId(null);
    setEditText("");
    setEditTime("");
    setEditType("event");
  };

  const copyItem = (id: string) => {
    const original = items.find((e) => e.id === id);
    if (!original) return;
    const dayItems = items.filter((e) => e.date === original.date);
    const maxOrder = dayItems.reduce((max, e) => Math.max(max, e.sortOrder), 0);
    const copy: PlanItem = {
      ...original,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      sortOrder: maxOrder + 1000,
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
    const dayItems = items.filter((e) => e.date === rebuildDate);
    const maxOrder = dayItems.reduce((max, e) => Math.max(max, e.sortOrder), 0);
    setItems((prev) =>
      prev.map((e) =>
        e.id === rebuildingId
          ? { ...e, date: rebuildDate, time: rebuildTime, createdAt: Date.now(), sortOrder: maxOrder + 1000 }
          : e,
      ),
    );
    setRebuildingId(null);
  };

  const cancelRebuild = () => {
    setRebuildingId(null);
  };

  /* ── drag reorder ── */

  const moveItem = (draggedId: string, targetId: string, position: "before" | "after") => {
    setItems((prev) => {
      const dragged = prev.find((e) => e.id === draggedId);
      const target = prev.find((e) => e.id === targetId);
      if (!dragged || !target) return prev;

      const sameDateItems = prev.filter((e) => e.date === target.date).sort((a, b) => a.sortOrder - b.sortOrder);
      const targetIndex = sameDateItems.findIndex((e) => e.id === targetId);
      if (targetIndex === -1) return prev;

      let newOrder: number;
      if (position === "before") {
        if (targetIndex === 0) {
          newOrder = sameDateItems[0].sortOrder - 1000;
        } else {
          newOrder = (sameDateItems[targetIndex - 1].sortOrder + sameDateItems[targetIndex].sortOrder) / 2;
        }
      } else {
        if (targetIndex >= sameDateItems.length - 1) {
          newOrder = sameDateItems[sameDateItems.length - 1].sortOrder + 1000;
        } else {
          newOrder = (sameDateItems[targetIndex].sortOrder + sameDateItems[targetIndex + 1].sortOrder) / 2;
        }
      }

      return prev.map((e) =>
        e.id === draggedId ? { ...e, sortOrder: newOrder, date: target.date } : e,
      );
    });
  };
  moveItemRef.current = moveItem;

  /* ── derived data ── */

  const today = getToday();
  const weekDates = getWeekDates();

  const getItemsForDay = (d: string) => sortByOrder(items.filter((e) => e.date === d));

  const todayItems = getItemsForDay(today);

  const futureItems = items.filter((e) => e.date > weekDates[6]);
  const futureGroups = groupByDate(futureItems);

  const historyItems = items
    .filter((e) => isItemExpired(e))
    .sort((a, b) => b.date.localeCompare(a.date) || a.sortOrder - b.sortOrder);
  const historyGroups = groupByDate(historyItems);

  const [futurePickerDate, setFuturePickerDate] = useState(getNextWeekday());
  const [futurePickerText, setFuturePickerText] = useState("");
  const [futurePickerType, setFuturePickerType] = useState<"event" | "reminder">("event");
  const [futurePickerTime, setFuturePickerTime] = useState(getNowTime());

  return (
    <div className="app">
      {/* Floating clone for touch drag */}
      <div className="touch-drag-clone" ref={cloneRef} />

      {/* ── Header ── */}
      <header className="header">
        <div className="header-left">
          <svg className="header-icon" width="30" height="30" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="iconGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#6c63ff" />
                <stop offset="100%" stopColor="#ff6b9d" />
              </linearGradient>
            </defs>
            <rect x="42" y="42" width="428" height="428" rx="96" ry="96" fill="url(#iconGrad)" />
            <polyline points="180,280 250,350 360,210" fill="none" stroke="white" strokeWidth="36" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="380" cy="190" r="14" fill="white" />
          </svg>
          <h1>TooPlan</h1>
        </div>
      </header>

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

      <main className="content">
        {mainTab === "schedule" && scheduleTab === "today" && (
          <div className="day-view">
            <DayCard
              date={today}
              isToday
              items={todayItems}
              editingItemId={editingItemId}
              editText={editText}
              editTime={editTime}
              editType={editType}
              rebuildingId={rebuildingId}
              rebuildDate={rebuildDate}
              rebuildTime={rebuildTime}
              newItemDate={newItemDate}
              newItemText={newItemText}
              newItemType={newItemType}
              newItemTime={newItemTime}
              dragId={dragId}
              dragOverId={dragOverId}
              onEditTextChange={setEditText}
              onEditTimeChange={setEditTime}
              onEditTypeChange={setEditType}
              onStartEdit={startEdit}
              onSaveEdit={doSaveEdit}
              onCancelEdit={doCancelEdit}
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
              onMoveItem={moveItem}
              onSetDragId={setDragId}
              onSetDragOverId={setDragOverId}
              onTouchDragStart={handleTouchDragStart}
              onTouchDragMove={handleTouchDragMove}
              onTouchDragEnd={handleTouchDragEnd}
            />
          </div>
        )}

        {mainTab === "schedule" && scheduleTab === "week" && (
          <div className="week-grid">
            {weekDates.map((date) => {
              const isPastDate = isDateBeforeToday(date);
              const isCollapsed = isPastDate && !expandedDays.has(date);
              return (
                <DayCard
                  key={date}
                  date={date}
                  isToday={date === today}
                  items={getItemsForDay(date)}
                  collapsed={isCollapsed}
                  onToggleCollapse={() => toggleExpandDay(date)}
                  editingItemId={editingItemId}
                  editText={editText}
                  editTime={editTime}
                  editType={editType}
                  rebuildingId={rebuildingId}
                  rebuildDate={rebuildDate}
                  rebuildTime={rebuildTime}
                  newItemDate={newItemDate}
                  newItemText={newItemText}
                  newItemType={newItemType}
                  newItemTime={newItemTime}
                  dragId={dragId}
                  dragOverId={dragOverId}
                  onEditTextChange={setEditText}
                  onEditTimeChange={setEditTime}
                  onEditTypeChange={setEditType}
                  onStartEdit={startEdit}
                  onSaveEdit={doSaveEdit}
                  onCancelEdit={doCancelEdit}
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
                  onMoveItem={moveItem}
                  onSetDragId={setDragId}
                  onSetDragOverId={setDragOverId}
                  onTouchDragStart={handleTouchDragStart}
                  onTouchDragMove={handleTouchDragMove}
                  onTouchDragEnd={handleTouchDragEnd}
                />
              );
            })}
          </div>
        )}

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
                  onFocus={scrollInputIntoView}
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
                        sortOrder: Date.now(),
                      };
                      setItems((prev) => [item, ...prev]);
                      setFuturePickerText("");
                    }
                  }}
                  onFocus={scrollInputIntoView}
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
                        sortOrder: Date.now(),
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
                  <TimePicker value={futurePickerTime} onChange={setFuturePickerTime} />
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
                    <DraggableEventList
                      items={sortByOrder(group.items)}
                      editingItemId={editingItemId}
                      editText={editText}
                      editTime={editTime}
                      editType={editType}
                      rebuildingId={rebuildingId}
                      rebuildDate={rebuildDate}
                      rebuildTime={rebuildTime}
                      dragId={dragId}
                      dragOverId={dragOverId}
                      onEditTextChange={setEditText}
                      onEditTimeChange={setEditTime}
                      onEditTypeChange={setEditType}
                      onStartEdit={startEdit}
                      onSaveEdit={doSaveEdit}
                      onCancelEdit={doCancelEdit}
                      onDelete={deleteItem}
                      onCopy={copyItem}
                      onStartRebuild={startRebuild}
                      onRebuildDateChange={setRebuildDate}
                      onRebuildTimeChange={setRebuildTime}
                      onSaveRebuild={saveRebuild}
                      onCancelRebuild={cancelRebuild}
                      onMoveItem={moveItem}
                      onSetDragId={setDragId}
                      onSetDragOverId={setDragOverId}
                      onTouchDragStart={handleTouchDragStart}
                      onTouchDragMove={handleTouchDragMove}
                      onTouchDragEnd={handleTouchDragEnd}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        )}

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
                      <DraggableEventList
                        items={sortByOrder(group.items)}
                        editingItemId={editingItemId}
                        editText={editText}
                        editTime={editTime}
                        editType={editType}
                        rebuildingId={rebuildingId}
                        rebuildDate={rebuildDate}
                        rebuildTime={rebuildTime}
                        dragId={dragId}
                        dragOverId={dragOverId}
                        onEditTextChange={setEditText}
                        onEditTimeChange={setEditTime}
                        onEditTypeChange={setEditType}
                        onStartEdit={startEdit}
                        onSaveEdit={doSaveEdit}
                        onCancelEdit={doCancelEdit}
                        onDelete={deleteItem}
                        onCopy={copyItem}
                        onStartRebuild={startRebuild}
                        onRebuildDateChange={setRebuildDate}
                        onRebuildTimeChange={setRebuildTime}
                        onSaveRebuild={saveRebuild}
                        onCancelRebuild={cancelRebuild}
                        onMoveItem={moveItem}
                        onSetDragId={setDragId}
                        onSetDragOverId={setDragOverId}
                        onTouchDragStart={handleTouchDragStart}
                        onTouchDragMove={handleTouchDragMove}
                        onTouchDragEnd={handleTouchDragEnd}
                      />
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
