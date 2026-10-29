# 0.1.4 CLI 探测与配置状态验证

日期：2026-10-29。发布源提交：`bfb915f444c6b856c320260aaa8255dc1d41c186`。

## 原因与修复

用户提供的 Windows 启动入口为带空格目录内的 `codeagent.bat`，版本输出为 `1.2605.05.02 (codeAgentCLI)`。旧版扫描仅匹配 exe 和特定 npm cmd，漏掉 bat；版本文本本身符合探测要求。

新增 bat / 自定义 cmd、cjs 和相邻 Node 支持，合并进程及 Windows 最新 PATH。可复用 native 配置此前固定显示“尚未探测”，现按 driver 关联安装结果及版本；缺少模型、未发现工具、版本失败和刷新失败分别显示。CodeAgent 不要求外部模型；Provider 接口检测保持独立。

## 验证

- Windows batch 回归在修复前复现入口解析失败，修复后验证版本、help、JSON／空参数及标准输入原样传递。
- 使用显式 `CODEAGENT_CLI_PATH` 和带空格的本地夹具路径，实际运行原生 probe 示例，返回 found 和上述版本文本；当前机器上的 Codex、Claude、Pi 仍可正常探测。
- 前端 114 项、版本契约 5 项、Agent 原生 23 项及执行运行时 11 项通过。设置页生产构建 Playwright 回归确认上方入口、下方 native 配置的版本与状态同步；组件回归覆盖 Provider 不继承本机安装状态及刷新时清除旧成功结果。
- [源码版本 Checks](https://github.com/tracy115-ops/verification/actions/runs/40841995890) 和 [Windows 打包](https://github.com/tracy115-ops/verification/actions/runs/40842004505) 均成功。
- [正式 Release](https://github.com/tracy115-ops/verification/releases/tag/v0.1.4) 已发布；下载核对版本 `0.1.4`、release 编译模式、源提交和 SHA-256，均一致。

安装包 3,037,135 字节，SHA-256：

```text
41f6fac4b5681158498ff409fde4dc9f53edc19697b8433c064ca3046b6e58ac
```

## 边界

本地 CodeAgent 使用明确的安装／IPC 夹具；未访问用户内部机器，未认证其真实 CLI 非交互协议、登录或模型推理。版本探测不会调用模型。安装包未签名；本次未执行系统安装。
