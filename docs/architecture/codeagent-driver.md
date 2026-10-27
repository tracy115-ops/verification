# 内部 CodeAgent CLI 接入

用户提供的信息：工具安装在另一个环境，交互命令为 `codeagent --dangerously-skip-permissions`；模型已经在 CodeAgent 内配置。因此 Profile 仅使用 native 协议，模型、Provider URL 和凭据引用必须为空，实际调用不传 `--model`。Codex / Claude / Pi 在设置中独立指定模型 ID，调用前检查模型是否填写。

扫描支持 PATH 中的原生可执行文件、Windows npm 生成的 `codeagent.cmd` 包装入口，以及服务进程环境变量 `CODEAGENT_CLI_PATH` 指定的可执行文件 / JS 入口。包装解析只提取受约束的 node_modules JS 路径，再通过 Node 启动；不将包装内容作为 shell 执行。

版本探测只执行 `--version`。自动流程调用时先通过有界 `--help` 检查非交互、stream-json、verbose、关闭工具与 MCP 等参数；满足所需参数后使用 Claude 风格事件归一化。启动参数仅表示可能兼容，终态事件、退出码和产物 Schema 仍须全部检查。

`--dangerously-skip-permissions` 仅用于用户确认的内部驱动调用；扫描不会附带该标志，其他驱动不继承它。设计节点关闭工具与 MCP；本轮不将它开放为局域网远程命令入口。

本机没有安装 CodeAgent，实测扫描结果为 missing。版本、参数和真实推理必须在安装环境回归；不能把 Codex 的实测结果当作 CodeAgent 的兼容认证。缺少所需非交互参数时返回 `cli_capability_unverified`，不将交互窗口文本猜测成成功产物。

![内部模型与公共 CLI 模型设置](../design/images/codeagent-settings.png)
