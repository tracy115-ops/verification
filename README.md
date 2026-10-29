# Verification Workbench

面向企业验证工作的本地优先 Agent 工作台：直接驱动本机 Claude Code、Codex、Pi 等 CLI，将需求、场景、用例、脚本、执行证据与判定结果连接为可追溯的验证闭环。

**当前为本地黑盒验证与协作开发版。** 已实现真实 CLI 会话、流程编排、需求／因子／场景／用例评审、本地 Python 执行与证据分析，以及 SQLite 共享项目、局域网发现和增量协作。支持中英文和主题。SSH／WSL 执行、任意测试框架及内部 CodeAgent 目标环境仍待接入或验证。

## 运行

需要 Node.js 24；桌面开发还需要 Rust、Windows C++ Build Tools 和 WebView2。Windows PowerShell 使用 `npm.cmd` 入口。

```powershell
npm.cmd ci
npm.cmd run dev
```

浏览器打开 `http://127.0.0.1:5173/`。浏览器预览不具备本机 CLI 检测能力。桌面开发使用 `npm.cmd run tauri dev`，先停止单独运行的 Vite 服务。构建包含生产前端的桌面开发版使用 `npm.cmd run tauri -- build --debug --no-bundle`，本 Windows 工作区输出到 `target/debug/verification-desktop.exe`。

## GitHub 手动打包

打开 [Actions → Package Windows Desktop](https://github.com/tracy115-ops/verification/actions/workflows/package-windows.yml)，点击 **Run workflow** 选择分支启动 Windows x64 打包。成功后从运行页面 **Artifacts** 下载 NSIS 安装包和 SHA-256 校验文件。详见[打包说明](docs/workflows/github-packaging.md)；当前为未签名开发版，附件保留 14 天。

## 从这里开始

- [设计文档索引](docs/README.md)：产品头脑风暴、架构方案、默认测试工作流及实施计划。
- [项目约束](AGENTS.md)与[企业工程规范](docs/governance/engineering-constraints.md)：国际化、单文件不超过 2,000 行、单函数不超过 200 行，以及可扩展性、可维护性要求。
- [默认工作流](docs/workflows/general-testing.md)：Spec → 测试设计 → 场景映射 → 用例评审 → 脚本开发 → 执行 → 分析 → 结果动作。
- [开发计划](docs/roadmap/development-plan.md)与[界面设计和截图](docs/design/interface-design.md)：首轮范围、CLI 入口和后续开发。

## 核心设计

采用 Tauri 2 + React / TypeScript + Rust，以会话为主要入口，默认预置“测试设计验证流程”。通过独立适配器扩展 CLI、Provider、模板、执行环境和判定器；运行记录保留审批摘要、产物与证据，个人会话与团队项目通过补充包交接。

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
