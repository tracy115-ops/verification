# 游戏对战平台黑盒题（本地验证样例）

仅提供题目、测试框架和外部接口，无系统源码。接口均返回 JSON。测试者身份通过框架参数 user 指定；这里的 player-a / b / c 是夹具身份，不是真实凭据。每个测试的 setUp 由框架恢复独立初始状态。

## 房间子系统

`POST /rooms` 输入 `{maxPlayers, mode, ranked}`。maxPlayers 为 JSON number 类型整数，范围 2–8，含端点；mode 仅 duel / squad，ranked 为布尔值。ranked=true 时必须 mode=duel 且 maxPlayers=2。有效返回 201，JSON 包含 id；非法输入返回 400。

`GET /rooms/private-room`：预置私有房间 owner=player-a，成员只有 player-a，maxPlayers=2。player-a 可查询，返回 200、owner、members、maxPlayers。其他身份返回 403，无身份返回 401。

`POST /rooms/race-room/join`：预置容量为 2 的公开房间，初始只有 player-a。player-b / player-c 同时加入时，只能一个成功（200），另一个返回 409；最终 `GET /rooms/race-room` 的 members 长度为 2。单次 player-b 加入应成功。所有接口无身份返回 401。

## 对战子系统

`POST /matches/live/actions` 输入 `{turn, action}`。预置 currentTurn=3、参与者 player-a / player-b、当前行为者 player-a，action=attack / defend。合法行动返回 200，currentTurn 变为 4；过期 turn 返回 409，非参与者返回 403。

`POST /matches/finished/actions`：参与者仍为 player-a / player-b，但对局已结束；任何行动返回 409，禁止恢复对局或改变状态。

`POST /matches/result/result` 输入 `{winnerId, submissionId}`。参与者 player-a / player-b，player-a 为报告者；winnerId 必须为参与者。首次有效提交返回 200，胜者积分 +10。相同 submissionId 重放应返回 200，不重复加分。通过 `GET /players/player-a/score` 观察积分，初始为 0。题目未约定不同 submissionId 冲突、未认证报告者或非法 winnerId 的具体错误码，不能自行断言这些状态码。

## 匹配子系统及外部依赖

`POST /queue` 输入 `{level, region}`，level 为 1–100 的整数，region 为 cn / eu。有效请求返回 200 / `{status:"queued"}`；非法输入返回 400。框架通过 headers 参数设置 `X-Test-Matchmaker: unavailable` 可模拟题目允许控制的外部匹配服务不可用，此时返回 503 / `{status:"unavailable"}`，不得宣称已入队。

## 测试框架约定

继承 `framework.BlackBoxCase`，使用 `self.client.call(method,path,body=None,user="player-a",headers=None)`，得到含 status / body 的响应。无身份使用 user=None。`self.client.parallel([{method,path,body,user,headers},...])` 支持最多 4 个并发请求。

只生成一个 `test_game_platform.py`，仅允许导入 unittest 和 framework。不得访问源码、操作文件、执行 shell 或连接题目之外的服务。先设计正常与异常等价类、边界、决策表、权限、状态、重复和并发场景；未知预期列为问题。所有发现必须由请求 / 响应与契约断言支持。
