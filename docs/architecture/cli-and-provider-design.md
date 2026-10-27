# CLI 驱动与 Provider 快速配置

状态：接口提案。目标是直接复用已安装 CLI；不要求用户迁移到本产品自建的模型 Agent 循环。

## 四层配置

`角色绑定 → AgentProfile → AgentDriver + ProviderProfile`，测试执行目标由 `ExecutionProfile` 单独选择。

- `AgentProfile`：Driver、已解析可执行入口、版本、Provider 引用、工作区和工具约束。
- `ProviderProfile`：连接类型、base URL、模型 ID、凭据引用、协议、超时、预算及数据访问范围。
- `RoleBinding`：例如 `case-developer → codex-corporate`、`verdict-analyst → claude-existing-auth`。
- `ExecutionProfile`：目标 OS、local / SSH / WSL、工作目录、依赖环境和并发。首版本机驱动 Agent，远端主要运行测试；远程 Agent 是后续可选扩展。

Agent 的 native session 仅用于上下文连续性，不能作为业务状态唯一来源。跨 CLI 切换时传递经过校验的产物，不搬运另一 CLI 的私有会话。

## `AgentDriver` 建议契约

| 操作 | 输入 | 输出与责任 |
| --- | --- | --- |
| `discover` | 搜索范围、用户指定路径 | 候选安装和启动入口，不读取凭据内容 |
| `probe` | 安装引用、超时 | 版本、帮助特征与能力矩阵；不触发推理 |
| `prepare` | Profile、角色、输入产物引用 | 明确 argv、cwd、环境、工具权限和可支持性报告 |
| `start` | PreparedInvocation、attempt ID | 受管进程句柄与规范化事件流 |
| `cancel` | 句柄、宽限期 | 请求退出、确认退出、超时清理，区分本机与远端 |
| `collect` | 终态、产物路径 | 经 Schema / 引用校验的产物，或结构化错误 |
| `resume`（可选） | native session、原运行摘要 | 仅在已确认兼容时启用；不覆盖业务快照 |

规范化事件包含 `runId/nodeId/attemptId/seq/type/time/payload`。常见类型为 `started`、`message.delta`、`tool.observed`、`artifact.proposed`、`approval.required`、`usage.reported`、`completed`、`failed`。未知原生事件保留脱敏原文，不直接认定成功；不是所有 CLI 都能产生全部事件。

只有“进程完成 + 协议明确终态 + 目标产物有效”才能完成生成节点。stderr 有日志不自动失败，退出码 0 也不能绕过业务校验。

## 已核实入口与差异

| CLI | 候选接入方式 | Provider 适配关注点 |
| --- | --- | --- |
| Codex | `codex exec --json`；可探测 `--output-schema` | 原生 Provider / Profile 配置；当前官方配置声明 Responses 协议 |
| Claude Code | `claude -p --output-format stream-json --verbose` | 复用登录或兼容网关；不能承诺任意 OpenAI 接口直接使用 |
| Pi | `pi --mode rpc`；简单单次任务也可探测 print / JSON | 原生 Provider、`models.json` 或扩展；以安装版本验证协议 |

Codex 的 JSONL 入口见[官方非交互文档](https://learn.chatgpt.com/docs/non-interactive-mode)；其 Provider 协议字段见[官方配置参考](https://learn.chatgpt.com/docs/config-file/config-reference)。Claude 的流输出见[官方 headless 文档](https://code.claude.com/docs/en/headless)，网关限制见[官方网关说明](https://code.claude.com/docs/en/llm-gateway)。Pi 的子进程协议见[官方 RPC 文档](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/rpc.md)，自定义模型见[官方模型文档](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/models.md)。

这些是本轮资料核实的候选入口，不是本项目已经通过的运行认证。能力探测与版本契约测试是正式接入前置条件。

## 快速配置体验

1. 扫描本机安装，展示 CLI 名称、入口、版本；允许用户纠正路径。
2. 选“使用已有登录”或“新建 Provider”。已有登录由 CLI 自己使用，不导出 auth 文件到项目。
3. 新建连接选协议 / 已知 Provider 模板，填写 endpoint、模型、凭据引用；预先过滤不兼容组合。
4. 本地静态检查不调用模型；显式连接测试分别检查 DNS / TLS、鉴权、模型与所需工具 / 结构输出能力，提示可能产生一次推理费用。
5. 保存 Profile，绑定角色；允许一键恢复原绑定。没有模型列表 API 时支持手填，不伪造“自动发现”。

错误诊断区分 `cli.not_found`、`auth.required`、`provider.protocol_mismatch`、`provider.model_unavailable`、`driver.unsupported_version`。界面统一操作，底层保留 CLI 各自协议能力；没有一个万能“OpenAI compatible”开关。

Provider 运行配置只示意公共字段：

```json
{
  "id": "corporate-verification",
  "driverId": "codex",
  "connectionMode": "managed-profile",
  "provider": {
    "protocol": "openai-responses",
    "baseUrl": "https://gateway.example.invalid/v1",
    "model": "configured-model-id",
    "credentialRef": "os-keychain://verification/corporate"
  },
  "limits": { "deadlineSeconds": 600, "maxAttempts": 2 }
}
```

`.invalid` 是占位地址，本例不能直接连接。产品将公共字段转换为具体 CLI 支持的参数、配置和环境；无法映射时明确拒绝。密钥不放 argv、不回显日志，费用不可观测时仍用时间 / 次数约束并显示费用未知。

## 配置隔离与 Windows 启动

两种模式明确区分：`native-profile` 复用用户现有配置，记录脱敏配置摘要；`managed-profile` 通过受支持的参数或运行专用配置隔离，不覆盖用户全局设置。隔离配置不能假定同时保留 OAuth 登录，需逐 Driver 验证；不支持时退回已有 Profile 并解释限制，不复制 token 文件。

本机探测发现 npm `.ps1` 入口受 PowerShell ExecutionPolicy 阻止，`.cmd` 可读取版本与帮助。正式启动器优先解析可信原生 exe，或读取已知 npm 包元数据后直接以 `node.exe + 明确入口文件` 启动；`.cmd` 仅在经过正确 Windows 引号和边界测试后支持。禁止拼接用户 Spec 到 shell 字符串，不通过更改全局 ExecutionPolicy 解决。

启动参数使用 argv，长提示词经 stdin / 受控文件传递；工作目录、环境变量与编码显式指定。探测必须兼顾 GUI 启动时 PATH 与终端 PATH 的差异，以及空格、中文、Unicode、超长输入和多个并发 Profile。

## 权限能力不能靠提示词保证

设计 / 判定角色应只读；开发角色只写本轮独立工作区；测试执行由已批准的执行器负责。Agent 可能加载原生 hook、扩展或 MCP，必须探测并尽量关闭非必要入口。要求的工具边界无法落实时，不能声称已沙箱隔离。

Driver 的工具限制只是一层控制。需要强隔离时使用 OS 账户、容器或隔离 Runner 控制文件与网络权限；普通子进程、Git worktree 和目标目录本身不是沙箱。CLI 无法满足节点能力或执行边界时，预检阻止该组合，或在明确的可信本机模式下由用户选择继续，不静默降级。

Provider 连接测试不等于角色认证。每个角色还需验证结构产物、取消、预算与所需工具。版本升级进入重新认证流程；兼容矩阵记录 `driver/version/OS/protocol/capabilities/validatedAt`，不能把本机发现的三个版本写成跨平台支持承诺。
