# 原生 Release 桌面端到端复验

## 本轮结论

0.9.7 使用正式 Tauri 构建入口生成的本地 Release 程序，恢复 0.9.6 原生完整流程留下的独立 WebView2 数据，通过原 IPC 核对版本，并在界面检查报告四个标签、两条请求、关联用例、原文及原脚本摘要。最终复验通过，无数据注入、无新模型调用。截图与构建摘要见[报告复验证据](../examples/generated/report-review-0.9.7/proof.json)及[真实桌面截图](../examples/generated/report-review-0.9.7/report.png)。本次范围是报告恢复与复核，不声称重新生成或执行整条流程，也不等于尚待 GitHub 生成的安装包已验收。

复验前曾发现两项失败：直接 Cargo Release 构建尝试加载开发服务器，改为正式 `npm run tauri -- build --no-bundle --ci`；报告错误使用产物包装摘要关联证据，改为既有契约中的 `EvidenceBundle.resultSha256`，并补入反例测试。不能用新窗口显示版本号代替实际报告操作。

0.9.6 已在本机真实 Release Tauri 窗口完成 13 步验证流程、4 次评审、真实 CLI 推理与真实 Python 执行，最终报告可见。正确参考目标和缺陷目标另作同脚本原生执行对照。详见[完整生成与执行证据](../examples/generated/native-desktop-2026-11-06/README.md)。

该验证取代此前“只验证真实 CLI / 引擎”和“浏览器界面 + 原生测试桥”的不足；两种旧证据仍保留其原有范围，不能追溯扩大。

## 0.9.8 来源选择补验

本地以正式资源协议编译 Release 后，通过 `desktop-source.spec.ts` 在真正 WebView 中验证“选用并测试”。原 Tauri IPC、实际已安装 Claude 与既有可信设置文件均未替换：短测通过后选中行保留，刷新后配置恢复但历史短测绿灯不继承。结果在本机 `.runtime/native-source-selection/summary.json`，不归档用户设置路径或配置内容。

原生来源验证入口：`npx playwright test --config playwright.desktop.config.ts desktop-source.spec.ts`。需填写已有 `DESKTOP_AUDIT_ENDPOINT`、`CLI_AUDIT_SETTINGS_FILE`、`CLI_AUDIT_EXECUTABLE`、`CLI_AUDIT_MODEL`；`DESKTOP_AUDIT_VERSION` 可核对预期版本。只在明确执行时调用模型，普通 CI 不包含该测试。本项仅复验来源选择短测，不冒称重新跑过 13 步完整测试流程。

本地构建要包含正式资源协议，例如 `node scripts/bundle-team.mjs` 后执行 `cargo build -p verification-desktop --release --features tauri/custom-protocol --locked`；单独 `--release` 并不保证使用内嵌页面，首轮检查已发现会误连开发地址。

## 启动 Release

先核对 GitHub 发布包的 `SHA256SUMS.txt`。可使用已有安装或解包后的原始 Release 可执行文件；审计须用独立 WebView2 数据目录，不能连接正在使用的个人窗口。准备已有可信 Claude 配置和已安装 CLI、Python。

```powershell
node scripts/start-desktop-audit.mjs --app "D:\Audit\verification-desktop.exe"
```

脚本输出本机 CDP endpoint 与 PID，创建独立 WebView2 用户目录并移除子进程临时 Anthropic/OAuth 环境变量，不复制密钥。它使用 [WebView2 官方环境参数](https://learn.microsoft.com/en-us/microsoft-edge/webview2/reference/win32/webview2-idl?view=webview2-1.0.2420.47)绑定本机调试端口；原有 Tauri invoke 保持不变，不需要系统 UI 自动化宿主。普通 Tauri 日志/运行目录可能仍由 Windows 已知文件夹解析到原目录，因此只隔离界面数据，不声称隔离所有系统目录。

## 执行实际界面测试

另一个终端启动公共基准：`npm run serve:game-fixture -- --port 4320`。设置以下环境变量后运行测试，路径均由本机操作者填写，不把真实路径或凭据提交到 Git：

- `DESKTOP_AUDIT_ENDPOINT`：启动器输出的 `http://127.0.0.1:<port>`。
- `DESKTOP_AUDIT_TARGET`：公共基准地址，如 `http://127.0.0.1:4320`。
- `CLI_AUDIT_SETTINGS_FILE`：常用 Claude 目录内、操作者确认可信且可用的 settings 文件；本项从界面的扫描结果选择它。
- `CLI_AUDIT_EXECUTABLE`：实际 Claude 启动文件绝对路径。
- `CLI_AUDIT_MODEL`：该 CLI 可用的模型 ID。
- `DESKTOP_AUDIT_VERSION`：预期 Release 版本，默认 `0.9.6`。

```powershell
npx playwright test --config playwright.desktop.config.ts
```

该测试可能产生模型费用，最多运行 30 分钟，无自动重试，普通测试/CI不包含它。所有业务步骤由界面控件操作；只读读取本地运行用于断言、归档，不通过注入数据制造成功。遇到缺口或失败保留真实运行，不自动豁免；修复后可以设置 `DESKTOP_AUDIT_RESUME=1`，在原窗口继续评审。

结果写入 `.runtime/desktop-e2e/evidence/`。结束后关闭自己启动的审计窗口和基准服务，避免遗留调试端口；不要结束其他工作台进程。

只复验已有真实任务的报告时，用启动器 `--root` 指向那次审计目录，设置 `DESKTOP_AUDIT_ENDPOINT` 与预期 `DESKTOP_AUDIT_VERSION` 后运行 `npx playwright test --config playwright.report-native.config.ts`。该测试只操作已存在任务的报告，不填充存储或调用模型。
