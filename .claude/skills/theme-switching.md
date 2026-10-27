# 主题切换开发规范

## 架构概览

应用主题由**终端配色主题**驱动，切换终端主题时自动同步整体 UI 风格。

```
终端主题 (TerminalThemeProvider)
    ↓ getTerminalThemeObject()
    ↓ 提取 background/foreground/blue/brightBlack
MainLayout.tsx useEffect
    ↓ 计算 CSS 变量 → document.documentElement.style
    ↓ 设置 data-theme 属性 → 'light' | 'dark'
    ↓ 同步 settingsStore.currentTheme → Ant Design ConfigProvider
    ↓
┌───────────────────────────────────────┐
│  Ant Design darkAlgorithm / defaultAlgorithm  │
│  CSS 变量 --ui-*, --chat-*            │
│  variables.css [data-theme='dark']    │
└───────────────────────────────────────┘
```

## 核心文件

| 文件 | 职责 |
|------|------|
| `src/components/Terminal/TerminalThemeProvider.tsx` | 13 个终端主题定义，`getTerminalThemeObject()` 导出 |
| `src/components/Layout/MainLayout.tsx` | `useEffect` 同步终端主题 → CSS 变量 + data-theme + settingsStore |
| `src/App.tsx` | ConfigProvider 根据 `settingsStore.currentTheme` 切换 `darkAlgorithm` / `defaultAlgorithm` |
| `src/stores/settingsStore.ts` | `currentTheme: 'light' \| 'dark'`、`setTheme()`、`BUILT_IN_TERMINAL_THEMES` |
| `src/styles/themes/variables.css` | `:root` 亮色变量 + `[data-theme='dark']` 暗色变量 |
| `src/styles/themes/light.ts` | Ant Design 亮色主题 Token 配置 |
| `src/styles/themes/dark.ts` | Ant Design 暗色主题 Token 配置 |
| `src/styles/global.css` | 末尾的 Terminal Theme Sync 段 + Chat Panel 段使用 `var(--ui-*)` / `var(--chat-*)` |

## CSS 变量体系

### 由 MainLayout 动态设置（终端主题驱动）

| 变量 | 用途 | 来源 |
|------|------|------|
| `--ui-bg` | 整体背景 | theme.background |
| `--ui-bg-alt` | 侧边栏/标题栏 | 混合(bg, fg, 4-6%) |
| `--ui-panel` | 卡片/面板 | 亮: #fff / 暗: 混合(bg, fg, 7%) |
| `--ui-text` | 主文字 | theme.foreground |
| `--ui-text-muted` | 次要文字 | theme.brightBlack |
| `--ui-border` | 边框 | 混合(bg, fg, 16-18%) |
| `--ui-accent` | 强调色 | theme.blue |
| `--ui-accent-soft` | 柔和强调 | 混合(bg, blue, 15-20%) |
| `--ui-hover` | 悬停背景 | 混合(bg, fg, 4-8%) |
| `--ui-active` | 激活背景 | 混合(bg, blue, 8-14%) |
| `--ui-terminal-bg` | 终端区域 | theme.background |

### 由 variables.css 静态定义（light/dark 切换）

| 变量 | 用途 |
|------|------|
| `--bg-base` / `--bg-container` | 基础背景 |
| `--text-primary` / `--text-secondary` | 文字层次 |
| `--border-base` / `--border-primary` | 边框 |
| `--accent-primary` / `--accent-success` / ... | 语义色彩 |
| `--chat-bg` | 对话面板背景 |
| `--chat-bubble-user` / `--chat-bubble-ai` | 气泡背景 |
| `--chat-text-ai` / `--chat-text-user` / `--chat-text-muted` | 对话文字 |
| `--chat-tool-*` | 工具调用区块 |

## 开发规范

### 添加新 UI 元素时

1. **使用 CSS 变量**，禁止硬编码颜色：
   ```css
   /* ✅ 正确 */
   .my-component {
     background: var(--ui-panel);
     color: var(--ui-text);
     border: 1px solid var(--ui-border);
   }

   /* ❌ 错误 */
   .my-component {
     background: #ffffff;
     color: #333333;
   }
   ```

2. **对话组件**使用 `--chat-*` 变量

3. **Ant Design 组件**会自动跟随 ConfigProvider 的 algorithm 切换

### 添加新终端主题时

1. 在 `TerminalThemeProvider.tsx` 中添加主题定义
2. 在 `MainLayout.tsx` 的 `themeOptions` 数组中添加条目
3. 在 `settingsStore.ts` 的 `BUILT_IN_TERMINAL_THEMES` 中添加主题名

### 判断亮暗色

MainLayout 中通过背景色亮度判断：
```typescript
const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
const isLight = lum > 0.5;
const themeMode = isLight ? 'light' : 'dark';
```

## 终端主题列表

### 亮色 (3)
- `quiet-light` — Quiet Light
- `github-light` — GitHub Light
- `solarized-light` — Solarized Light

### 暗色 (10)
- `one-dark` — One Dark
- `dracula` — Dracula
- `solarized-dark` — Solarized Dark
- `tokyo-night` — Tokyo Night
- `vscode-dark-plus` — VS Code Dark+
- `monokai` — Monokai
- `nord` — Nord
- `github-dark` — GitHub Dark
- `catppuccin-mocha` — Catppuccin Mocha
- `ayu-dark` — Ayu Dark

## 检查清单

- [ ] 新 UI 元素使用 `var(--ui-*)` 或 `var(--chat-*)`，无硬编码颜色
- [ ] 新组件使用 CSS class 而非内联 style（便于主题切换）
- [ ] Ant Design 组件的弹层 z-index 通过 ConfigProvider components 配置
- [ ] 切换终端主题后，`data-theme` 属性、CSS 变量、Ant Design algorithm 三者同步更新
