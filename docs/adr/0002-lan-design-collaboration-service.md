# ADR-0002：局域网设计协作采用独立 HTTP 服务

状态：采纳，2026-10-27。

## 背景

个人桌面 CLI 与本地浏览器存储无法满足同事共同梳理因子、场景、分工和评审。仅将 Vite 的 host 改成 0.0.0.0 也不会让各浏览器共享数据。

## 决策

增加 Node.js HTTP 服务，发布生产前端，通过类型化项目命令更新本机 SQLite。共享设计模型放在 `src/domain/team`，前端 HTTP 服务在 `src/services/team-api.ts`，路由、业务服务和持久化分别在 `server/app.ts`、`projects.ts`、`store.ts`。复用现有 Ajv 依赖，使用 Node 24 的原生 SQLite 和 TypeScript 类型擦除，不增加 Web 框架。

每次项目写入与历史快照在一个事务内提交，修订号提供乐观并发控制。成员身份由高熵个人令牌识别，数据库只存 SHA-256 摘要。角色在服务端判定；当前一个工作区共享所有项目，不实现租户隔离。

Rust / Tauri 保留本机 CLI 驱动职责。HTTP 服务本轮不暴露命令执行、模型凭据或远程脚本执行接口。后续任务调度应使用独立 Worker 与进程监督，而不是在同步数据库请求中运行 Agent。

## 取舍

同步 SQLite 足够当前小团队元数据操作；不适合长查询和大规模并发。Node SQLite 在采用版本为 release candidate，升级需要回归；Repository 提供替换点。没有引入 CRDT、多人同时编辑文本或消息中间件，先使用修订冲突提示和人工合并。

浏览器请求同源服务，无需为局域网客户端安装 Node 或 CLI。HTTP 需要可信网络或 HTTPS 代理；企业 SSO、逐项目授权、令牌撤销 / 过期、审计保留策略和备份管理仍待建设。

依据：[Node 24 SQLite](https://raw.githubusercontent.com/nodejs/node/v24.20.0/doc/api/sqlite.md)、[Node 24 TypeScript](https://nodejs.org/docs/latest-v24.x/api/typescript.html)。
