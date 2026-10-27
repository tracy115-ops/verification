# 本轮设计归档验证记录

日期：2026-10-27。范围：项目规范、Markdown、工作流 JSON / Schema、draw.io XML 与本地 Git 基线。这里记录一次性评审检查，不表示已建立 CI 或实现产品运行时。

## 已通过

- 使用本机 Python `jsonschema.Draft202012Validator` 校验草案 Schema 本身及 13 节点工作流示例。
- 对示例检查节点 ID 唯一、依赖无环、产物绑定来自祖先或声明输入、输出槽存在、类型一致，以及四个人工确认阶段。
- 六个负向变体被拒绝：重复节点 ID、环路、不存在的输出槽、产物类型错配、引用非祖先节点、未知节点类型。
- 检查新文档 UTF-8 解码、代码围栏配对、本地 Markdown 链接存在，以及各文件不超过 2,000 行。
- 使用 drawio-skill 的 `scripts/validate.py` 检查架构图 XML，结果为 **0 errors / 0 warnings**。没有进行 PNG 导出或视觉验收。
- 检查拟纳入 Git 的文本没有匹配到常见 API key、AWS key 或私钥内容模式。这是有限模式检查，不替代后续完整凭据检测。
- `git check-ignore` 确认 `.claude/settings.local.json`、`.env`、`.verification/` 运行数据被忽略。
- 新增 / 修改的项目文档通过限定路径的 `git diff --cached --check`。初始化时原有技能文件有三处尾部空白 / 文件末空行提示，作为既有基线保留，本轮未改写技能内容。

## 未验证

真实模型调用、Provider 鉴权与隔离、CLI 事件端到端契约、权限限制、子进程取消、Tauri 编译打包、SSH / WSL 预检与执行、崩溃恢复，以及任何性能 / 覆盖率指标。

示例的 operation、artifact type、role 和 capability 名称仍是待实现契约。一次性图检查不包含生产节点注册器、授权判断、恢复机制或运行时编译器；不能据此宣称自定义工作流已可运行。

## 后续复验

代码骨架阶段将通用 Schema / DAG 校验和负向样例纳入仓库测试，再按[实施计划](../roadmap/implementation-plan.md)完成 P0 协议探针。依赖版本与角色能力认证应单独记录，避免以本次文档检查替代真实集成验证。
