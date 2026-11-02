# CodeAgent 初始化后无回复的诊断

## 当前证据与边界

用户报告：input_written=true、last_event=system.init、last_output_age_ms=595845、protocol_records=5、public_text_bytes=0、unknown_records=0。

这表明已成功写入并关闭输入管道，最后一次输出约在五秒处，之后近十分钟没有字节输出。不能由此证明 CLI 已读取内容或提交模型请求；最后一个事件也不能代替之前四个事件。未知事件数为零不证明模型调用成功。上下文长度、内部初始化、模型服务与调用环境差异均尚未被这些字段区分。

本机没有内部 CodeAgent，无法认证其真实推理。Windows 夹具通过实际 bat、Node 和同一原生驱动，验证先发五条 init 后接收超过 32,800 字节的中文 JSON，输入及回复逐字节一致；这只覆盖传输，不覆盖内部服务。

## 新增诊断

- cli.launch：partial_messages、session_persistence_disabled、proxy_mode。记录实际启用的流式能力和代理来源，不记录地址、模型名或凭据；保持现有参数和代理策略。
- cli.progress：每 15 秒记录 input_written，表示写入和关闭管道均成功，不表示对端已读取。
- progress / diagnostic：initialization_records 与最近三条受控事件类型 event_trace，不保存任意原生事件名或推理正文。
- 所有事件均为 init 时使用 cli_timeout_after_init；夹杂未知事件或其他状态时保留原分类。不会提前终止长分析，也不会无限延长超时。

## assistant 事件后的超时（2026-11-02）

新反馈为 `event_trace=system.hook_progress:system.init:assistant`，`public_text_bytes=0`，`terminal=false`，`last_output_age_ms=8371`。若这些来自最终诊断，表示超时前约 8 秒仍有输出，不同于此前约 595 秒无输出的情况。assistant 事件本身不证明有公开正文，更不证明一轮调用已结束；思考块、工具请求和未识别的内容形态均需区分。

0.6.3 的原生 progress / diagnostic 增加 `assistant` 摘要：累计 `records`；最近一条的 `content_shape`、`text_blocks`、`thinking_blocks`、`tool_blocks`、`other_blocks`、`stop_reason` 和 `error_present`。只记录受控形态与计数，不记录原文、思考正文、工具名/参数或原生错误值。未知类型归 other；records=0 时其余默认字段不作解释。

同时修复公开 `message.content` 为字符串时被忽略的兼容缺口；数组中的 text 块继续支持，thinking / tool_use 内容不转换为正文。此修复不证明内部版本使用字符串形态。即使 assistant 的 stop_reason=end_turn，也必须继续等待原生 result 和进程退出，不能把未完成调用冒充成功。

预置需求/场景调用的 600 秒是单次调用硬时限，状态输出不会自动延期。失败或取消后，可在原任务右侧选择 20 / 30 分钟，再重试或改用分批重试；默认沿用原设置。调整只保存到当前分析节点的运行时预算，原工作流快照不变，已完成批次可继续复用。请求记录保留每次实际超时值，流程总时限仍约束单次调用。延长时限是缓解选项，不是内部服务正常的证据。

## 工作台中的运行状态（0.6.2）

对话和流程调用收到原生采样后，显示可展开的“CLI 运行状态”：运行秒数、输入是否写入、是否收到协议状态或公开正文。展开后可看本次采样时多久没有新输出；流程调用另外显示本次超时上限。没有采样时继续显示原来的等待动效，不编造进度或百分比。

安全摘要只包含五个计数/布尔字段：`elapsedMs`、`inputWritten`、`lastOutputAgeMs`、`protocolRecords`、`publicTextBytes`。每约 15 秒由实际进程更新，结束时再传最后一份采样；这是采样值，不是持续递增的前端计时器。原始事件名、代理信息和错误详情留在原有日志中。收到状态不等于模型正在推理，管道写入不等于模型收到请求。

普通对话在等待期间显示摘要；流程调用将最后采样随 CLI 记录保存，失败、超时或刷新后仍可展开查看“CLI 最后状态”。旧记录没有采样时不补造数据。并发会话隔离摘要，停止/完成后清理普通对话的临时状态。取消及分批恢复使用既有机制，不额外自动重试、不延长超时。

## 内部环境的最小对比

先在 CodeAgent 可正常运行的终端执行已知短请求：

```powershell
'Reply with OK only.' | codeagent --print --output-format stream-json --verbose --dangerously-skip-permissions --skip-safe-check
```

若 60 秒没有回复，可 Ctrl+C 停止。再从同一 Release 下载以 cli-diagnostic.exe 结尾的独立程序，放到当前目录。它使用工作台同一原生驱动、参数检查、MCP 文件及代理策略，无须安装 Rust，不填写模型。

```powershell
$probeBinary = (Get-ChildItem -File '*-cli-diagnostic.exe' | Select-Object -First 1).FullName
$probeWorkspace = Join-Path $env:TEMP ('verification-probe-' + [guid]::NewGuid())
New-Item -ItemType Directory -Path $probeWorkspace | Out-Null
@{
  turnId = [guid]::NewGuid().ToString()
  sessionId = [guid]::NewGuid().ToString()
  driver = 'codeagent'
  model = ''
  prompt = 'Reply with OK only.'
  timeoutSeconds = 60
} | ConvertTo-Json -Compress | & $probeBinary $probeWorkspace
```

输入为英文短请求，避免 Windows PowerShell 5 默认管道编码干扰。不要把真实 Spec 拼入命令行或发给外部诊断系统。独立程序会显示公开回复；反馈时仅需 launch、diagnostic 和 outcome.status / errorCode，不必粘贴正文或 nativeSessionId。

终端基线成功但独立驱动失败：优先对比代理来源、启动能力及 init 事件序列。二者成功而应用短请求失败：继续对比桌面进程环境。短请求都成功、仅设计节点超时：再验证该节点相同输入，区分输入复杂度、内部模型响应与配置差异，不能直接认定程序故障或服务故障。
