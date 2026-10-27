# Verification Agent

面向企业验证工作的本地优先 Agent 工作台：直接驱动本机 Claude Code、Codex、Pi 等 CLI，将需求、场景、用例、脚本、执行证据与判定结果连接为可追溯的验证闭环。

**当前状态：设计阶段。** 尚未实现应用、工作流引擎或执行器；文档中的技术选型为建议，示例工作流不是可运行产品。

## 从这里开始

- [设计文档索引](docs/README.md)：产品头脑风暴、架构方案、默认测试工作流及实施计划。
- [项目约束](AGENTS.md)与[企业工程规范](docs/governance/engineering-constraints.md)：国际化、单文件不超过 2,000 行、单函数不超过 200 行，以及可扩展性、可维护性要求。
- [默认工作流](docs/workflows/general-testing.md)：Spec → 测试设计 → 场景映射 → 用例评审 → 脚本开发 → 执行 → 分析 → 结果动作。

## 核心设计

建议采用 Tauri 2 + React / TypeScript + Rust 模块化单体，先完成一条可恢复、可审计的通用测试工作流。通过独立适配器扩展 CLI、Provider、模板、执行环境和判定器。

需求覆盖灯和测试结果灯分别计算；Agent 提议映射与结论，系统依据确认记录、版本和证据计算状态。

## 仓库与验证

目前仓库以 Markdown、JSON 示例和可编辑架构图为主，没有构建或测试命令。可用 `rg --files --hidden -g '!.git'` 查看目录，贡献前阅读 [Repository Guidelines](AGENTS.md)。本地配置、凭据、运行日志和测试产物不纳入 Git。
