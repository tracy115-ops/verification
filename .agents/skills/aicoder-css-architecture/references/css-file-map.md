# CSS File Map

当前建议职责：

## `src/styles/global.css`

只保留：

- reset
- `html/body/#root`
- app shell
- truly global containers
- 非 feature 专属的公共壳层

不应再包含：

- 设置页样式
- 定时任务样式
- 新建会话样式
- 终端设置样式
- 数据管理卡片样式

## `src/styles/workbench-tokens.css`

负责：

- `--wb-*` token
- 深浅主题 token 切换

## `src/styles/workbench-foundation.css`

负责：

- 基础按钮
- 基础输入框
- 基础下拉框
- 原生 `select`
- 共享 form row
- `pill-row`
- `modal-actions`
- `command-preview`

## `src/styles/settings-ui.css`

负责：

- settings modal
- settings shell / nav / content
- terminal settings
- network settings
- data settings
- cli diagnostics

## `src/styles/task-scheduler-ui.css`

负责：

- 定时任务弹窗
- 任务列表 / 详情 / 最近运行
- 定时任务表单布局

## `src/styles/new-session-ui.css`

负责：

- 新建会话弹窗
- reference session 表单
- template segmented
- path browse 区域

## 迁移原则

如果某条规则能明确归到某个 feature，就不该继续留在 `global.css`。

