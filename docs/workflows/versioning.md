# 版本与发布 / Versioning and releases

## 应用版本

采用 `MAJOR.MINOR.PATCH`：不兼容升级递增 MAJOR，兼容功能递增 MINOR，修复递增 PATCH。当前基线为 **0.1.0**；0.x 阶段的不兼容变更递增 MINOR，并在发布说明中列出迁移影响。完成稳定性、数据迁移和部署验收后再规划 1.0.0。

- `0.1.x`：现有工作流、桌面会话及协作的缺陷修复。
- `0.2.0`：下一批兼容功能；范围在开发计划中明确后再发布。
- 可选预发布格式：`0.2.0-alpha.1`、`0.2.0-beta.1`、`0.2.0-rc.1`；GitHub 标记为 prerelease。
- 正式标签 `v0.1.0` 对应正式 Release，不使用开发包代替。

`package.json` 为版本入口，必须同步 npm 锁文件、Tauri 配置、Cargo workspace 和四个本地 crate 的锁文件版本。版本不是工作流修订号、项目协作 revision 或产物 schemaVersion。

```powershell
npm.cmd run version:set -- 0.1.1
npm.cmd run version:check
```

`npm run check` 和打包工作流都强制校验一致性；标签与应用版本不一致时拒绝构建。

## 构建与发布

所有 GitHub 安装包均使用 **release 编译模式**，不传 `--debug`。正式发布推送带注释的 `v<应用版本>` 标签；所有检查、测试、安装包构建成功后创建 GitHub Release，并上传安装包、SHA-256 和构建信息。

```powershell
# 先提交版本变更及 docs/releases/0.1.1.md，验证后再执行：
git push origin main
git tag -a v0.1.1 -m 'Release 0.1.1'
git push origin v0.1.1
```

标签与已发布附件不覆盖；发布后修复使用新 PATCH 版本。未发布成功时可以在原标签重跑工作流；已存在 Release 时创建操作会失败，不静默替换附件。

分支推送或手动选择分支仅产生 Actions 附件，供发布前检查。手动选择版本标签可以重试发布。构建身份 `<应用版本>-build.<运行编号>.<重试次数>-<提交短号>` 写入附件名、安装包文件名及 `build-info.json`，避免同版本多次构建混淆；安装器内部版本仍为应用版本。

## English

Use SemVer, synchronized through `npm run version:set -- <version>` and enforced by `npm run version:check`. Push an annotated matching `v<version>` tag to build in release mode and publish a GitHub Release after all gates pass. Branch builds only produce Actions artifacts. Never overwrite published tags/assets; increment PATCH for fixes. Build identity includes application version, workflow number, attempt and commit. Release notes are required at `docs/releases/<version>.md`.
