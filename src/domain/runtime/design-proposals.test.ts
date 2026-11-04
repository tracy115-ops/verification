import { expect, it } from 'vitest';
import { design } from './fixtures.test-support';
import { completedProposalRun, addedScenarioPatch } from './design-proposal-fixtures.test-support';
import {
  applyDesignProposal,
  createDesignProposal,
  mergeDesignPatch,
  proposalBaseDigest,
} from './design-proposals';
import { latestArtifact } from './bindings';
import { decodeConversations } from '../../services/conversation-repository';
import { reviseDesign } from './design-revision';
import { runDeadline } from './deadline';

it('applies an incremental design only after approval and invalidates downstream artifacts', async () => {
  const run = await completedProposalRun();
  const original = structuredClone(run);
  const proposal = await createDesignProposal(run, addedScenarioPatch, '补充独立场景', crypto.randomUUID());
  expect(run).toEqual(original);
  expect(proposal.before.scenarios).toEqual([]);
  const next = await applyDesignProposal(run, proposal);
  expect(next.status).toBe('awaiting_review');
  expect(latestArtifact(next, 'TestDesign')).toBeUndefined();
  expect(latestArtifact(next, 'TestCaseSet')).toBeUndefined();
  expect(latestArtifact(next, 'TestDesignDraft')).toMatchObject({
    scenarios: [design.scenarios[0], addedScenarioPatch.scenarios[0].value],
  });
  expect(next.approvals).toHaveLength(1);
  expect(next.artifacts['history.design.1'].value).toMatchObject({
    source: 'agent_approved',
    attribution: { proposalId: proposal.id, turnId: proposal.turnId },
    artifacts: run.artifacts,
  });
  const session = {
    id: next.sessionId,
    title: 'Proposal',
    profileId: next.defaultProfileId,
    messages: [],
    runs: [next],
  };
  session.runs[0].artifacts[`proposal.design.${proposal.id}`] = {
    type: 'DesignChangeProposal',
    value: { ...proposal, status: 'applied', decidedAt: new Date().toISOString() },
    digest: 'test',
  };
  expect(decodeConversations(JSON.parse(JSON.stringify([session])))[0].runs[0].status).toBe(
    'awaiting_review',
  );
  await expect(applyDesignProposal(next, proposal)).rejects.toThrow('design_proposal_stale');
});

it('rejects duplicate IDs, unknown references, invented factor quotes and no-op patches', async () => {
  const run = await completedProposalRun();
  expect(() =>
    mergeDesignPatch(run, {
      ...addedScenarioPatch,
      scenarios: [{ ...addedScenarioPatch.scenarios[0], value: design.scenarios[0] }],
    }),
  ).toThrow('design_proposal_invalid');
  expect(() =>
    mergeDesignPatch(run, {
      ...addedScenarioPatch,
      scenarios: [...addedScenarioPatch.scenarios, ...addedScenarioPatch.scenarios],
    }),
  ).toThrow('design_proposal_invalid');
  expect(() =>
    mergeDesignPatch(run, {
      ...addedScenarioPatch,
      scenarios: [
        {
          ...addedScenarioPatch.scenarios[0],
          value: { ...addedScenarioPatch.scenarios[0].value, requirementIds: ['UNKNOWN'] },
        },
      ],
    }),
  ).toThrow('artifact_invalid');
  expect(() =>
    mergeDesignPatch(run, {
      ...addedScenarioPatch,
      factors: [{ action: 'update', value: { ...design.factors[0], sourceQuote: '不存在的规则' } }],
    }),
  ).toThrow('artifact_invalid');
  expect(() =>
    mergeDesignPatch(run, { summary: 'empty', factors: [], scenarios: [], questions: [] }),
  ).toThrow('design_proposal_empty');
});

it('binds proposals to source, clarifications and design, and blocks unanswered questions', async () => {
  const run = await completedProposalRun();
  const proposal = await createDesignProposal(run, addedScenarioPatch, '补充', crypto.randomUUID());
  expect(
    await proposalBaseDigest({
      ...run,
      clarifications: [{ question: '规则', answer: '补充', recordedAt: new Date().toISOString() }],
    }),
  ).not.toBe(proposal.baseDigest);
  await expect(applyDesignProposal({ ...run, spec: run.spec + '新版本' }, proposal)).rejects.toThrow(
    'design_proposal_stale',
  );
  const unresolved = await createDesignProposal(
    run,
    { summary: '缺少规则', factors: [], scenarios: [], questions: ['预期是什么？'] },
    '补充未定义行为',
    crypto.randomUUID(),
  );
  await expect(applyDesignProposal(run, unresolved)).rejects.toThrow('review_unresolved');
  const invalid = { ...proposal, createdAt: 'invalid-date' };
  const corrupted = {
    ...run,
    artifacts: {
      ...run.artifacts,
      [`proposal.design.${proposal.id}`]: { type: 'DesignChangeProposal', value: invalid, digest: 'bad' },
    },
  };
  expect(() =>
    decodeConversations([
      { id: run.sessionId, title: '', profileId: run.defaultProfileId, messages: [], runs: [corrupted] },
    ]),
  ).toThrow('session_storage_invalid');
});

it('allows repeated manual revisions and resets an expired resumed deadline for new review', async () => {
  let run = await completedProposalRun();
  run.resumedAt = new Date(0).toISOString();
  for (let i = 0; i < 11; i++)
    run = await reviseDesign(run, { ...design, strategy: `revision ${i}` }, '细化设计');
  expect(Object.values(run.artifacts).filter((item) => item.type === 'DesignRevision')).toHaveLength(11);
  expect(run.resumedAt).toBeUndefined();
  expect(runDeadline(run)).toBeGreaterThan(Date.now());
});
