# Changelog

All notable changes to the TooPlan project will be documented in this file.

## [0.3.1] — 2026-06-08

### Fixed
- 修复 Android 13+ 启动时因缺少 POST_NOTIFICATIONS 权限导致的闪退
- 加固 crypto.randomUUID() 调用，防止部分 WebView 不兼容导致崩溃
- 修复 checkReminders 异步未捕获 Promise rejection 的潜在风险

## [0.3.0] — 2026-06-08

### Added
- 提醒/事件的录入和编辑改为弹出窗口（Modal），支持背景点击/Escape 关闭
- 提醒到期推送通知 + 系统铃声（tauri-plugin-notification）
- 未来日程的添加也改为弹出窗口
- Huashu Design App 宣传动画（public/tooplan-hero.html）
- brand-spec.md 品牌资产文档

### Changed
- EventItem/DayCard/DraggableEventList 组件大幅简化（移除了 ~30 个冗余 props）
- 清理了内联编辑遗留的死 CSS 代码
- 使用 useCallback 优化 Modal 组件性能

## [0.2.9] — 2026-06-05

### Added
- Lucide React icons (Calendar/Bell) to event/reminder cards with brand colors
- Default sample data: one event and one reminder on first launch
- Week view: past-due cards collapsed by default with expand toggle
- TimePicker: hour/minute dropdowns replacing native time wheel with quick presets (+30, +1h, +2h, 明天)

### Changed
- Redesigned app icon: checkmark symbol on purple-pink gradient
- All platform icons regenerated (macOS .icns, Windows .ico, Android mipmap PNGs)
- Android adaptive icons updated to match new design

## [0.2.8] — 2026-06-05

### Added
- Drag-and-drop reordering for cards with visual drag handle (≡) and drop zone
- Touch long-press activation (400ms) for drag on touchscreen devices with floating clone
- `scripts/generate-keystore.sh` helper for GitHub Secrets setup

### Changed
- Redesigned app icon: modern rounded-square gradient background with "TP" monogram
- Updated header icon in App.tsx to match the new app icon

### Fixed
- APK signing inconsistency: generated stable keystore (`tooplan-release.keystore`) so updates install correctly
- CI workflow now fails if `ANDROID_KEY_BASE64` secret is missing (no more temporary keystores)

## [0.2.7] — 2026-06-05

### Fixed
- Mobile keyboard covering input fields when editing cards at the bottom of the screen
  - Added `scrollIntoView` on input focus to scroll the field into view
  - Added `visualViewport` listener for dynamic bottom padding (`--keyboard-height`)
- Reminder items could not be fully edited in edit mode
  - Added time input field when editing reminder cards
  - Added type toggle (event/reminder) in edit mode

## [0.2.6] — 2026-06-05

### Changed
- Version bump only

## [0.2.5] — 2026-06-05

### Added
- Reminder functionality with time-based notifications
- Urgency color coding for cards

## [0.2.4] — 2026-06-05

### Fixed
- Adopted official Tauri v2 keystore.properties approach for Android signing in CI

## [0.2.3] — 2026-06-05

### Fixed
- Aligned keystore password between generation script and Gradle build in CI

## [0.2.2] — 2026-06-05

### Fixed
- APK signing failure by generating the signing keystore during CI workflow

## [0.2.1] — 2026-06-05

### Fixed
- CI release failures by removing Aliyun Maven mirrors
- APK file path resolution in release workflow

## [0.2.0] — 2026-05-20

### Added
- Card-based schedule layout for daily planning
- Bell icon in the app header
- History view for past plans

### Fixed
- CI build by removing `sccache` from cargo configuration

## [0.1.0] — 2026-05-15

### Changed
- Optimized CI build process: use npm for Tauri CLI installation for faster builds

### Added
- Initial project setup as a Tauri v2 Android TodoList app
