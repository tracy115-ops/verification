# 用例场景核对验收产物

- `case-observation-replay.json` 是真实 Codex CLI 对已确认 S06 场景重新生成的用例。使用租户配额题目的原始 Spec、设计与生产用例批次函数。输出通过关联校验。
- `case-observation-implementation.json` 是真实 Codex CLI（`gpt-6-sol`）通过产品脚本生成逻辑实现该用例的原始输出。输入为 Spec、S06 用例和 Python 测试框架，输出通过产品实现校验。
- `execution-comparison.json` 保存原脚本和新增脚本在正确目标与本地缺陷变体上的四次执行结果，包括请求前后的响应、断言差异和原生运行时记录的证据摘要。
- `narrow-dark.png` 是生产构建在 900 像素宽、深色主题下的离线界面回归截图。断言默认展开，步骤可按需打开。
- `native-quota-review.png` 来自 0.18.0 隔离桌面，用上轮实际生成的 14 条用例恢复到评审阶段。截图保留原用例现有的断言，便于与重新生成的用例对照。
- `SHA256SUMS.json` 保存输出和截图摘要。

测试方式和验收边界见[验收记录](../../../research/case-scenario-review-validation-2026-11-19.md)。

从仓库根目录运行以下命令即可复验。需要 Python 和 Rust，复验使用归档脚本。

```sh
cargo build -p execution-runtime --example local --locked
node scripts/replay-quota-observation.mjs
```

命令将本次结果写入 `.runtime/quota-observation-native/comparison.json`。
