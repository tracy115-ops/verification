# Verification Workbench

面向企业验证工作的本地优先 Agent 工作台：直接驱动本机 Claude Code、Codex、Pi 等 CLI，将需求、场景、用例、脚本、执行证据与判定结果连接为可追溯的验证闭环。

**当前为第一轮开发版。** 已实现流程画布、节点与 Agent Profile 配置、定义校验、草稿保存 / 导入导出、中英文与主题、示例评审，以及 Tauri / Rust 的 CLI 安装和版本探测。真实模型调度、Provider 鉴权连接、运行引擎、SQLite、SSH / WSL 和测试执行仍在后续阶段。

## 运行

需要 Node.js 24；桌面开发还需要 Rust、Windows C++ Build Tools 和 WebView2。Windows PowerShell 使用 `npm.cmd` 入口。

```powershell
npm.cmd ci
npm.cmd run dev
```

浏览器打开 `http://127.0.0.1:5173/`。浏览器预览不具备本机 CLI 检测能力。桌面开发使用 `npm.cmd run tauri dev`，先停止单独运行的 Vite 服务。构建包含生产前端的桌面开发版使用 `npm.cmd run tauri -- build --debug --no-bundle`，本 Windows 工作区输出到 `target/debug/verification-desktop.exe`。

## 从这里开始

- [设计文档索引](docs/README.md)：产品头脑风暴、架构方案、默认测试工作流及实施计划。
- [项目约束](AGENTS.md)与[企业工程规范](docs/governance/engineering-constraints.md)：国际化、单文件不超过 2,000 行、单函数不超过 200 行，以及可扩展性、可维护性要求。
- [默认工作流](docs/workflows/general-testing.md)：Spec → 测试设计 → 场景映射 → 用例评审 → 脚本开发 → 执行 → 分析 → 结果动作。
- [开发计划](docs/roadmap/development-plan.md)与[界面设计和截图](docs/design/interface-design.md)：首轮范围、CLI 入口和后续开发。

## 核心设计

采用 Tauri 2 + React / TypeScript + Rust 骨架，以流程编排为首页，默认预置“测试设计验证流程”。通过独立适配器扩展 CLI、Provider、模板、执行环境和判定器；可恢复、可审计的运行引擎属于后续阶段。

需求覆盖灯和测试结果灯分别计算；Agent 提议映射与结论，系统依据确认记录、版本和证据计算状态。

## 仓库与验证

```powershell
npm.cmd run check
npm.cmd exec playwright install chromium
npm.cmd run test:e2e
cargo fmt --all -- --check
cargo test -p agent-runtime --locked
cargo clippy -p agent-runtime --locked -- -D warnings
cargo check -p verification-desktop --locked
```

仅探测本机 CLI 版本：`cargo run -p agent-runtime --example probe --locked`，不调用模型或检查登录。草稿保存于当前浏览器 / WebView 的本地存储，浏览器与桌面分别存储，迁移时导出 / 导入。保存计数不是发布历史或审计记录；Profile 配置保存不代表连接成功。

贡献前阅读 [Repository Guidelines](AGENTS.md)。本地配置、凭据、运行日志和测试产物不纳入 Git。
