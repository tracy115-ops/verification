# 会话与设置开发验证记录

日期：2026-10-27。环境：Windows、Node.js 24.20.0、Rust 1.97.0。本文记录当前代码实现；旧的[首轮记录](first-development-validation.md)作为阶段档案保留。

## 实现范围

- 应用内 CLI 会话成为首页；设置集中管理语言、主题、Agent / Provider 与 CLI 探测。
- 会话选择器或 `/run` 调用保存版本，创建独立快照；当前只执行 13 节点模板中至用例评审的 7 节点、3 个人工确认点。
- Codex / Claude / Pi 通过 stdin 提示与结构化事件协议接入；原生登录 Profile 可调用，自定义 Provider 实际推理明确拒绝。
- 校验需求原文、场景 / 用例引用和覆盖缺口；审批摘要绑定输入，显式重试受次数与截止时间限制。
- 实现输出上限、超时、取消、断开清理、重载中断与旧调用停止确认。Windows 使用 Job Object 管理进程树。

## 验证结果

| 检查 | 结果 |
| --- | --- |
| `npm run check` | 格式、79 个源文件规模 / CSS token、35 项 Vitest、严格 TypeScript 与生产构建通过 |
| `npm run test:e2e` | 9 项开发服务交互通过 |
| 生产前端 Playwright | 同一组 9 项通过；PowerShell 设置 `$env:WORKBENCH_TEST_PRODUCTION = '1'` |
| Rust runtime 测试 | 13 项通过，包括三个协议解析、分片 JSON、失败退出、超时、输出限额、取消及 Windows 孙进程清理 |
| `cargo clippy -p agent-runtime --locked -- -D warnings` | 通过 |
| `cargo check -p verification-desktop --locked` | 通过 |
| `npm run tauri -- build --debug --no-bundle` | 已生成 `target/debug/verification-desktop.exe`，嵌入生产前端；不是发行安装包 |

Vitest 的会话控制器使用注入的离线 `AgentPort`，验证完整三次确认、持久化、并发发送阻止、停止以及损坏历史不覆盖。Rust 测试启动 Node 协议夹具，验证实际子进程和流读写；这些不是三个厂商 CLI 的真实模型推理结果。

Playwright 验证导航、独立设置持久化、主题 / 语言、浏览器能力边界、定义导入导出、保存版本选择及窄屏。截图来自实际浏览器。未执行付费模型调用或 SSH / WSL 操作。

构建输出的链接器提示为创建导入库信息，不影响构建成功。远端 CI 未在本轮执行。

## 仍需验证与建设

真实账号推理、各 CLI 版本兼容性、自定义 Provider 参数 / 凭据注入、脚本开发、测试执行、判定与后续动作仍待验证或实现。当前普通对话采用上下文重放，尚无原生会话恢复、模型工具自动选择工作流、Agent 生成编排或产物编辑。

本地存储有容量限制，没有事务和企业身份审计；结构化映射检查不能证明需求语义完整。当前输出只表示设计评审完成，不能表示测试通过。开发版 EXE 不等于已签名发行安装包。
