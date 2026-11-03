# 房间容量接口黑盒设计验收
仅有题目，无系统源码。本轮仅设计四条独立测试，输入 maxPlayers 分别为 2、8、1、9；其他输入、类型、缺字段、权限、并发和状态测试不在本轮范围。
POST /rooms 接收 JSON {maxPlayers,mode,ranked}，mode 固定 duel，ranked 固定 false。maxPlayers 为 JSON number 整数，允许范围为 2 到 8，包含两端。
maxPlayers=2 返回 HTTP 201；maxPlayers=8 返回 HTTP 201；maxPlayers=1 返回 HTTP 400；maxPlayers=9 返回 HTTP 400。本轮只断言 HTTP 状态码，不推断响应体字段。
每条测试均从框架独立初始状态开始，不复用房间。这里只完成需求、因子、四个场景和四条用例，不开发脚本、不执行测试。
