# 0.6.1 发布与完整回归

验证日期：2026-10-31。

## 发布产物

- [正式 Release](https://github.com/tracy115-ops/verification/releases/tag/v0.6.1) 已发布，源提交 `06c48c5`，应用版本 `0.6.1`。
- [Windows 打包运行](https://github.com/tracy115-ops/verification/actions/runs/41181030745) 成功，包含原生运行时测试、重复执行测试、release 编译、安装与升级冒烟、黑盒回归。
- 安装包 `Verification-Workbench-0.6.1-build.28.1-06c48c5-windows-x64-setup.exe`，3,319,419 字节。GitHub 资产 SHA-256 为 `05f66c9f55fde44787f4fbd890a8f0a3ac312d61d1c410b1a9bc294c7c4eff70`；同时发布独立 CLI 诊断程序、构建信息及校验文件。

## 完整检查与修正

主分支首次 Checks 的原生任务成功；前端 33 项界面测试中有一项失败。原因是调用详情标题增加输入字节数后，旧测试仍要求标题完全等于“实际提交给 Agent 的任务”。修正为定位请求详情的 summary，并核对标题和准确 UTF-8 字节数；请求正文、回复恢复和删除存储的原有断言保留。该修正仅涉及测试，不改已发布二进制。

本地针对生产构建执行：

- `WORKBENCH_TEST_PRODUCTION=1 npm run test:e2e`：33 项通过。
- `npm run test:team:e2e`：4 项通过，覆盖独立 Agent HTTP 提交、评审合入、脚本映射、变更失效、分工同步和冲突草稿保留。
- `npm run verify:blackbox`：基线 5/5；增强集在带缺陷目标发现 11 个失败、9 组已知缺陷；参考目标 26/26 通过。
- `npm run verify:game-agent -- --reuse-script`：复用此前生成脚本执行 36 项测试，带缺陷目标 15 个失败、0 个执行错误、8 组候选；参考目标全部通过。本次没有重新调用模型生成脚本。

前次本地 `npm run check` 的 137 项单元测试、6 项针对发送与分批恢复的界面测试、2 项真实 Python 流程测试也通过。

## 验证边界

界面测试模拟原生 CLI 边界，协作测试使用真实本地 HTTP 服务。内部 CodeAgent 未安装；其目标环境大文本初始化后等待问题仍需实际验证。CI 安装升级冒烟通过不代表用户机器的系统代理、权限及旧版本迁移全部得到覆盖。
