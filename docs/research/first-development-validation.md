# 首轮开发验证记录

日期：2026-10-27。范围：编排工作台、草稿、示例评审、CLI 版本探针和桌面开发版构建。环境为 Windows、本机 Node.js 24.20.0 与 Rust 1.97.0；依赖版本由 npm / Cargo lockfile 固定。

## 通过的检查

| 检查 | 结果 |
| --- | --- |
| `npm run check` | Prettier、代码规模 / CSS token 检查、21 项 Vitest、严格 TypeScript 与生产构建通过 |
| `npm run test:e2e`（开发服务） | 8 项浏览器交互通过 |
| `WORKBENCH_TEST_PRODUCTION=1` 下的端到端检查 | 同一组 8 项对生产前端通过；PowerShell 设置 `$env:WORKBENCH_TEST_PRODUCTION = '1'` |
| `cargo fmt --all -- --check` | 通过 |
| `cargo test -p agent-runtime --locked` | 2 项 Rust 探测入口契约测试通过 |
| `cargo clippy -p agent-runtime --locked -- -D warnings` | 通过 |
| `cargo check -p verification-desktop --locked` | 桌面 IPC 与依赖编译检查通过 |
| `npm run tauri -- build --debug --no-bundle` | 生成包含生产前端的 Windows 开发版 EXE；不是发行安装包 |
| `cargo run -p agent-runtime --example probe --locked` | 实际发现 Codex 0.164.0、Claude Code 2.1.302、Pi 1.2.0 |

Rust 链接器输出一条创建导入库的本地化提示，未导致构建失败。GitHub Actions 定义已加入，但本轮没有推送或执行远端 CI。

## 验证行为

- 错误结构、重复 ID、环路、未知操作、悬空引用、非祖先绑定和类型错配被拒绝。
- Provider 协议检查区分 Codex Responses 与其他协议，拒绝明文凭据引用、URL 用户信息和 query 凭据；非法导入不覆盖当前草稿。
- 保存和刷新恢复节点配置；增加人工复核；有效导入导出保留流程名与结构；新 Provider 配置可以绑定节点。
- 覆盖从缺失进入候选，再确认单条映射；尚未确认的其他义务继续显示待确认，执行仍未运行。
- 国际化 key 对齐、英语切换、深色主题、浏览器 CLI 边界、900 / 640px 窗口布局通过检查。
- 代码门禁的边界样例确认：2,000 行通过 / 2,001 行拒绝；200 行函数通过 / 201 行拒绝。TypeScript 使用 AST，Rust 当前检查具名函数跨度，闭包的完整 Rust AST 检查仍待扩展。
- 使用实际浏览器截图检查浅色编排与深色设置页，截图已归档到界面设计文档。生产前端也运行相同交互检查。

## 未完成与限制

没有调用真实模型、测试 Provider 鉴权、执行真实测试脚本、连接 SSH / WSL，或实现运行持久化、跨运行审批、证据判定与自动动作。桌面已构建，GUI 内点击 CLI 探测的全链路尚未单独做自动化验收；真实探测通过 Rust 示例验证。

CLI 版本探测有超时和输出上限，但它不是完整 Agent 进程监督器，也未认证所有原生 hook、插件或子进程树的隔离和取消。完整执行生命周期在真实 Agent 接入阶段建设。

草稿保存在浏览器 / WebView 本地存储，修订字段仅为保存计数，没有不可变发布历史或 SQLite 迁移。场景与用例页是明确标记的示例；不产生真实需求覆盖或测试通过结论。下一阶段以[开发计划 S5](../roadmap/development-plan.md)为入口。
