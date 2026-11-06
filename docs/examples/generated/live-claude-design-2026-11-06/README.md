# 真实 Claude 设计与缺口修复

这些 JSON 来自实际已安装 Claude，通过应用共用 Rust 驱动和工作流领域引擎生成；不是离线 Agent 返回值。合成题目在 `source.txt`，请求模型为 `glm-5.3-flash`，不声称已独立验证上游实际模型身份。子进程已移除编码环境的临时 Anthropic/OAuth 认证变量，显式使用本机已有设置文件；归档不包含其路径、凭据、地址或原始 CLI 协议。

- `requirements.json`：真实需求提取，原文引用通过应用校验。
- `design-before.json`：原始场景设计。虽然 `gaps` 为空，但 `F-isolation` 的 `no room shared between tests` 未被场景关联，应用阻止覆盖评审。
- `repair-patch.json`：通过应用 `design.propose` 提示词生成的增量提议。合入经过 `createDesignProposal` / `applyDesignProposal`，未手改场景来凑通过。
- `design-after.json` / `cases.json`：修复并重新评审后，流程继续生成的场景基线和用例；最终 7 条需求、7 个因子、4 个场景、4 条用例。
- `report.json`：来源、范围及各文件 SHA-256。

合成题目的评审由审计脚本批准，不能当作真实用户完成评审或完整桌面点按证据。这里只验证设计链路；没有目标系统执行或缺陷捕获结论。复测原始缺口使用 `npm test -- live-design-recovery.test.ts`，不会付费调用模型。原始协议与审计运行保留于本机忽略目录 `.runtime/live-design-2026-11-06/`。

本次共 5 次真实调用，3 个合成题目评审节点，最终状态为 completed。需求提取的约 3 KB 请求仍耗时约 157 秒，且收到了大量协议活动，说明本次慢响应不能简单等同于输入过长或完全无输出；单个样本不能推断具体服务端原因。`report.json` 保留每次调用的提示词字节、耗时和协议计数，不含思考内容。
