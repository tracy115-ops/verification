# 租户配额预留服务黑盒题目

仅提供下述外部 HTTP JSON 契约及框架，无系统源码。身份由框架参数 user 指定：player-a、player-b 为两个独立租户，缺省 player-a，None 或其他身份返回 401。每个测试的 setUp 通过框架恢复独立初态；无需创建租户，不测试时钟、过期、网络故障或未说明的路由。请优先设计约 12 条有区分度的状态旅程及边界用例，避免重复组合。

R1：每个租户初始配额为 4。GET /quota 返回 200，JSON 为 {available:4, consumed:0}。available 是未使用且未预留的配额，consumed 是已消费的配额；任意时刻 available、该租户所有 active 预留的 units 之和、consumed 三者之和必须为 4。租户之间互不影响。

R2：POST /holds 输入 {units,key}。units 必须是 JSON number 整数，范围 1 到 4；布尔值不算整数。key 必须是 1 到 32 个 ASCII 字母或数字。输入无效返回 400 且不改变任何状态。有效且 available 足够则返回 201 和 {id,owner,units,key,state:"active"}，available 减少 units。有效但配额不足返回 409，且不保存该 key、不改变状态。id 由服务生成，不应硬编码。

R3：key 在同一租户内幂等。成功预留后，用相同 key、相同 units 再次 POST /holds 返回 200 和当前同一预留，不再扣减配额；即使预留已 released 或 consumed 也如此。相同 key、不同有效 units 返回 409 且不改变状态。不同租户使用同一个 key 应创建各自独立的预留。GET /holds/{id}：本人返回 200 和当前预留，不存在返回 404，其他租户返回 403；不得改变状态。

R4：POST /holds/{id}/release 无需 body。本人 active 预留变为 released，返回 200 和当前预留，available 恢复 units。再次 release 返回 200 和同一 released 预留，不得重复恢复配额。本人 consumed 预留 release 返回 409，所有状态保持不变。其他租户返回 403，不存在返回 404，均不能改变任何租户的状态。

R5：POST /holds/{id}/consume 无需 body。本人 active 预留变为 consumed，返回 200 和当前预留，consumed 增加 units，available 不变。再次 consume 返回 200 和同一 consumed 预留，不得重复消费。本人 released 预留 consume 返回 409，所有状态保持不变。其他租户返回 403，不存在返回 404，均不能改变任何租户的状态。

R6：并发操作也必须满足上述契约。同一租户、同 key、同 units 的并发预留只能创建一条，首次 201、其他 200；不同 key 竞争不足以同时满足的配额，不得超卖。并发重复 release 或 consume 都只能改变一次配额，响应与最终状态须符合 R4、R5。使用框架 self.client.parallel，最多 4 个请求；不使用 sleep 证明并发。错误响应只要求状态码，不假设额外字段。
