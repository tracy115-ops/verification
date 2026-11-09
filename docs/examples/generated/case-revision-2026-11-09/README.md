# 用例修订界面验收产物

来源：`tests/e2e/case-layout.spec.ts`、`tests/e2e/case-proposal.spec.ts` 与 `tests/live/desktop-cases.spec.ts`。

- `editor-light-zh.png`：中文浅色、1500×780，关联与范围。
- `editor-dark-en.png`：英文深色、900×780，步骤与断言。
- `proposal-approved.png`：离线协议夹具提出用例修改，经界面审核合入。
- `case-assertions-native.png`、`case-saved-native.png`、`native-summary.json`：0.14.0 Release 原生窗口的编辑、保存及摘要，原始 IPC 未替换，无未捕获界面错误。

输入为 `../cli-transcript-2026-10-28/run.json` 的历史运行；提议测试使用明确构造的状态码断言。截图由生产构建及原生 Release 自动化生成，本次没有调用新模型，也没有对真实业务接口执行这些断言。
