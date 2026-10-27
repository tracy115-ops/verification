import { createHash } from 'node:crypto';

function subset(actual, expected) {
  if (expected === null || typeof expected !== 'object') return actual === expected;
  if (actual === null || typeof actual !== 'object') return false;
  return Object.entries(expected).every(([key, value]) => subset(actual[key], value));
}
async function send(base, request) {
  const resolved = new URL(request.path, base);
  if (
    resolved.origin !== new URL(base).origin ||
    !request.path.startsWith('/') ||
    request.path.startsWith('//')
  )
    throw new Error('benchmark_path_invalid');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3000);
  try {
    const response = await fetch(new URL(request.path, base), {
      method: request.method ?? 'GET',
      headers: { 'Content-Type': 'application/json', ...request.headers },
      body: request.body === undefined ? undefined : JSON.stringify(request.body),
      signal: controller.signal,
      redirect: 'error',
    });
    const reader = response.body.getReader();
    const chunks = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 65536) throw new Error('response_limit');
        chunks.push(Buffer.from(value));
      }
    } finally {
      await reader.cancel();
    }
    const text = Buffer.concat(chunks).toString('utf8');
    return { request, response: { status: response.status, body: JSON.parse(text) } };
  } finally {
    clearTimeout(timer);
  }
}
export async function runPlan(base, plan) {
  const url = new URL(base);
  if (url.hostname !== '127.0.0.1' || url.protocol !== 'http:' || plan.length > 100)
    throw new Error('benchmark_target_invalid');
  const results = [];
  for (const item of plan) {
    const evidence = [];
    const mismatches = [];
    let error;
    try {
      for (const step of item.steps) {
        if (step.parallel) {
          if (step.parallel.length > 4) throw new Error('concurrency_limit');
          const responses = await Promise.all(step.parallel.map((request) => send(base, request)));
          evidence.push(...responses);
          const statuses = responses.map((item) => item.response.status).sort();
          if (JSON.stringify(statuses) !== JSON.stringify([...step.statuses].sort()))
            mismatches.push({ expectedStatuses: step.statuses, actualStatuses: statuses });
        } else {
          if (!step.request.path.startsWith('/') || step.request.path.startsWith('//'))
            throw new Error('benchmark_path_invalid');
          const result = await send(base, step.request);
          evidence.push(result);
          if (
            result.response.status !== step.status ||
            (step.body !== undefined && !subset(result.response.body, step.body))
          )
            mismatches.push({ expected: { status: step.status, body: step.body }, actual: result.response });
        }
      }
    } catch (failure) {
      error = failure instanceof Error ? failure.message : 'request_failed';
    }
    results.push({
      id: item.id,
      title: item.title,
      requirementId: item.requirementId,
      category: item.category,
      status: error ? 'inconclusive' : mismatches.length ? 'failed' : 'passed',
      error,
      mismatches,
      evidence,
    });
  }
  const groups = new Map();
  for (const result of results.filter((item) => item.status === 'failed')) {
    const fingerprint = createHash('sha256')
      .update(`${result.requirementId}:${result.category}`)
      .digest('hex');
    const group = groups.get(fingerprint) ?? {
      fingerprint,
      requirementId: result.requirementId,
      category: result.category,
      cases: [],
    };
    group.cases.push(result.id);
    groups.set(fingerprint, group);
  }
  return {
    formatVersion: 1,
    createdAt: new Date().toISOString(),
    target: base,
    cases: results,
    candidateBugs: [...groups.values()],
    counts: {
      total: results.length,
      passed: results.filter((item) => item.status === 'passed').length,
      failed: results.filter((item) => item.status === 'failed').length,
      inconclusive: results.filter((item) => item.status === 'inconclusive').length,
      bugs: groups.size,
    },
  };
}
