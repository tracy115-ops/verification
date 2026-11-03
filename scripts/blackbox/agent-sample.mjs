import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { randomUUID, createHash } from 'node:crypto';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import { runProcess } from './process.mjs';
import { deepTestingGuidance } from '../../src/domain/runtime/deep-testing.ts';

const text = { type: 'string', minLength: 1, maxLength: 12000 };
const schema = {
  type: 'object',
  additionalProperties: false,
  required: ['script', 'coverage', 'questions'],
  properties: {
    script: { type: 'string', minLength: 100, maxLength: 100000 },
    coverage: {
      type: 'array',
      minItems: 1,
      maxItems: 100,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['requirementIds', 'method', 'testNames'],
        properties: {
          requirementIds: {
            type: 'array',
            minItems: 1,
            uniqueItems: true,
            items: { enum: ['R1', 'R2', 'R3', 'R4', 'R5'] },
          },
          method: text,
          testNames: {
            type: 'array',
            minItems: 1,
            uniqueItems: true,
            items: { type: 'string', pattern: '^test_[A-Za-z0-9_]+$' },
          },
        },
      },
    },
    questions: { type: 'array', maxItems: 50, items: text },
  },
};
export const validateSample = new Ajv2020({ strict: false }).compile(schema);
export const scriptDigest = (script) => createHash('sha256').update(script).digest('hex');

export async function generateSample({ root, driver, model, topic, framework }) {
  if (!['codex', 'claude', 'pi', 'codeagent'].includes(driver) || (driver !== 'codeagent' && !model))
    throw new Error('explicit_live_driver_and_model_required');
  mkdirSync(root, { recursive: true });
  const workspace = path.join(root, 'generation-workspace');
  mkdirSync(workspace, { recursive: true });
  const prompt = JSON.stringify({
    instruction:
      'Generate one independent Python unittest file using ONLY the topic and framework. You have no target source. Return ONLY outputSchema JSON. Generate 12-20 compact tests prioritizing stateful journeys and observable effects; use deepTestingGuidance within the topic scope. Import only unittest and framework; subclass framework.BlackBoxCase, with only test_ methods and no decorators, helpers, setUp, global executable statements or main. Use runtime IDs, intermediate status assertions and final-state oracles. No sleep, raw networking, filesystem, shell, reflection or source inspection. At most 2000 physical lines and 200 per method. Map every executable test exactly once in coverage to source requirement IDs. No execution has happened. Questions contain only genuine in-scope blockers; return [] if the provided contracts suffice.',
    topic,
    framework,
    deepTestingGuidance,
    outputSchema: schema,
  });
  const request = {
    turnId: randomUUID(),
    sessionId: randomUUID(),
    driver,
    model,
    prompt,
    timeoutSeconds: 600,
  };
  const started = Date.now();
  writeFileSync(path.join(root, 'prompt.json'), prompt);
  const binary = path.resolve(`target/debug/examples/turn${process.platform === 'win32' ? '.exe' : ''}`);
  if (!existsSync(binary)) throw new Error('build_native_turn_example_first');
  console.log(`Real ${driver} generation started; no automatic paid retries.`);
  const result = await runProcess(binary, [workspace], JSON.stringify(request), { timeout: 620000 });
  const records = result.stdout
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  const outcome = records.findLast((record) => record.outcome)?.outcome;
  const generation = {
    driver,
    requestedModel: model,
    elapsedMs: Date.now() - started,
    at: new Date().toISOString(),
    status: outcome?.status,
    errorCode: outcome?.errorCode,
    diagnostic: records.findLast((record) => record.event?.type === 'diagnostic')?.event,
  };
  writeFileSync(path.join(root, 'generation.json'), JSON.stringify(generation, null, 2));
  writeFileSync(path.join(root, 'reply.txt'), outcome?.text ?? '');
  if (outcome?.status !== 'completed')
    throw new Error(`live_generation_failed:${outcome?.errorCode ?? 'invalid_protocol'}`);
  const artifact = JSON.parse(outcome.text.trim().replace(/^```(?:json)?\s*\n([\s\S]*?)\n```$/, '$1'));
  if (!validateSample(artifact)) throw new Error('agent_artifact_invalid');
  writeFileSync(path.join(root, 'agent-artifact.json'), JSON.stringify(artifact, null, 2));
  generation.scriptSha256 = scriptDigest(artifact.script);
  generation.promptSha256 = scriptDigest(prompt);
  generation.frameworkSha256 = scriptDigest(framework);
  generation.topicSha256 = scriptDigest(topic);
  generation.artifactSha256 = scriptDigest(JSON.stringify(artifact));
  writeFileSync(path.join(root, 'generation.json'), JSON.stringify(generation, null, 2));
  return artifact;
}

export function loadSample(root) {
  const artifact = JSON.parse(readFileSync(path.join(root, 'agent-artifact.json'), 'utf8'));
  if (!validateSample(artifact)) throw new Error('agent_artifact_invalid');
  const generation = JSON.parse(readFileSync(path.join(root, 'generation.json'), 'utf8'));
  if (generation.scriptSha256 !== scriptDigest(artifact.script))
    throw new Error('generated_script_digest_mismatch');
  if (generation.artifactSha256 !== scriptDigest(JSON.stringify(artifact)))
    throw new Error('generated_artifact_digest_mismatch');
  if (generation.promptSha256 !== scriptDigest(readFileSync(path.join(root, 'prompt.json'), 'utf8')))
    throw new Error('generated_prompt_digest_mismatch');
  return artifact;
}
