import type { ProjectInput, TeamAnalysis } from './types.ts';

const dimensions = [
  {
    key: 'payload',
    zh: '输入与边界',
    en: 'Input and boundaries',
    levelsZh: ['有效输入', '缺失', '空值', '最小边界', '最大边界', '越界', '格式错误'],
    levelsEn: ['valid', 'missing', 'null', 'minimum', 'maximum', 'out of range', 'malformed'],
  },
  {
    key: 'identity',
    zh: '身份与权限',
    en: 'Identity and permissions',
    levelsZh: ['合法身份', '未认证', '凭据过期', '权限不足'],
    levelsEn: ['authorized', 'anonymous', 'expired credential', 'forbidden'],
  },
  {
    key: 'state',
    zh: '前置状态',
    en: 'Prior state',
    levelsZh: ['初始状态', '已存在', '已结束', '非法状态'],
    levelsEn: ['initial', 'existing', 'finished', 'invalid state'],
  },
  {
    key: 'dependency',
    zh: '外部依赖行为',
    en: 'Dependency behavior',
    levelsZh: ['正常返回', '超时', '连接失败', '异常响应', '部分成功'],
    levelsEn: ['success', 'timeout', 'connection failure', 'invalid response', 'partial success'],
  },
  {
    key: 'repeat',
    zh: '重复与重试',
    en: 'Repetition and retries',
    levelsZh: ['首次请求', '重复请求', '失败后重试'],
    levelsEn: ['first request', 'duplicate request', 'retry after failure'],
  },
  {
    key: 'concurrency',
    zh: '并发与时序',
    en: 'Concurrency and ordering',
    levelsZh: ['串行', '并发', '乱序'],
    levelsEn: ['serial', 'concurrent', 'out of order'],
  },
];

export function suggestAnalysis(project: ProjectInput): TeamAnalysis {
  const zh = project.locale === 'zh-CN';
  const targets = project.interfaces.length
    ? project.interfaces
    : [{ id: 'subject', name: project.title, contract: '' }];
  const factors: TeamAnalysis['factors'] = [];
  const scenarios: TeamAnalysis['scenarios'] = [];
  for (const [index, target] of targets.entries()) {
    for (const dimension of dimensions) {
      const factorId = `F${index + 1}_${dimension.key}`;
      const levels = zh ? dimension.levelsZh : dimension.levelsEn;
      factors.push({
        id: factorId,
        name: `${target.name} / ${zh ? dimension.zh : dimension.en}`,
        levels,
        basis: 'hypothesis',
        sourceQuote: '',
        rationale: zh
          ? '规则库给出的分析候选；请结合题目确认是否适用，不能视为接口事实。'
          : 'Rule-based candidate. Confirm applicability against the topic; this is not an interface fact.',
      });
      scenarios.push({
        id: `SC_${factorId}`,
        title: `${target.name} / ${zh ? dimension.zh : dimension.en}`,
        interfaceIds: project.interfaces.length ? [target.id] : [],
        factorValues: [{ factorId, level: levels[1] }],
        oracle: '',
        oracleBasis: 'unknown',
        sourceQuote: '',
        ownerId: '',
      });
    }
  }
  return {
    factors,
    scenarios,
    questions: zh
      ? [
          '哪些行为是题目明确要求，哪些是团队假设？',
          '每个接口的可观察输出、错误行为和判定依据是什么？',
          '边界值、状态转换、幂等与依赖故障是否适用？',
          '哪些因子组合不可达或被明确排除？应另行记录组合约束。',
        ]
      : [
          'Which behaviors are explicit requirements and which are assumptions?',
          'What observable outputs and oracles define each interface?',
          'Which boundaries, state transitions, idempotency and dependency faults apply?',
          'Which factor combinations are infeasible or excluded? Record combination constraints separately.',
        ],
  };
}
