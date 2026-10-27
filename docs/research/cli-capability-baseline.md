# CLI 能力基线与资料

核实日期：2026-10-27。资料会变化；正式实现时针对锁定安装版本重新探测，不把网站最新说明当作本机全部能力。

## 本机只读检查

| 项目 | 发现 | 本轮检查范围 |
| --- | --- | --- |
| Codex | `codex-cli 0.164.0` | `.cmd --version`、`exec --help` |
| Claude Code | `2.1.302` | `.cmd --version`、`--help` |
| Pi | `1.2.0` | `.cmd --version`、`--help` |
| Git | `2.49.0.windows.1` | 版本、本仓库初始化 |
| draw.io | PATH 与常见安装路径未发现 CLI | 仅归档 XML；没有完成图像导出 / 视觉验收 |

三个 CLI 的 npm `.ps1` 入口被本机 PowerShell 执行策略拒绝；显式 `.cmd` 版本 / 帮助检查成功。没有修改执行策略、没有调用模型、没有检查或导出登录凭据、没有修改 Provider 配置。因此**尚未验证鉴权、模型调用、端到端结构输出、取消或 SSH / WSL 可用性**。

## 官方资料与本轮结论

| 来源 | 支持的事实 | 设计影响 |
| --- | --- | --- |
| [Codex 非交互运行](https://learn.chatgpt.com/docs/non-interactive-mode) | `codex exec` 可用于自动化，`--json` 输出 JSONL 事件 | Driver 消费事件，并独立校验业务产物 |
| [Codex 配置参考](https://learn.chatgpt.com/docs/config-file/config-reference) | Provider 有 base URL、环境凭据引用及协议配置；本轮文档的 `wire_api` 为 Responses | 不能将 Chat Completions 兼容接口直接视为 Codex 兼容 |
| [Claude headless](https://code.claude.com/docs/en/headless) | `-p` 非交互，可使用 JSON / stream-json 和结构输出选项 | 使用原生 CLI，按版本归一事件与完成状态 |
| [Claude 网关](https://code.claude.com/docs/en/llm-gateway) | 网关要求受支持协议；官方不支持通过网关把 Claude Code 路由到非 Claude 模型 | Provider 设置需检查产品与协议能力边界 |
| [Pi RPC](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/rpc.md) | RPC 以 stdin / stdout JSON 记录控制长驻子进程 | 接收命令不等于业务完成，需识别相应终态 |
| [Pi 模型配置](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/models.md) | 支持已有 Provider、环境凭据与自定义 models 配置 | 复用原生能力，保留模型和协议差异 |
| [Tauri 进程模型](https://v2.tauri.app/concept/process-model/) | 核心与 WebView 分进程 | 系统执行能力集中在 Rust 侧 |
| [SQLite WAL](https://www.sqlite.org/wal.html) | WAL 需要同机共享内存，不用于网络文件系统 | SQLite 本机保存，不随 SSH 共享文件使用 |

OpenAI 旧开发文档链接本轮跳转至官方 ChatGPT Learn 文档；Pi 的旧 `badlogic/pi-mono` 仓库链接跳转到 `earendil-works/pi`。这些是资料入口变化，不据此自动迁移用户安装的 npm 包。

本表中“设计影响”是本项目推论；官方资料并未证明本项目选型、接口或恢复机制已可用。协议事件完整列表与 Provider 配置隔离方式在技术探针阶段固化为契约 fixture。

## 落地前还要验证

无终端 stdin、长提示词、输出分片、异常终态、取消子进程树、原生权限交互、超时 / 内部重试、Profile 隔离及凭据继承、不同 OS / 目标、CLI 升级兼容、模型产生不合规 JSON 的修复上限。对需要实际推理或远端执行的检查单独记录费用与环境前提。
