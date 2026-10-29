# 0.1.2 发布验证

日期：2026-10-29。源提交：`52b9d6e8606cf8ba8cee3810ae6bdfb3eb82d065`，标签：`v0.1.2`。

## 验证结果

- [主分支 Checks](https://github.com/tracy115-ops/verification/actions/runs/40837636723)：frontend、rust 两个作业均成功。
- [Windows 打包](https://github.com/tracy115-ops/verification/actions/runs/40837644864)：版本校验、前端检查、原生测试、额外三轮执行契约、release 编译、NSIS 生成、资源检查、附件上传及 Release 发布均成功。
- [正式 Release](https://github.com/tracy115-ops/verification/releases/tag/v0.1.2)：非草稿、非预发布，包含安装包、SHA256SUMS.txt、build-info.json。
- 本地下载发布附件，核对安装包版本 `0.1.2`、构建模式 `release`、源提交和 SHA-256；与 GitHub 资产 digest 一致。

安装包：`Verification-Workbench-0.1.2-build.5.1-52b9d6e-windows-x64-setup.exe`，3,033,202 字节。

```text
e49ec0783725ede495f9acc75af2c02c26eececf2763b3b05b6b180cd85835f5
```

## 缺陷与回归

Windows 测试目录仅按时间戳命名会发生碰撞，进而共用 Python 工作区、触发 execution_already_started 及清理时二次 panic。相同时间戳创建 32 个目录的回归在修复前只有 1 个独立目录；进程 ID、原子序号与独占创建修复后得到 32 个。执行运行时 11 项测试在本地及发布 runner 均通过连续验证；超时取消测试仍使用 1 秒预算，没有关闭该门禁。

普通对话等待反馈原先被已有流程任务隐藏。新增三点动效和实时文本显示；5 项组件回归覆盖有／无历史任务、完成、失败、取消及超时。生产构建的 4 项 Playwright 回归覆盖等待状态、流式文本、减少动效偏好、布局和历史记录。该 UI 验证使用明确的离线 IPC 夹具，不证明模型推理或 CLI 认证。

## 适用边界

本次验证生成、下载和校验安装包，未执行系统安装或证明所有部署环境兼容。安装包未签名；CLI、Node.js 24+、Python 仍需按使用能力单独配置。跨机器网络与内部 codeagent 环境需要实际部署验收。
