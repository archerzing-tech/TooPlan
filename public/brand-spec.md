# TooPlan Brand Spec

## Brand Overview
- **Name**: TooPlan
- **Tagline**: 让每一天都有计划 (Plan every day)
- **Product**: A beautiful cross-platform planning app (Tauri v2 + React)
- **Platform**: Android, Desktop (macOS/Windows/Linux)

## Visual Identity

### Logo
- Custom SVG icon: rounded square with a checkmark + floating dot
- Gradient: #6c63ff → #ff6b9d (purple to pink)

### Color Palette (Light Mode)
| Token | Value | Usage |
|---|---|---|
| `--primary` | `#6c63ff` | Primary buttons, active states, links |
| `--primary-light` | `#8b83ff` | Hover states, highlights |
| `--primary-dark` | `#5a52e0` | Pressed states |
| `--accent` | `#ff6b9d` | Reminder icons, secondary accent |
| `--bg` | `#f0f2f5` | App background |
| `--surface` | `#ffffff` | Card backgrounds |
| `--text` | `#1a1a2e` | Primary text |
| `--text-secondary` | `#6c757d` | Secondary text |
| `--success` | `#2ecc71` | Save/confirm actions |
| `--warning` | `#f39c12` | Warning urgency state |
| `--danger` | `#e74c3c` | Danger urgency state, delete |

### Color Palette (Dark Mode)
| Token | Value |
|---|---|
| `--primary` | `#7c73ff` |
| `--primary-light` | `#9d96ff` |
| `--primary-dark` | `#6c63ff` |
| `--accent` | `#ff6b9d` |
| `--bg` | `#0f0f1a` |
| `--surface` | `#1a1a2e` |
| `--text` | `#e8e8f0` |

### Typography
- Font stack: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans SC", sans-serif`
- Header: 26px, 800 weight, gradient text (primary → accent)
- Body: 14-15px, 400-600 weight
- Time badges: 11px, 700 weight, tabular-nums

### Icons
- Lucide React icons
- Calendar icon: primary color (#6c63ff) for events
- Bell icon: accent color (#ff6b9d) for reminders

### UI Patterns
- Cards with 14px border-radius, subtle shadows
- Left border accent bars for urgency states
- Full-width day cards with header + body layout
- Gradient logo with drop-shadow animation on hover
- Tab-based navigation (安排/历史记录)
- Modal popups for item entry and editing
- TimePicker with dropdown selects (hour:minute)
- Drag handle dots for reordering

### Key Features
1. Today/Week/Future schedule views
2. Event & Reminder type system
3. Time-based reminders with HH:MM format
4. Drag-and-drop sorting (mouse + touch)
5. Urgency colors: normal, warning, danger, expired
6. Reminder rebuild for rescheduling
7. Push notifications with system sound for due reminders
8. Card collapse for past days in week view
9. Copy items for quick duplication
10. Dark mode support
