# GitHub 手动打包 / Manual GitHub packaging

## 在 GitHub 触发

1. 打开仓库 [Package Windows Desktop](https://github.com/tracy115-ops/verification/actions/workflows/package-windows.yml)。
2. 点击 **Run workflow**，选择分支（通常为 `main`），再次点击 **Run workflow**。
3. 等待 `Windows x64 installer` 成功。在运行页面的 **Artifacts** 下载 `verification-windows-x64-<运行编号>`；运行摘要也提供下载链接。
4. 解压附件，运行 `Verification Workbench_*_x64-setup.exe` 安装。`SHA256SUMS.txt` 用于校验下载完整性，`build-info.json` 标明源提交和运行编号。

工作流支持手动触发，以及推送专用 `build/windows` 分支触发；普通 `main` 推送不生成安装包。手动触发需要仓库写权限，下载附件需要 GitHub 登录；附件保留 14 天（受仓库保留策略限制）。此流程不会创建 GitHub Release。

只有 Git SSH 推送权限、尚未登录 `gh` 时，可以使用专用分支：

```powershell
git push origin main
git push origin main:build/windows
```

第二条将已提交的 `main` 更新到打包分支并启动工作流，不切换本地工作区。重复推送相同提交不会产生新的 push 事件；重打同一版本请使用网页 **Run workflow**。不使用强制推送；若分支已由其他人更新，应先核对差异。

已登录 GitHub CLI 时，也可执行：

```powershell
gh workflow run package-windows.yml --repo tracy115-ops/verification --ref main
gh run list --repo tracy115-ops/verification --workflow package-windows.yml
gh run download <运行ID> --repo tracy115-ops/verification --dir artifacts/download
```

## 构建与产物

Windows x64 runner 使用 Node.js 24、Python 3.11、Rust stable；先运行前端／领域检查和原生运行时测试，再执行锁定 Cargo 依赖的 NSIS release 构建。打包配置 `src-tauri/tauri.bundle.conf.json` 独立于日常开发配置。

安装包包含应用、协作服务 `server.cjs` 和网页资源；流程检查这些资源是否随桌面构建复制。安装程序支持中文和英文，默认安装到当前用户目录。WebView2 缺失时由安装程序下载运行时，因此不是完全离线安装包。

当前产物未签名。Agent CLI 及其登录／模型配置仍使用目标机器的本地安装；托管协作服务需要另装 Node.js 24+，脚本核对／执行需要 Python。安装包不包含开发者的 Provider 凭据、个人会话或测试数据库。

本地 Windows 构建：

```powershell
npm.cmd ci
npm.cmd run package:windows -- -- --locked
# 快速验证打包配置，生成 debug 安装包：
npm.cmd run package:windows -- --debug -- --locked
```

默认产物目录是 `target/release/bundle/nsis/`；debug 为 `target/debug/bundle/nsis/`。若设置 `CARGO_TARGET_DIR`，以该目录为根。原生构建需要 MSVC C++ Build Tools、Windows SDK 和 Rust。

## English quick start

Open **Actions → Package Windows Desktop → Run workflow**, select a branch and start the run. Alternatively, push the committed version with `git push origin main:build/windows`; SSH push access is sufficient for this trigger. Download `verification-windows-x64-<run number>` from **Artifacts** after success. It contains an unsigned NSIS installer, SHA-256 checksums and commit metadata; artifacts are retained for 14 days. No Release is published automatically. Local Agent CLIs, Node.js 24+ for hosting and Python for test inspection/execution remain separate prerequisites.

## 2026-10-29 本地验证

Actionlint 1.7.12 检查两个 workflow 通过，格式与源文件约束通过。本地使用同一打包命令加 `--debug` 实际生成 x64 NSIS 安装包（3,429,587 字节）；从 workflow 提取的产物收集步骤在替换为本地 debug 路径后执行通过，确认协作服务资源、SHA-256 和提交元数据文件存在。该首次验证不包含安装到系统、GitHub runner 的 release 编译或远端附件上传；之后增加了专用分支触发入口。

Windows CI 的原生测试曾因测试 HTTP 夹具过早回复而失败。新增延迟发送请求头和请求体的回归在修复前可复现；修复将 accept 后的客户端套接字显式设为阻塞模式，避免 Windows 继承监听套接字非阻塞状态。修复后 19 项 Agent 与 9 项执行运行时测试、Clippy 和 Actionlint 均通过，没有跳过打包前的测试。

## 官方说明

- [GitHub：手动运行工作流](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow)
- [Tauri：Windows 安装程序](https://v2.tauri.app/distribute/windows-installer/)
