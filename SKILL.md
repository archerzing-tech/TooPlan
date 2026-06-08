# Tauri v2 Android App Development — 实战技能

> 基于 TooPlan 项目的完整开发、构建与发布经验沉淀。
> 适用于 **Tauri v2 + React + Vite + TypeScript + Rust** 的 Android App 项目。

---

## 如何使用

将此文件拷贝到新项目的根目录，命名为 `SKILL.md`。AI 代理会自动识别并加载项目级技能。

你也可以在项目级 `.AGENTS.md` 中引用：
```
# Use the Tauri Android skill
skill: tauri-android
```

> ⚠️ 本文中的品牌色 (`#6c63ff` / `#ff6b9d`)、包名 (`com.xxx.xxx`)、触摸延迟 (400ms) 等参数均为 TooPlan 项目的参考值。**请根据你的项目品牌和设计规范调整这些值。**

---

## 1. 项目初始化

### 1.1 创建项目

```bash
npm create tauri-app@latest -- --template react-ts
cd my-app
npm install
```

### 1.2 初始化 Android 平台

```bash
npx tauri android init
```

这会生成 `src-tauri/gen/android/` 目录。

> ⚠️ `tauri android init` 需要 Java 17+ 和 Android SDK。本地开发推荐使用 Android Studio 管理 SDK。

---

## 2. 图标管理

### 2.1 推荐方案：Python 脚本生成

避免手动处理多格式图标。推荐用 Python 生成所有图标：

```python
# scripts/gen_icon.py 核心思路
# 1. 在 1024x1024 上绘制高质量图标
# 2. downscale 到目标尺寸
# 3. 输出到 src-tauri/icons/
```

**需要生成的图标格式：**

| 用途 | 目录 | 尺寸 |
|---|---|---|
| Tauri 主图标 | `src-tauri/icons/` | 32x32, 128x128, 256x256, 1024x1024, .icns, .ico |
| Web favicon | `public/vite.svg` | SVG |
| Web 图标 | `public/tauri.svg` | SVG |
| Android 自适应前景 | `mipmap-{density}/ic_launcher_foreground.png` | 48/72/96/144/192px |
| Android 回退图标 | `mipmap-{density}/ic_launcher.png` | 48/72/96/144/192px |
| Android 圆形图标 | `mipmap-{density}/ic_launcher_round.png` | 48/72/96/144/192px |

### 2.2 Android 自适应图标 (API 26+)

修改 `drawable-v24/ic_launcher_foreground.xml` 和 `drawable/ic_launcher_background.xml`：

- 前景：白色 SVG vector path（图标符号）
- 背景：纯色（`#6c63ff`）

修改 `values/ic_launcher_background.xml` 中的颜色值。

### 2.3 macOS .icns / Windows .ico

用 `npx tauri icon` 命令从源 PNG 重新生成：

```bash
npx tauri icon src-tauri/icons/icon.png
```

---

## 3. 前端技术选型

### 3.1 图标库

**Lucide React** — 轻量、tree-shakeable、设计一致性高：

```bash
npm install lucide-react
```

```tsx
import { Calendar, Bell } from "lucide-react";
<Calendar size={14} color="var(--primary)" />
<Bell size={14} color="var(--accent)" />
```

### 3.2 时间选择器

避免使用原生 `<input type="time">`（转盘选择反直觉），改用 **小时+分钟 dropdown**：

```tsx
function TimePicker({ value, onChange }) {
  const [h, m] = value.split(":");
  return (
    <div className="time-picker">
      <select value={h} onChange={...}>
        {HOURS.map(h => <option>{h}</option>)}
      </select>
      <span>:</span>
      <select value={m} onChange={...}>
        {MINUTES.map(m => <option>{m}</option>)}
      </select>
      {/* 快捷预设按钮 */}
    </div>
  );
}
```

**最佳实践：**
- 分钟按 5 分钟间隔（00, 05, 10...55）
- 已有时间吸附到最近 5 分钟边界
- 提供快捷预设：+30分钟、+1小时、+2小时、明天此时
- 去掉 `-webkit-appearance: none` 以保留原生移动端选择器

---

## 4. 数据持久化

### 4.1 使用 localStorage

```tsx
const STORAGE_KEY = "app-items";

function App() {
  const [items, setItems] = useState<PlanItem[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
    return [];
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);
}
```

### 4.2 首次加载默认数据

```tsx
const hasSeenSampleRef = useRef(false);
useEffect(() => {
  if (items.length === 0 && !hasSeenSampleRef.current) {
    hasSeenSampleRef.current = true;
    setItems([/* 默认示例数据 */]);
  }
}, [items.length]);
```

### 4.3 数据迁移

```tsx
function migrateOldData(): PlanItem[] {
  const old = localStorage.getItem("old-storage-key");
  if (old) {
    const migrated = transform(old);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
    localStorage.removeItem("old-storage-key");
    return migrated;
  }
  return [];
}
```

---

## 5. 移动端适配

### 5.1 键盘遮挡问题

```tsx
// 输入框获取焦点时滚动到可见区域
function scrollInputIntoView(e: React.FocusEvent<HTMLInputElement>) {
  setTimeout(() => {
    e.target.scrollIntoView({ behavior: "smooth", block: "center" });
  }, 350);
}
```

### 5.2 动态键盘高度

```tsx
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
```

CSS:
```css
.content {
  padding-bottom: calc(20px + var(--keyboard-height, 0px));
}
```

### 5.3 触摸拖拽

- 使用 `useRef` + 全局 `touchmove`/`touchend` 监听器
- 长按 400ms 激活拖拽
- 浮动克隆跟随手指
- 移动距离 < 12px 视为点击，不激活拖拽

---

## 6. CI/CD — GitHub Actions

### 6.1 构建流程

```yaml
# .github/workflows/release.yml
on:
  push:
    tags:
      - 'v*'
```

**触发方式：** 推送 tag `v0.x.x` 自动触发构建。

### 6.2 本地 Android 开发环境配置

```bash
# 1. 安装 Java 17
brew install openjdk@17

# 2. 安装 Android Studio（自动安装 SDK）
# 下载 https://developer.android.com/studio

# 3. 配置环境变量 (~/.zshrc 或 ~/.bashrc)
export ANDROID_HOME="$HOME/Library/Android/sdk"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$PATH:$ANDROID_HOME/platform-tools"
export PATH="$PATH:$ANDROID_HOME/emulator"

# 4. 安装额外 SDK 组件
sdkmanager --install \
  'platforms;android-34' \
  'build-tools;34.0.0' \
  'ndk;26.1.10909125' \
  'cmake;3.22.1'

# 5. 添加 Rust 交叉编译目标
rustup target add \
  aarch64-linux-android \
  armv7-linux-androideabi \
  x86_64-linux-android \
  i686-linux-android

# 6. 连接设备或启动模拟器后运行
tauri android dev
```

### 6.3 CI/CD 关键环境

| 组件 | 版本 | 说明 |
|---|---|---|
| Node.js | 20 | 前端构建 |
| Rust | stable (via dtolnay/rust-toolchain) | Tauri 后端 |
| Java | 17 (temurin) | Android Gradle |
| Android SDK | platform 34, build-tools 34.0.0 | APK 构建 |
| NDK | 26.1.10909125 | Rust -> Android 交叉编译 |
| CMake | 3.22.1 | NDK 构建工具 |

### 6.4 Rust 交叉编译目标

```yaml
- uses: dtolnay/rust-toolchain@stable
  with:
    targets: |
      aarch64-linux-android
      armv7-linux-androideabi
      x86_64-linux-android
      i686-linux-android
```

### 6.5 Android 签名

**必须的 GitHub Secrets：**

| Secret | 说明 |
|---|---|
| `ANDROID_KEY_BASE64` | keystore 文件 base64 编码 |
| `ANDROID_KEY_ALIAS` | 别名 |
| `ANDROID_KEY_PASSWORD` | 密码 |

**⚠️ 重要：** 同一个 keystore 必须用于所有 release，否则用户无法通过 APK 更新！

生成 keystore 脚本（`scripts/generate-keystore.sh`）：

```bash
#!/bin/bash
KEYSTORE_FILE="tooplan-release.keystore"
keytool -genkey -v -keystore $KEYSTORE_FILE \
  -alias my-key-alias -keyalg RSA -keysize 2048 \
  -validity 10000 -storepass your-password

# 导出 base64
base64 -i $KEYSTORE_FILE | pbcopy
# 粘贴到 GitHub Secrets -> ANDROID_KEY_BASE64
```

### 6.6 版本发布流程

```bash
# 1. 更新版本号
#    package.json, Cargo.toml, tauri.conf.json, CHANGELOG.md

# 2. 构建验证
npm run build

# 3. 提交并打标签
git add -A
git commit -m "feat: vX.Y.Z - 变更描述"
git tag vX.Y.Z
git push origin main --tags
```

### 6.7 CI 失败排查 checklist

- [ ] Secrets 是否已配置？（`ANDROID_KEY_BASE64` 等）
- [ ] Rust 交叉编译目标是否完整？
- [ ] Android SDK 版本与 `build.gradle.kts` 中的 `compileSdk` 一致？
- [ ] keystore 密码与 `keystore.properties` 中的一致？
- [ ] APK 文件路径是否正确？（`arm64-v8a/release/`）

---

## 7. 版本号管理

### 需要同时更新的文件

| 文件 | 字段 |
|---|---|
| `package.json` | `version` |
| `src-tauri/Cargo.toml` | `[package] version` |
| `src-tauri/tauri.conf.json` | `version` |
| `CHANGELOG.md` | 添加新版本条目 |

Android `build.gradle.kts` 中的 `versionName` 和 `versionCode` 由 Tauri 构建工具自动生成，无需手动修改。

### CHANGELOG 格式

```markdown
## [X.Y.Z] — YYYY-MM-DD

### Added
- 新功能

### Changed
- 变更

### Fixed
- Bug 修复
```

---

## 8. 常见问题

### 8.1 APK 构建失败

**症状：** `Could not find compileSdk 36`

**解决：** 安装对应版本：
```bash
sdkmanager --install 'platforms;android-34' 'build-tools;34.0.0'
```

### 8.2 签名失败

**症状：** `Keystore was tampered with, or password was incorrect`

**解决：** 确保 `ANDROID_KEY_BASE64`、`ANDROID_KEY_ALIAS`、`ANDROID_KEY_PASSWORD` 三个 Secret 都正确设置且与生成时一致。

### 8.3 图标不更新

**解决：** 
1. 运行 `python3 scripts/gen_icon.py` 重新生成所有 PNG
2. 运行 `npx tauri icon` 重新生成 .icns / .ico
3. 检查 Android 自适应图标 XML 配置
4. 清除浏览器缓存或重装 App

---

## 9. 项目结构参考

```
my-tauri-app/
├── src/                    # React 前端
│   ├── App.tsx             # 主组件
│   └── App.css             # 样式
├── src-tauri/
│   ├── Cargo.toml          # Rust 依赖
│   ├── tauri.conf.json     # Tauri 配置（含版本号、图标路径）
│   ├── icons/              # 应用图标（PNG, ICNS, ICO, SVG）
│   └── gen/android/        # Android 原生层（自动生成 + 自定义签名）
├── public/
│   ├── vite.svg            # Favicon
│   └── tauri.svg           # Web 图标
├── scripts/
│   └── gen_icon.py         # 图标生成脚本
├── package.json
└── .github/workflows/
    └── release.yml         # CI/CD 发布工作流
```

---

## 10. 核心命令速查

```bash
# 开发
npm run dev                 # 启动 Vite 前端
npx tauri dev               # 启动 Tauri 桌面开发
npx tauri android dev       # 启动 Android 开发（连接设备）

# 构建
npm run build               # 构建前端
npx tauri build             # 构建桌面端
npx tauri android build --apk  # 构建 Android APK

# 图标
python3 scripts/gen_icon.py # 生成/更新所有图标
npx tauri icon              # 生成 .icns / .ico

# 发布
npm run build               # 先确保编译通过
git tag vX.Y.Z && git push origin --tags  # 触发 CI 发布
```
