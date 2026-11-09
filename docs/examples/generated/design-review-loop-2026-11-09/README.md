# 设计评审闭环验收资产

2026-11-09，0.13.0，Windows。

- [原生缺口](gap-native-light-zh.png)：历史运行结构中注入一个缺失的既有因子关联，验证缺口定位。
- [原生人工修复后](repaired-native-light-zh.png)、[原生深色英文](repaired-native-dark-en.png)：通过界面补上关联后，场景仍有因子映射，用例变为待生成；不保留旧用例覆盖或执行确认。
- [原生摘要](native-summary.json)：读取到的版本号、原始 IPC、输入保留、人工修改及节点重排后的失效检查。
- [评审决定分类](review-decisions-fixture.png)、[提议合入](approved-proposal-fixture.png)：生产页面受控样本，验证澄清/排除不增加覆盖，以及提议经人工审核后才改变当前设计。

原生截图由 `tests/live/desktop-quality.spec.ts` 在独立 WebView 数据目录操作生成。没有调用真实模型；浏览器提议样本使用协议替身。这些资产不证明新题目的真实缺陷发现能力。验证过程见[验收记录](../../../research/design-review-loop-validation-2026-11-09.md)。
