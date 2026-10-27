---
name: aicoder-ui-pro
description: AiCoder Pro UI 开发与样式规范。用于确保应用在开发过程中保持统一的视觉风格。包含颜色体系、布局规范、组件样式指导。在进行前端界面开发、修改 CSS、设计新组件或优化现有 UI 时，请使用此技能。
---

# AiCoder Pro UI 开发规范

本指南旨在确保 AiCoder Pro 项目在开发过程中保持一致、现代且极简的视觉风格。

## 1. 核心视觉原则
- **极简现代**：减少装饰性元素，强调内容和功能。
- **空间感**：使用足够的内边距（Padding）和外边距（Margin），避免界面拥挤。
- **一致性**：所有按钮、输入框、卡片和阴影必须符合预定义的设计令牌（Design Tokens）。

## 2. 颜色体系 (Tokens)
参考 `references/design-tokens.md` 中的具体数值。

- **背景色**：
  - 外围背景: `--bg-base` (#f5f7fa)
  - 容器/卡片背景: `--bg-container` (#ffffff)
  - 侧边栏: `--bg-sidebar` (#fcfcfc)
- **品牌色**：
  - 主色: `--accent-primary` (#1677ff) - 用于主按钮、激活状态文本和边框。
  - 激活背景: `--bg-active` (#e6f7ff) - 用于列表项激活或悬停背景。
- **文字颜色**：
  - 主要文字: `--text-primary` (rgba(0,0,0,0.88))
  - 次要/描述文字: `--text-secondary` (rgba(0,0,0,0.65))
- **边框颜色**：
  - 标准边框: `--border-base` (#d9d9d9)
  - 分隔线/背景边框: `--border-secondary` (#f0f0f0)

## 3. 布局规范
- **侧边栏 (Sidebar)**：宽度固定为 `260px`。
- **标题栏 (TitleBar)**：高度为 `38px`，背景为透明或 `--bg-container`。
- **状态栏 (StatusBar)**：高度为 `28px`，背景为白色，顶边有 `#f0f0f0` 分隔线。
- **主区域**：使用 Flex 或 Grid 布局，各面板间保持一致的间距（Gap: 12px - 16px）。

## 4. 组件样式指导
- **按钮 (Buttons)**：
  - **Primary**: 实心 `--accent-primary` 背景，白色文字，圆角 `6px`。
  - **Ghost/Default**: 透明背景，实线边框 `--border-base`，悬停时边框和文字变为品牌色。
- **输入框 (Inputs)**：
  - 高度标准：32px 或 36px。
  - 样式：白色背景，灰色边框，聚焦时带蓝色外描边。
- **卡片/面板 (Cards)**：
  - 背景为纯白。
  - 边框为 `--border-secondary`。
  - 阴影仅在浮动层使用：`0 6px 16px 0 rgba(0,0,0,0.08)`。
- **键盘快捷键 (Shortcut Keys)**：
  - 使用浅灰色背景（`#f5f5f5`），圆角 `4px`，带 `1px` 边框。

## 5. 开发建议
- **CSS 变量优先**：始终优先使用 CSS 变量（Variables），避免硬编码颜色值。
- **响应式/自适应**：各面板应能良好适应窗口缩放，使用百分比或 `flex-1` 分配剩余空间。
- **Lucide 图标**：项目统一使用 Lucide 风格的线性图标，保持描边粗细一致（一般为 1.5px 或 2px）。
