---
name: aicoder-css-architecture
description: 企业级 CSS 架构与主题规范。用于任何样式开发、CSS 重构、主题切换、Ant Design 控件定制、弹窗/表单/面板 UI 开发、global.css 清理、dev 和 release 样式不一致排查。涉及文本框、输入框、下拉框、按钮、分页、弹窗、设置页、定时任务、新建会话时必须使用。
---

# AiCoder CSS Architecture

本 skill 约束 AiCoder 的样式开发方式，目标是：

- `dev` / `release` 风格一致
- 深色 / 浅色主题可控
- 新功能不再往 `global.css` 堆规则
- 基础控件统一，业务模块只做布局和少量特化

## 何时使用

出现以下任一情况时必须使用：

- 修改任何 `.css` / `.tsx` 中的样式相关代码
- 新增弹窗、表单、面板、分页、卡片、列表
- 调整 `Input / TextArea / Select / Button / Tag / Pagination`
- 做主题切换、颜色调整、深色模式优化
- 排查 `dev` 和 `release` 样式差异
- 清理 `global.css`

## 当前架构

只允许按这四层组织：

1. `src/styles/workbench-tokens.css`
   - 只放主题 token
   - 只定义颜色、边框、阴影、半径、间距等变量

2. `src/styles/workbench-foundation.css`
   - 只放基础控件和共享骨架
   - 例如：
     - `workbench-btn`
     - `workbench-input`
     - `workbench-select`
     - `native-select`
     - `pill-row`
     - `modal-actions`
     - `command-preview`

3. feature CSS
   - `src/styles/settings-ui.css`
   - `src/styles/task-scheduler-ui.css`
   - `src/styles/new-session-ui.css`
   - 只放该功能自己的布局、分区、响应式

4. `src/styles/global.css`
   - 只放 reset、app shell、全局布局、真正跨功能公共规则
   - 不允许再放设置页、定时任务、新建会话的 feature 样式

## 分层规则

### 1. tokens 层

只能做：

- 主题变量
- 深色主题变量覆盖
- 不允许出现业务选择器

禁止：

- `.settings-*`
- `.task-*`
- `.new-session-*`
- `.ant-*`

### 2. foundation 层

只能做：

- 基础控件统一视觉
- 共享表单骨架
- 多 feature 共用的布局原语

允许：

- `.workbench-btn`
- `.workbench-input`
- `.workbench-select`
- `.native-select`
- `.pill-row`
- `.modal-actions`

谨慎允许：

- 少量 `.ant-*`，但必须挂在明确的基础类下面  
  例如：`.workbench-select.ant-select .ant-select-selector`

禁止：

- 直接裸写全局 `.ant-btn`
- 直接裸写全局 `.ant-select-selector`
- 在 foundation 写 feature 名称

### 3. feature 层

只能做：

- 该功能自己的布局
- 该功能自己的小范围视觉特化
- 该功能自己的响应式规则

允许：

- `.settings-shell`
- `.task-panel`
- `.new-session-scroll`

禁止：

- 把设置页规则写进定时任务 CSS
- 把新建会话规则写进设置页 CSS
- 再回头往 `global.css` 补一段 feature 规则

### 4. global 层

只允许：

- `html/body/#root`
- app shell
- split pane / resizer / title bar / sidebar / terminal host
- 真正跨 feature 的壳层规则

禁止：

- `settings-*`
- `task-*`
- `new-session-*`
- `reference-session-*`
- `terminal-settings-*`
- `network-*`

## 控件统一规范

项目内基础控件必须先统一，再允许 feature 特化。

### Input / TextArea

- 高度、圆角、边框、hover、focus 在 foundation 统一
- 颜色只吃 token
- `TextArea` 只允许在 feature 中调整最小高度，不允许重做整套皮肤

### Select

- 优先复用统一基础 select
- 只有在 AntD 弹层交互不稳定时，才允许 feature 退回原生 `select`
- 不允许多个 feature 各自发明一套 select 皮肤

### Button

- 基础按钮尺寸、边框、圆角、hover/focus 统一
- feature 只允许调布局，不允许重写按钮骨架

### Pagination

- 先走统一基础视觉
- feature 只做位置和容器布局

### Modal Footer

- `modal-actions` 归 foundation
- 各弹窗只决定是否居中、是否双列、是否换行

## 主题规范

主题切换只能靠 token，不靠重复规则。

必须：

- 深浅主题都走变量
- feature CSS 只消费 `--wb-*` token

禁止：

- 在多个文件重复写 `:root[data-theme='dark'] .settings-*`
- 因为某个页面看起来不对，就在 `global.css` 再补一组 dark override

如果某个 feature 在深色模式不清晰：

1. 先检查 token 是否合理
2. 再检查 foundation 对比度
3. 最后才允许在 feature 层补局部 dark 规则

## Ant Design 定制规则

默认策略：

- 先用组件 API
  - `size`
  - `variant`
  - `className`
- 再用 foundation 包裹类做定制

禁止：

- 全局裸写 `.ant-btn`
- 全局裸写 `.ant-select-selector`
- 全局裸写 `.ant-input-affix-wrapper`

如果必须定制 AntD 内部节点：

- 必须挂在业务类或基础类下面
- 必须说明为什么 API 不够
- 必须确认不会影响其他 feature

## 修改流程

每次改样式必须按这个顺序：

1. 先判断归属层
   - token / foundation / feature / global
2. 只改对应层
3. 若新增样式导致旧规则重复，顺手删除旧规则
4. 不允许“先加新规则，旧规则以后再说”
5. 验证：
   - `npm run build`
   - 必要时 `cargo check --manifest-path src-tauri\\Cargo.toml --locked`
6. 对比：
   - `npm run tauri dev`
   - `src-tauri/target/release/ai-station.exe`

## 清理旧规则的要求

当你迁移一块样式时，必须同步做清理：

- 把旧的重复规则从 `global.css` 删除
- 不允许保留“也许以后用得上”的旧块
- 迁移后要用 `rg` 搜一遍关键词，确认没有残留命中

建议搜索：

```powershell
rg -n "settings-|task-|new-session-|reference-session-|terminal-settings-|network-" src/styles/global.css
```

## Definition of Done

样式任务只有在以下条件全部满足时才算完成：

- 改动落在正确层级
- 没有重复规则同时命中
- `global.css` 没有新增 feature 垃圾
- `dev` / `release` 视觉一致
- 深色 / 浅色都可读
- `npm run build` 通过

## 禁止事项

严禁以下做法：

- 继续把 feature 规则堆进 `global.css`
- 同一控件在多个 feature 文件里各自重写骨架
- 为了解一个局部问题，新增一整段全局 `.ant-*`
- 不删旧规则，只叠加新规则
- 不验证 `release`，只看 `dev`

## 当前文件地图

需要时再读：

- `references/css-file-map.md`

