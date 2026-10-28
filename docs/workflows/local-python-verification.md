# 本地 Python 黑盒验证工作流

日期：2026-10-27。适配器：`python-unittest-v1`。被测系统只需要题目和外部接口，不需要源码。

## 如何开始

1. 桌面版打开“设置 → Agent 与 Provider”，扫描本机 CLI。CodeAgent 使用内部模型；Codex / Claude / Pi 需保存实际可用的模型 ID。扫描成功只代表安装 / 版本可见。
2. 在“设置 → 测试框架与执行”配置 Python 3.11+、目标基础地址、执行超时、框架调用约定和 `framework.py`。可读取提供的 `.py` 文件。当前不安装依赖，解释器环境需事先具备框架依赖。
3. 编排页检查各 Agent 节点的 Profile 绑定并保存。返回 CLI 会话，选择已保存流程，再选择“需求 → Python → 本地执行与分析 · 框架名称”。默认仍为仅设计范围。
4. 粘贴题目或附加 `.md` / `.txt`。按次评审需求、场景覆盖和用例。脚本生成后，预检只解析语法、结构、方法映射与 Python 版本，不导入框架、不调用目标。
5. 第四次确认展示目标、解释器、超时、完整脚本 / 框架和 SHA-256。勾选确认后才启动测试；结果展示方法状态、脱敏请求响应、候选缺陷及报告下载。

编排、Profile、框架与输入在运行开始时固定快照；修改设置只影响下一次调用。确认摘要绑定上游产物，执行前重新检查。设计完成、断言通过和缺陷确认是不同状态。

## 用本地题目试跑

```powershell
npm.cmd ci
npm.cmd run serve:game-fixture
# 另一个终端启动桌面版
npm.cmd run tauri -- dev
```

使用内置“Game platform / unittest”配置，目标 `http://127.0.0.1:4320`，输入 [游戏平台题目](../examples/game-platform-blackbox-topic.md)。该服务故意含缺陷，每个方法先复位；仅用于样例。用 `-- --reference` 启动修复版对照，两个版本不要共用同一端口。停止独立 Vite 服务后再启动 `tauri dev`。

可重复验证正式引擎且不调用模型：`npm.cmd run verify:workflow`。该命令构建 Rust 执行桥，重放已评审 Agent 产物，实际运行 Python / HTTP，并在 `.runtime/workflow-validation/` 保存两个版本的运行与报告。真实模型生成的独立基准见[前轮记录](../research/blackbox-and-team-validation.md)。

## 提供框架的契约

框架是经过用户审查的本机代码，导出 `BlackBoxCase(unittest.TestCase)`。初始化、身份、清理、网络和 SDK 依赖放在框架内；生成脚本只允许 `unittest` / `framework` 导入，以及 `BlackBoxCase` 子类中的 `test_` 方法。每个方法必须包含断言，不能自行添加初始化、辅助方法、装饰器、文件操作或命令执行。特殊 SDK 需用单文件包装器适配；不兼容项应明确澄清，不能伪造通过。

执行器提供环境变量 `BLACKBOX_BASE_URL`、`BLACKBOX_EVIDENCE_FILE`。每次接口调用向后者追加 UTF-8 JSONL：

```json
{"test":"test_generated.RoomTests.test_capacity","request":{"method":"POST","path":"/rooms","body":{"maxPlayers":1}},"response":{"status":400,"body":{"error":"invalid_room"}}}
```

`test` 最后一段须对应唯一测试方法名。实际生成产物包含 `script`、`tests: [{testName, caseIds}]`、`questions`；所有已确认用例都要映射，不能引用未知 ID。有未决问题则停止预检。

## 判定与恢复

- 断言失败进入分析，候选问题必须引用失败方法及对应用例。方法内多个 `subTest` 失败合并为一个失败方法；原始详情保留。
- 导入 / 初始化 / 请求异常、缺少可归属的业务接口证据和跳过均不能认定通过或缺陷；报告标为无法判定。仅有样例复位请求也不算业务证据。
- 每次执行 ID 只可启动一次。超时、取消、连接断开及输出超限停止受管进程树；中断不自动恢复有副作用的测试。先停止旧任务并检查目标状态，再新建调用。判定 Agent 失败可以显式重试，不重复已完成执行。
- 后续策略固定 `report_only`：保存 / 下载报告和人工复现建议，不自动修改目标或提交缺陷。

框架与 AST 校验不是操作系统沙箱；子进程清空继承环境，仅保留运行所需路径变量。当前最多 300 秒、200 个测试方法、500 条请求证据，单个证据文件 1 MiB，输出流各 128 KiB。预览按敏感字段脱敏，原始文件与摘要保留在桌面应用数据目录 `python-executions/<执行ID>-execute/`，不发送到局域网协作服务。自由文本仍需人工检查后分享。

当前仅桌面版提供本机执行 IPC。局域网网页共同设计、分工与评审，不启动主机 CLI 或 Python。pytest、多文件框架、SSH / WSL、OS 沙箱、产物在线修改 / 退回和自动生成工作流仍在后续计划。
