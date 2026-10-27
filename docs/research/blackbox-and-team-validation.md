# 黑盒、团队协作与 CodeAgent 验证记录

日期：2026-10-27。环境：Windows、Node.js 24.20.0、Python 3.11.15、Rust 1.97.0。当前交付包含共享设计服务与本地黑盒执行基准，正式编排仍运行到用例评审。

## 真实 CLI → Python → 缺陷证据

输入仅为[游戏对战平台题目](../examples/game-platform-blackbox-topic.md)与提供的 Python 框架，没有被测实现源码。通过当前本机 Codex CLI 0.164.0 和显式模型 `gpt-6.1-terra` 生成一个 Python 脚本，先校验结构与 AST，再执行实际 HTTP 请求。

| 目标 | 测试方法 | 失败断言 | 执行错误 |
| --- | --- | --- | --- |
| 带种子缺陷的游戏平台 | 36 | 15 | 0 |
| 修正参考实现 | 36 | 0 | 0 |

失败按需求 / 方法合为 **8 组候选问题**：房间容量与类型、排位组合、私有房间访问、并发加入、已结束对局、旧回合、结果重放计分、外部匹配依赖。这不是最终根因去重；子测试的重复触发不会直接计作多个缺陷。

脚本、覆盖映射、断言差异、请求和响应已[归档](../examples/generated/game-platform/README.md)。原始本地输出在 `.runtime/game-agent/`。同一脚本对参考实现通过，表明本轮未观察到参考目标上的误报；不能证明参考实现完全满足全部未明确的行为。

联调发现并修复 Codex 重连提示误判：CLI 0.164.0 在 WebSocket 重试后可通过 HTTP 成功完成；仅将已实测的 `Reconnecting...` 提示作为活动事件，其他错误仍阻止成功。过程包含失败尝试和最小 JSON 诊断，最终脚本来自修复后的一次生成；没有自动付费重试。

另一个[账户 / 订单基准](blackbox-benchmark-results.md)中，5 项正常路径未发现问题；26 项增强检查产生 11 项失败，合为 9 类候选问题；修正参考目标 26 项全部通过。两个样例分别记录，不能据此推算真实项目的缺陷检出率。

## 自动检查

| 检查 | 当前结果 |
| --- | --- |
| `npm run check` | 51 项 Vitest、TypeScript、构建、TS / Python AST 规模与样式 token 检查通过 |
| `npm run test:e2e` | 10 项通过，含 CodeAgent 内置模型与其他 CLI 模型持久化 |
| `npm run test:team:e2e` | 2 项生产服务交互通过；两个独立浏览器成员共享分工和评审，冲突保留本地草稿 |
| `cargo test -p agent-runtime --locked` | 16 项通过，含 npm CodeAgent 包装解析、参数检查、流协议和进程树清理 |
| Clippy / 桌面编译 | 无警告 Clippy 与 desktop check 通过 |
| 桌面开发版构建 | 已生成包含本轮前端的 `target/debug/verification-desktop.exe`；不是发行安装包 |
| `npm run verify:blackbox` | 本地 HTTP 基准通过 |
| `npm run verify:game-agent -- --reuse-script` | 复用真实生成脚本再次执行通过，不调用模型 |

SQLite 测试验证了持久化重开、修订冲突、角色拒绝、旧版本保留、引用校验、修改因子 / 场景后的评审失效。API 没有开放 CLI 或 Python 执行入口。

## 局域网与内部 CLI 边界

当前本机服务监听 `0.0.0.0:4317`；回环及本机网卡地址的 HTTP 服务返回成功。跨物理电脑的防火墙 / 路由仍须在部署网络验证，本轮未自动修改规则。个人令牌存放在忽略目录，未提交 Git；首次管理员令牌只用于本机演示工作区。

本机未安装 CodeAgent，真实扫描返回 missing。其扫描、内部模型策略与兼容参数分支已测试；不能把 Codex 的真实推理结果当作 CodeAgent 在另一环境的认证。任意题目框架的自动适配、正式脚本执行节点、远程 Worker 和操作系统级执行隔离仍待完成。
