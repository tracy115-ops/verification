---
name: code-quality
description: 企业级代码质量硬性要求。写任何代码（新增/修改/重构 Rust、TS、TSX、Python）之前必读 — 单文件行数红线、模块拆分、性能、可维护性、扩展性、正确性的检查清单与拆分指引。当目标文件接近或超过 2000 行、或新增内容会让文件超过 2000 行时立即触发拆分。
---

# 企业级代码质量规范

写代码前的 **强制检查清单**，违反任一条就要在动手前主动告知用户并先重构。

## 1. 单文件行数红线

| 红线 | 行数（不含空行注释） | 处理 |
|---|---|---|
| 上限 | **2000 行** | 超过必须按职责拆分 |
| 警戒 | 1500 行 | 新增内容前先评估是否需拆分 |
| 目标 | < 800 行 | 单文件聚焦单一职责 |

**判定方法：** 动手前用 `wc -l <file>` 或 Read 工具确认目标文件实际行数。修改前若已超线，主动提示用户：「这个文件 X 行已超 2000 行红线，先帮你拆分再继续？」

**Rust 拆分范式（以 `remote_ssh.rs` 为例）：**
```
src-tauri/src/commands/remote_ssh/
├── mod.rs                  // re-export + 类型定义
├── connection.rs           // connect_authenticated_session / effective_auth_secret / system_ssh_base_args
├── hosts.rs                // host CRUD
├── state_sync.rs           // load_remote_state / save_remote_state
├── profiles.rs             // profile CRUD
├── sessions.rs             // session CRUD
├── files.rs                // prepare_remote_preview / open_remote_file_in_local_app
├── tools.rs                // detect_remote_tools / get_remote_tool_version
├── mcp.rs                  // remote MCP server ops
└── commands.rs             // run_remote_command / test_ssh_connection
```
顶层 `lib.rs` 仍写 `commands::remote_ssh::xxx`，调用方零改动。

**TS/React 拆分范式：**
- 一个组件文件 > 400 行 → 拆 subcomponents 目录
- 一个 store 文件 > 600 行 → 拆 slice（combine slices 或多 store）
- 一个 util 文件 > 600 行 → 按域拆分

## 2. 可维护性强

- **命名**：函数/变量名要能自解释；避免 `tmp`、`data2`、`handleXxx2`。
- **职责单一**：一个函数/类只做一件事。函数 < 80 行，圈复杂度 < 10。
- **嵌套深度**：≤ 3 层。提前 return（guard clause）降低缩进。
- **避免魔法数**：常量提取到顶部或单独常量文件。
- **错误信息**：面向用户的错误必须走 i18n（见 [[i18n]]），日志错误要带上下文（host、path、pty id 等）。
- **注释**：默认不写注释。只在 WHY 不显然时写一行；禁止写 WHAT 注释。

## 3. 可扩展性强

- **面向扩展点开放**：新增同类能力应只新增文件，不改核心代码。
- **避免 if/else 链按类型分发**：用 trait / map / registry。
- **配置驱动**：能配置的不写死（端口、超时、阈值）。
- **接口稳定**：公开 API 不破坏调用方（参考 `lib.rs` 注册命令的方式 — 内部重构对外零感知）。
- **避免过早抽象**：只在有 ≥ 2 个相似场景时才抽。Rule of three。

## 4. 性能高

### Rust 后端
- **阻塞 I/O 必须 spawn_blocking**：SSH / SFTP / 大文件读取不能直接 `await` 在 async runtime 上，会卡死。已有范式：`tauri::async_runtime::spawn_blocking(move || { ... }).await`。
- **锁粒度**：`Mutex` 持有时间尽可能短，不跨 await。`state.db.lock()` 拿到所需数据后立即 drop。
- **缓存**：相同输入应缓存（参考 `prepare_remote_preview` 单文件缓存键设计 — sha256 短哈希 + 扩展名）。
- **避免无谓 clone**：`&str` 优先于 `String`、`&[T]` 优先于 `Vec<T>`。
- **大对象**：用 `Arc<T>` 共享，不要 `Clone<T>`。

### React/TS 前端
- **useMemo / useCallback**：跨组件传递的回调、复杂计算结果才需 memo。简单值不要乱包。
- **列表 key**：用稳定唯一 id，不要用 index。
- **避免 re-render**：大列表虚拟化（已有 `FileTree` 用 antd Tree 内置虚拟滚动）。
- **store 订阅粒度**：用 selector 只订阅需要的字段，避免全量订阅。

## 5. 功能正确

- **边界条件**：空数组 / 空字符串 / null / undefined / 0 / 越界 都要覆盖。
- **错误路径**：每条 `invoke` / `await` 都要有 `catch` 或 `?`；错误必须能被用户看见（toast）或日志记录。
- **资源清理**：pty / sftp / file handle / event listener / timer 必须在 unmount / drop 时释放。
- **异步竞态**：组件 unmount 时取消进行中的请求（AbortController 或 ignore flag）。
- **类型安全**：禁用 `any`，必须显式 `unknown` + 类型守卫；`as` 强转只能用于外部边界。
- **测试驱动**：核心业务逻辑（解析、计算、状态转换）应有单测；纯 UI 可不测但要手测覆盖 golden path 和边界。

## 6. 必读的关联规则

- 三层架构 → `[[architecture]]`（Command / Service / Database）
- LLM 编码陷阱 → `[[karpathy-guidelines]]`（不过度设计、外科手术式改动、明确假设）
- 国际化 → 项目 CLAUDE.md 的 i18n 章节

## 7. 提交前自检清单

- [ ] 目标文件行数 < 2000 行？（超过先拆分）
- [ ] 函数 < 80 行？圈复杂度 < 10？
- [ ] 所有 `invoke` / `await` 都有错误处理？
- [ ] 资源（pty / sftp / fd / listener）都有清理路径？
- [ ] 新增用户可见文字都走了 `t('key')`？zh-CN 和 en-US 都加了？
- [ ] 新增 Tauri 命令已注册到 `lib.rs` 的 `invoke_handler!`？
- [ ] 阻塞 I/O 用了 spawn_blocking？锁没跨 await？
- [ ] 没用 `any` / 没用 `// TODO` 半成品？
