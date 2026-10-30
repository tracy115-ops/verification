# 0.4.2 更新进程验收

日期：2026-10-30。发布提交：473b8c6。

此前安装器自动重启烟雾检查通过，但用户反馈应用内点击升级后链路中断。该反馈不能由已有烟雾检查排除，也没有足够日志认定用户机器的具体失败原因。

## 本轮实际结果

- 15 项桌面原生测试通过，3 项显式在线或系统测试按原规则忽略；Clippy、版本、源规模和 PowerShell 语法检查通过。
- [Windows 打包及更新进程验收](https://github.com/tracy115-ops/verification/actions/runs/41018537542) 成功。运行实际 release 二进制的更新模式，先保持已安装应用运行，确认更新进程处于 waiting_for_app_exit；关闭旧应用后，验证安装退出成功、独立启动新应用、重启存活和用户目录标记保留。
- 本次使用与应用相同的原生更新进程；测试通过 Start-Process 触发该更新模式，没有模拟整个 WebView IPC 点击链路。
- [正式 Release](https://github.com/tracy115-ops/verification/releases/tag/v0.4.2) 已发布。实际下载安装包，大小 3,294,478 字节，SHA-256 与 GitHub 资产摘要一致。

```text
e4a049f31e88dc9119946d03ba8c0a556306b49f924c1db4cd09544a5089b48a
```

## 目标机器仍需确认

旧版点击更新仍使用旧更新器，必要时先手动安装 0.4.2。新更新进程保存 last-install.json，下一次启动将结果写入诊断日志 update.last_result。需区分 waiting_for_app_exit、installer_start_failed、installer_failed、installer_timeout、restart_failed、version_mismatch 和 completed；退出码可辅助检查权限或系统策略。

本轮不是公司环境兼容认证，不是跨版本业务数据迁移验收，也不承诺安装失败自动回滚。
