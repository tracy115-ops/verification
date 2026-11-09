# 0.14.x 用例修订验收

当前交付版本为 [0.14.1](https://github.com/tracy115-ops/verification/releases/tag/v0.14.1)，已于 2026-11-09 09:01:41 UTC 正式发布（非草稿）。源码提交 `49599ef`，Checks 与 Windows 打包均成功。

## 0.14.1 生命周期修复

0.14.0 的独立 Linux 开发模式检查有 5 项用例弹窗测试失败。Windows 生产模式与原生 Release 验证正常，不可据此推断所有构建模式均正常。本地开发模式复现后，定位到 StrictMode 的关闭/重开会留下迟到的原生 close 事件，导致条件挂载的弹窗被误关。修复只在弹窗实际关闭时处理该事件，增加事件顺序单元回归；0.14.1 分别复测开发与生产路径。

补丁本地结果：`npm run check` 通过（259 项单测）；完整开发模式 97 项、完整生产模式 97 项界面测试均通过；重新编译的 0.14.1 Release 原生用例编辑路径通过，摘要见 `native-0.14.1-summary.json`。本轮没有重新调用模型。

远端记录：

| 版本 | 检查 | 结果 |
| --- | --- | --- |
| 0.14.0 | [Checks](https://github.com/tracy115-ops/verification/actions/runs/42586484218) | 开发模式 5 项失败，已在补丁修复 |
| 0.14.0 | [Windows 打包](https://github.com/tracy115-ops/verification/actions/runs/42586505786) | 成功；不替代上述失败记录 |
| 0.14.1 | [Checks](https://github.com/tracy115-ops/verification/actions/runs/42588125139) | 前端与 Rust 均成功；远端开发模式 97 项和协作 5 项通过 |
| 0.14.1 | [Windows 打包](https://github.com/tracy115-ops/verification/actions/runs/42588142336) | 成功：259 项单测、97 项生产界面、5 项协作、78 项原生（3 项跳过）、3 轮执行契约、安装升级、种子黑盒回归及 Release 发布 |

发行安装包为 `Verification-Workbench-0.14.1-build.60.1-49599ef-windows-x64-setup.exe`，并包含独立 CLI 诊断工具、`build-info.json` 与 `SHA256SUMS.txt`。远端订单历史脚本复跑同样为 15 个方法、正确参考零失败/错误、捕获 6 个独立缺陷变体。

## 0.14.0 本地基础回归

- `npm run check`：版本契约、格式、规模限制、258 项单元测试、类型及生产构建已通过。
- `npm run test:e2e:production`：97 项全部通过，包含人工新增/编辑/复制、草稿恢复、会话删除清理、Agent 提议合入和问题阻断，以及中英文、深浅主题、900/1500 宽度的编辑器检查。截图复查后修正贴边、单列过长和保存按钮位置，再完成整套复测。
- `npm run test:team:e2e`：5 项通过，包括 Agent HTTP 提议、人工评审、覆盖映射和并发版本冲突。
- `cargo test --workspace --locked`：78 项通过，3 项显式联网/PAC集成或子进程辅助测试按配置跳过。
- `npm run verify:workflow`：2 项本地 Python 工作流测试通过。
- `npm run verify:deep-agent -- --reuse-script`：复跑归档模型脚本的 15 项订单状态测试，正确参考无失败/错误，6 个独立种子缺陷均被捕获。属于历史脚本回归，本轮没有新模型生成或新题目盲测。
- `tests/live/desktop-cases.spec.ts`：0.14.0 Release 桌面原始 IPC 路径的人工修订验证通过，使用明确标注的历史运行输入，不提交模型调用；验证关闭后恢复草稿、保存修订及重新打开用例评审，无未捕获界面错误。

截图与原生验证摘要见[产物说明](../examples/generated/case-revision-2026-11-09/README.md)。

领域测试还验证已完成执行后的修订：需求与设计审批保留，脚本、执行计划、授权、证据和报告清除当前有效状态，旧产物保存历史；节点反向排列不影响失效遍历。

## 验证边界

界面自动化中的 Agent 输出使用协议夹具。原生测试中的历史运行来自已有归档，不是本轮新分析。两者均不能证明内部 CodeAgent 或用户 Provider 在目标环境可用，也不能证明真实题目的业务覆盖完整。个人草稿目前只在当前应用窗口内保留。
