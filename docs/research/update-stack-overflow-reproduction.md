# 在线升级栈溢出复现

## 2026-10-30 本机实际故障

- 打开已安装的 0.2.0，通过设置检查并下载 0.5.1；用户点击安装后窗口消失，未启动安装器。
- Windows Application Error 1000 记录异常 `0xc00000fd`（栈溢出）；磁盘版本仍为 0.2.0。应用日志停在 update.downloaded，没有 update.installing。
- 使用已校验的 0.4.2 安装包手动覆盖，保留原有业务数据；再次从真实桌面界面检查、下载并确认安装 0.5.1，复现同样异常，版本仍为 0.4.2。

因此故障发生在应用自身安装 IPC 中，尚未进入辅助进程交接。仅启动安装器或独立更新进程的 CI 测试无法覆盖此故障。

## 修复与回归

安装前的异步 SHA-256 校验原来保存 64 KiB 栈数组，使 verify future 达到 65,816 字节。改为 Vec 堆缓冲，测试构建中 verify future 为 400 字节，完整 install_update future 为 992 字节；二者均限制为小于 16 KiB。

回归用例已在修复前失败，修复后通过。原有大小校验、SHA-256 校验、篡改拒绝和执行中禁止升级仍保留。打包流程加入 desktop crate 原生测试，以及实际安装 release 应用的 WebView → 原生 install_update 错误分支检查。

旧安装版本包含的崩溃逻辑不会因下载新安装包而改变；首次迁移需要手动安装包含修复的版本。完整升级和重启的实测结果需另外记录，不能由上述单元测试推断。

## 正式构建结果与剩余边界

[v0.5.4 打包流水线](https://github.com/tracy115-ops/verification/actions/runs/41038118963) 已成功，源码提交 c107fcd；[正式 Release](https://github.com/tracy115-ops/verification/releases/tag/v0.5.4) 已发布。

- 实际安装的 release WebView 调用 install_update，缺少下载状态时返回 update_check_first，随后 update_status 继续响应。日志明确记录 `Installed release 0.5.4: native install IPC gate passed`。
- 独立更新进程等待旧应用退出、校验安装包、同版本覆盖安装及自动重启检查通过，重启进程继续存活至少 10 秒，测试配置目录哨兵保留。
- 128 项前端测试、桌面原生测试和三轮执行契约回归通过，黑盒样例检查通过。
- 正式安装包已在本机下载并核对 GitHub 资产 SHA-256：`90652bd1c181f348e30de671fe27d39d10b74b628904467be4c71cbfef100199`；大小 3,306,273 字节。

0.5.2 构建被缺少测试资源阻止，0.5.3 构建被测试脚本过早读取 WebView 页面阻止，均未发布安装包；0.5.4 修正了资源准备顺序和页面等待。

本机为跨版本界面复测暂时保留带修复的 0.5.1 release 测试基线，与 GitHub 原 0.5.1 发布包不同。随后 Windows 桌面锁定，已停止界面输入并请求解锁；尚未完成该机器从检查、下载、确认安装到 0.5.4 重启的完整界面链路。CI 的原生 IPC 拒绝检查和独立安装检查不等于这项本机验收。
