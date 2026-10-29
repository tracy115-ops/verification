# 人工与 Agent 共同补充测试设计

## 入口与作用范围

个人会话的「验证资产 → 测试因子／场景设计与映射」提供「人工新增」和「编辑」。填写名称、关联需求、因子水平或场景维度、预期与因子映射，以及修改说明。因子的原文依据必须来自关联需求；可以直接选择引用，不能把猜测作为既定接口契约。

保存前明确提示版本影响：当前设计重新进入覆盖评审。旧设计、用例、脚本、审批、执行证据和覆盖声明保留在 `DesignRevision` 历史产物中；下游当前产物和审批撤销，重新评审后再生成用例和脚本。修改未执行新测试。每个任务最多 10 次人工设计修订；任务运行期间禁止编辑。修订重新计算运行期限，原始开始时间记录在历史中。

团队项目的「场景与因子」和「用例与脚本」支持人工增加与编辑、分工及评审。个人资产和团队项目分别存储；个人会话可导出协作补充包，导入团队项目并逐条审核。目前 HTTP 接口写入团队项目，不直接修改个人会话。

## Agent 通过局域网接口补漏

在团队项目「补充建议 → Agent 接口接入」查看当前项目地址、请求格式、完整 JSON Schema。服务端管理员为每个 Agent 创建独立 editor 成员令牌，通过进程环境注入，避免使用管理员令牌或将令牌写入共享文档。

1. `GET /api/team/projects/{projectId}` 获取最新基线与 `revision`。
2. 分析需求、已有因子／场景／用例及待处理建议，生成增量贡献。`source.kind=agent`，记录 CLI／模型名称与本地任务标识。
3. `POST /api/team/projects/{projectId}/commands`，请求头 `Authorization: Bearer <token>`、`Content-Type: application/json`，请求体如下：

```json
{
  "revision": 12,
  "command": {
    "type": "propose",
    "proposal": {
      "version": 1,
      "baseRevision": 12,
      "source": { "kind": "agent", "name": "codeagent", "runId": "gap-review-1" },
      "items": [{
        "id": "I_F_1", "kind": "factor", "action": "add",
        "reason": "补充容量边界调查维度，期望结果仍需原文确认",
        "value": {
          "id": "F_AGENT_CAPACITY", "name": "容量边界",
          "levels": ["下界", "上界", "越界"],
          "basis": "hypothesis", "sourceQuote": "",
          "rationale": "调查边界覆盖，不能据此推断未定义的响应"
        }
      }]
    }
  }
}
```

`revision` 是提交时的乐观并发版本，`baseRevision` 是分析采用的基线版本。409 时重新读取并核对差异，不盲目重试；422 时修正结构、引用或规则。服务端保存提交者、来源、时间和版本。建议逐条合入／驳回；合入时再次检查原条目是否已改变。其他浏览器每 5 秒同步。接口不会执行 Agent 提交的脚本。

普通 editor 令牌没有合入审批权限，但可以编辑设计；当前令牌属于成员角色授权，并非仅允许 propose 的专用最小权限令牌。不要将此流程描述成隔离执行沙箱。
